export const EQUIPMENT_TYPES = [
  ['PROYECTOR', 'Proyectores'], ['LAPTOP', 'Laptops'], ['CAMARA', 'Cámaras'],
  ['CABLE', 'Cables'], ['ADAPTADOR', 'Adaptadores'],
]
export const ROLE_LABELS = { ESTUDIANTE: 'Estudiante', DOCENTE: 'Docente', PERSONAL: 'Personal del laboratorio', ADMINISTRADOR: 'Administrador' }
export const canReserve = role => ['ESTUDIANTE', 'DOCENTE', 'PERSONAL', 'ADMINISTRADOR'].includes(role)
export const canViewHistory = role => ['PERSONAL', 'ADMINISTRADOR'].includes(role)
export const isKnownRole = role => canReserve(role) || canViewHistory(role)

export function buildPeriod({ date, start, end }) {
  if (!date || !start || !end) throw new Error('Completa la fecha, la hora inicial y la hora final.')
  const parsedDate = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('Selecciona una fecha válida.')
  }
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!timePattern.test(start) || !timePattern.test(end) || start >= end) {
    throw new Error('La hora final debe ser posterior a la hora inicial.')
  }
  return { p_inicio: `${date}T${start}:00-05:00`, p_fin: `${date}T${end}:00-05:00` }
}

export function periodFields(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function formatPeriod(start, end) {
  const a = periodFields(start), b = periodFields(end)
  return `${a.date} · ${a.time}–${a.date === b.date ? b.time : `${b.date} ${b.time}`}`
}

export function reservationError(error) {
  if (error?.code === '23P01') return 'El equipo ya está reservado en ese horario. Consulta la disponibilidad y elige otro período. Si estabas modificando, tu reserva original se conserva.'
  if (error?.code === '42501') return 'No tienes permiso para esta operación. Comprueba tu sesión y la autorización de tu cuenta.'
  if (['PGRST202', 'PGRST205', '42P01'].includes(error?.code)) return 'El servicio de reservas aún no está habilitado. Contacta al responsable del laboratorio.'
  if (['PGRST301', 'PGRST303'].includes(error?.code)) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
  if (error?.code === '22023') return error.message || 'Revisa los datos ingresados.'
  if (error instanceof TypeError || /fetch|network|timeout/i.test(error?.message || '')) return 'No se pudo contactar con el servicio. Comprueba tu conexión y vuelve a intentarlo.'
  return error?.message || 'No se pudo completar la operación. Vuelve a intentarlo.'
}

// Identidad y autorización se resuelven en PostgreSQL; nunca se envía un propietario al mutar.
export function createReservasApi(client) {
  async function result(request) {
    if (!client) throw new Error('La conexión con Supabase no está configurada.')
    const { data, error } = await request
    if (error) throw error
    return data
  }
  async function mutation(request) {
    const data = await result(request)
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) throw new Error('No se recibió la confirmación. Actualiza tus reservas antes de volver a intentarlo.')
    return row
  }
  return {
    profile: id => result(client.from('reservas_usuarios').select('usuario_id,nombre,rol,autorizado').eq('usuario_id', id).maybeSingle()),
    equipment: () => result(client.from('reservas_equipos').select('id,nombre,codigo_inventario,tipo,habilitado,producto:reservas_productos(disponible_desde,disponible_hasta,roles_permitidos,habilitado)').order('nombre')),
    users: () => result(client.from('reservas_usuarios').select('usuario_id,nombre,rol').order('nombre')),
    availability: params => result(client.rpc('reservas_disponibilidad', params)),
    create: params => mutation(client.rpc('reservas_crear', {
      p_equipo_id: params.p_equipo_id, p_inicio: params.p_inicio, p_fin: params.p_fin, p_actividad: params.p_actividad,
    })),
    modify: (id, period) => mutation(client.rpc('reservas_modificar', {
      p_reserva_id: id, p_inicio: period.p_inicio, p_fin: period.p_fin,
    })),
    cancel: id => mutation(client.rpc('reservas_cancelar', { p_reserva_id: id })),
    list: params => result(client.rpc('reservas_consultar', params)),
  }
}
