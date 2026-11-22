import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ isConfigured: true, supabase: mocks }))
import Reservas from './Reservas'

const userId = 'usuario-1'
const session = { user: { id: userId } }
const equipment = { id: 'equipo-1', equipo_id: 'equipo-1', nombre: 'Proyector de prueba', codigo_inventario: 'LAB-001', tipo: 'PROYECTOR', habilitado: true, disponible: true }
const reservation = { id: 'reserva-1', usuario_id: userId, equipo_id: equipment.id, equipo_nombre: equipment.nombre, codigo_inventario: equipment.codigo_inventario, solicitante_nombre: 'Estudiante prueba', solicitante_rol: 'ESTUDIANTE', actividad: 'Exposición académica', inicio: '2030-01-10T14:00:00Z', fin: '2030-01-10T15:00:00Z', estado: 'ACTIVA', total: 1 }
let profile
let rows
let available
let rpcError

beforeEach(() => {
  profile = { usuario_id: userId, nombre: 'Estudiante prueba', rol: 'ESTUDIANTE', autorizado: true }
  rows = [{ ...reservation }]
  available = [{ ...equipment }]
  rpcError = null
  mocks.from.mockImplementation(table => {
    const chain = {
      select: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: profile, error: null }),
      order: async () => ({ data: table === 'reservas_equipos' ? [equipment] : [profile], error: null }),
    }
    return chain
  })
  mocks.rpc.mockImplementation(async (name, params) => {
    if (rpcError?.name === name) return { data: null, error: rpcError.error }
    if (name === 'reservas_disponibilidad') return { data: available, error: null }
    if (name === 'reservas_consultar') return { data: rows, error: null }
    if (name === 'reservas_crear') return { data: [{ ...reservation, actividad: params.p_actividad }], error: null }
    if (name === 'reservas_modificar') { rows = [{ ...reservation, inicio: params.p_inicio, fin: params.p_fin }]; return { data: rows, error: null } }
    if (name === 'reservas_cancelar') { rows = [{ ...reservation, estado: 'CANCELADA' }]; return { data: rows, error: null } }
    throw new Error(`RPC inesperada: ${name}`)
  })
})
afterEach(cleanup)

async function open() {
  render(<Reservas session={session} />)
  await screen.findByText('Estudiante prueba')
}
function fillPeriod(scope = screen, period = { date: '2030-01-10', start: '09:00', end: '10:00' }) {
  fireEvent.change(scope.getByLabelText('Fecha'), { target: { value: period.date } })
  fireEvent.change(scope.getByLabelText('Hora inicial'), { target: { value: period.start } })
  fireEvent.change(scope.getByLabelText('Hora final'), { target: { value: period.end } })
}
async function search() {
  fillPeriod()
  fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
  await screen.findByText(equipment.nombre)
}
async function own() {
  fireEvent.click(screen.getByRole('tab', { name: 'Mis reservas' }))
  await screen.findByText('reserva-1')
}

describe('autorización', () => {
  it('pide sesión antes de consultar datos', () => {
    render(<Reservas session={null} />)
    expect(screen.getByText(/Inicia sesión con tu cuenta/)).toBeTruthy()
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('no permite operar a cuentas pendientes de autorización', async () => {
    profile = { ...profile, autorizado: false }
    render(<Reservas session={session} />)
    await screen.findByText('Cuenta pendiente de autorización')
    expect(screen.queryByRole('tab')).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('muestra historial al personal sin acciones de reserva', async () => {
    profile = { ...profile, rol: 'PERSONAL' }
    await open()
    expect(screen.getByRole('tab', { name: 'Mis reservas' })).toBeTruthy()
    await search()
    expect(screen.queryByRole('button', { name: 'Reservar equipo' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Historial general' }))
    await screen.findByText('reserva-1')
    expect(mocks.rpc).toHaveBeenCalledWith('reservas_consultar', expect.objectContaining({ p_historial: true, p_pagina: 1 }))
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
  })
})

describe('HU-01 y HU-02', () => {
  it('consulta filtros y crea una reserva con actividad sin enviar propietario', async () => {
    await open()
    fillPeriod()
    fireEvent.change(screen.getByLabelText('Tipo de equipo'), { target: { value: 'PROYECTOR' } })
    fireEvent.change(screen.getByLabelText('Buscar por nombre o código'), { target: { value: 'LAB-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reservar equipo' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Actividad académica'), { target: { value: 'Exposición académica' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar reserva' }))
    await screen.findByText('Reserva confirmada')
    expect(mocks.rpc).toHaveBeenCalledWith('reservas_disponibilidad', { p_inicio: '2030-01-10T09:00:00-05:00', p_fin: '2030-01-10T10:00:00-05:00', p_tipo: 'PROYECTOR', p_busqueda: 'LAB-001' })
    expect(mocks.rpc).toHaveBeenCalledWith('reservas_crear', { p_equipo_id: 'equipo-1', p_inicio: '2030-01-10T09:00:00-05:00', p_fin: '2030-01-10T10:00:00-05:00', p_actividad: 'Exposición académica' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('invalida resultados al cambiar los criterios de búsqueda', async () => {
    await open(); await search()
    fireEvent.change(screen.getByLabelText('Hora final'), { target: { value: '11:00' } })
    expect(screen.queryByRole('button', { name: 'Reservar equipo' })).toBeNull()
    expect(screen.getByText(/Consulta un período/)).toBeTruthy()
  })
  it('descarta una respuesta tardía si cambian los filtros', async () => {
    let resolve
    mocks.rpc.mockImplementation(() => new Promise(done => { resolve = done }))
    await open(); fillPeriod()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    fireEvent.change(screen.getByLabelText('Hora final'), { target: { value: '11:00' } })
    resolve({ data: [equipment], error: null })
    await waitFor(() => expect(screen.queryByText(equipment.nombre)).toBeNull())
  })
  it('distingue equipos ocupados de un fallo del servicio', async () => {
    available = [{ ...equipment, disponible: false }]
    await open(); await search()
    expect(screen.getByRole('button', { name: 'Reservar equipo' }).disabled).toBe(true)
    expect(screen.getByText(/No hay equipos disponibles/)).toBeTruthy()
    rpcError = { name: 'reservas_disponibilidad', error: new TypeError('Failed to fetch') }
    fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('No se pudo contactar')
    expect(screen.queryByText(/No hay equipos disponibles/)).toBeNull()
  })
})

describe('HU-03 y HU-04', () => {
  it('exige confirmar la cancelación y conserva el registro', async () => {
    await open(); await own()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'reservas_cancelar')).toBe(false)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, cancelar reserva' }))
    await screen.findByText('Reserva cancelada')
    expect(mocks.rpc).toHaveBeenCalledWith('reservas_cancelar', { p_reserva_id: 'reserva-1' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Modificar' })).toBeNull())
    expect(screen.getAllByText('reserva-1').length).toBeGreaterThan(0)
  })
  it('modifica el período conservando el identificador', async () => {
    await open(); await own()
    fireEvent.click(screen.getByRole('button', { name: 'Modificar' }))
    const dialog = within(screen.getByRole('dialog'))
    fillPeriod(dialog, { date: '2030-01-11', start: '11:00', end: '12:00' })
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Reserva modificada')
    expect(mocks.rpc).toHaveBeenCalledWith('reservas_modificar', { p_reserva_id: 'reserva-1', p_inicio: '2030-01-11T11:00:00-05:00', p_fin: '2030-01-11T12:00:00-05:00' })
  })
  it('muestra conflictos sin anunciar éxito ni perder la reserva original', async () => {
    rpcError = { name: 'reservas_modificar', error: { code: '23P01' } }
    await open(); await own()
    fireEvent.click(screen.getByRole('button', { name: 'Modificar' }))
    const dialog = within(screen.getByRole('dialog'))
    fillPeriod(dialog, { date: '2030-01-11', start: '11:00', end: '12:00' })
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('reserva original se conserva')
    expect(screen.queryByText('Reserva modificada')).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(rows[0].inicio).toBe(reservation.inicio)
  })
})

describe('HU-06', () => {
  it('envía filtros y cambia de página del historial', async () => {
    profile = { ...profile, rol: 'ADMINISTRADOR' }
    rows = [{ ...reservation, total: 21 }]
    await open()
    fireEvent.click(screen.getByRole('tab', { name: 'Historial general' }))
    await screen.findByText('reserva-1')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2030-01-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2030-01-31' } })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CANCELADA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('reservas_consultar', expect.objectContaining({ p_historial: true, p_desde: '2030-01-01', p_hasta: '2030-01-31', p_estado: 'CANCELADA', p_pagina: 1 })))
    await screen.findByText('reserva-1')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('reservas_consultar', expect.objectContaining({ p_pagina: 2 })))
  })
})
