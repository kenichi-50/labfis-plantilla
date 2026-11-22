import { buildPeriod, ROLE_LABELS } from './reservasApi'
export const canManageProducts = role => ['PERSONAL', 'ADMINISTRADOR'].includes(role)
export const canManageAccounts = role => role === 'ADMINISTRADOR'
export const displayAccount = email => email === 'admin@sigelab.invalid' ? 'admin' : email
export function productPayload(draft, id = null) {
  const quantity = Number(draft.quantity)
  const codes = draft.codes.split(/\r?\n/).map(code => code.trim()).filter(Boolean)
  if (!draft.name.trim()) throw new Error('Ingresa el nombre del producto.')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new Error('La cantidad debe ser un entero entre 1 y 500.')
  if (codes.length !== quantity) throw new Error('La cantidad debe coincidir con los códigos de inventario, uno por unidad.')
  if (new Set(codes.map(code => code.toLowerCase())).size !== quantity) throw new Error('Los códigos de inventario no pueden repetirse.')
  if (codes.some(code => code.length > 80)) throw new Error('Cada código debe tener como máximo 80 caracteres.')
  buildPeriod({ date: draft.from, start: '00:00', end: '00:01' })
  buildPeriod({ date: draft.until, start: '00:00', end: '00:01' })
  if (draft.from > draft.until) throw new Error('La fecha final debe ser igual o posterior a la inicial.')
  if (!draft.roles.length || draft.roles.some(role => !ROLE_LABELS[role])) throw new Error('Selecciona al menos un rol permitido.')
  return { p_producto_id: id, p_nombre: draft.name.trim(), p_tipo: draft.type, p_desde: draft.from, p_hasta: draft.until, p_roles: draft.roles, p_codigos: codes, p_habilitado: draft.enabled }
}
export function createGestionApi(client) {
  async function result(request) { const { data, error } = await request; if (error) throw error; return data }
  async function mutation(request) { const data = await result(request); const row = Array.isArray(data) ? data[0] : data; if (!row) throw new Error('No se recibió confirmación. Actualiza antes de volver a intentarlo.'); return row }
  return {
    accounts: params => result(client.rpc('admin_listar_cuentas', params)),
    saveAccount: params => mutation(client.rpc('admin_guardar_cuenta', params)),
    products: () => result(client.from('reservas_productos').select('*,unidades:reservas_equipos(id,codigo_inventario,habilitado)').order('nombre')),
    saveProduct: params => mutation(client.rpc('gestion_guardar_producto', params)),
  }
}
