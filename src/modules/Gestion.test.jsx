import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ isConfigured: true, supabase: mocks }))
import Gestion from './Gestion'
let role
let failure
let products
const session = { user: { id: 'admin-1' } }
const pending = { usuario_id: 'cuenta-2', correo: 'docente@example.edu.ec', correo_confirmado: true, nombre_solicitado: 'Docente solicitante', tipo_solicitado: 'DOCENTE', nombre: null, rol: null, autorizado: false, total: 1 }
beforeEach(() => {
  role = 'ADMINISTRADOR'; failure = null; products = []
  mocks.from.mockImplementation(() => {
    const chain = { select: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: { usuario_id: 'admin-1', nombre: 'Admin', rol: role, autorizado: true }, error: null }),
      order: async () => ({ data: products, error: null }),
    }; return chain
  })
  mocks.rpc.mockImplementation(async (name, params) => {
    if (failure) return { data: null, error: failure }
    if (name === 'admin_listar_cuentas') return { data: [pending], error: null }
    if (name === 'admin_guardar_cuenta') return { data: [{ usuario_id: params.p_usuario_id }], error: null }
    if (name === 'gestion_guardar_producto') return { data: [{ id: 'producto-1' }], error: null }
    throw new Error('RPC inesperada')
  })
})
afterEach(cleanup)
async function open() {
  render(<Gestion session={session} />)
  await screen.findByRole('button', { name: /Nuevo producto/ })
}
function fillProduct() {
  fireEvent.change(screen.getByLabelText('Nombre del producto'), { target: { value: 'Proyectores del laboratorio' } })
  fireEvent.change(screen.getByLabelText('Cantidad de unidades'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Códigos de inventario'), { target: { value: 'LAB-P-001\nLAB-P-002' } })
  fireEvent.change(screen.getByLabelText('Disponible desde'), { target: { value: '2030-01-10' } })
  fireEvent.change(screen.getByLabelText('Disponible hasta'), { target: { value: '2030-01-31' } })
}

describe('gestión de cuentas y roles', () => {
  it('permite al administrador revisar solicitudes y guardar permisos efectivos', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Cuentas y roles' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    fireEvent.change(screen.getByLabelText('Nombre validado'), { target: { value: 'Docente validado' } })
    fireEvent.change(screen.getByLabelText('Rol asignado'), { target: { value: 'DOCENTE' } })
    fireEvent.click(screen.getByLabelText('Autorizar acceso a Reservas'))
    fireEvent.submit(screen.getByRole('form', { name: 'Revisión de cuenta' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_guardar_cuenta', { p_usuario_id: 'cuenta-2', p_nombre: 'Docente validado', p_rol: 'DOCENTE', p_autorizado: true }))
  })
  it('permite filtrar solicitudes y cambiar la asignación a personal', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Cuentas y roles' }))
    await screen.findByRole('button', { name: 'Revisar' })
    fireEvent.change(screen.getByLabelText('Buscar cuenta'), { target: { value: 'docente' } })
    fireEvent.change(screen.getByLabelText('Estado de autorización'), { target: { value: 'TODAS' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar cuentas' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_listar_cuentas', expect.objectContaining({ p_busqueda: 'docente', p_estado: 'TODAS' })))
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    fireEvent.change(screen.getByLabelText('Rol asignado'), { target: { value: 'PERSONAL' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Revisión de cuenta' }))
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_guardar_cuenta', expect.objectContaining({ p_rol: 'PERSONAL', p_autorizado: false })))
  })
  it('no muestra administración de cuentas al personal', async () => {
    role = 'PERSONAL'; await open()
    expect(screen.queryByRole('button', { name: 'Cuentas y roles' })).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('impide abrir gestión a estudiantes', async () => {
    role = 'ESTUDIANTE'
    render(<Gestion session={session} />)
    expect((await screen.findByRole('alert')).textContent).toContain('no tiene autorización')
    expect(screen.queryByRole('button', { name: /Nuevo producto/ })).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('gestión de productos', () => {
  it('registra cantidad, códigos, fechas y roles seleccionados', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Nuevo producto/ }))
    fillProduct()
    fireEvent.click(screen.getByLabelText('Estudiante'))
    fireEvent.click(screen.getByLabelText('Personal del laboratorio'))
    fireEvent.submit(screen.getByRole('form', { name: 'Datos del producto' }))
    await screen.findByText(/Producto guardado/)
    expect(mocks.rpc).toHaveBeenCalledWith('gestion_guardar_producto', { p_producto_id: null, p_nombre: 'Proyectores del laboratorio', p_tipo: 'PROYECTOR', p_desde: '2030-01-10', p_hasta: '2030-01-31', p_roles: ['DOCENTE', 'PERSONAL'], p_codigos: ['LAB-P-001', 'LAB-P-002'], p_habilitado: true })
  })
  it('rechaza cantidad que no coincide con los códigos', async () => {
    await open(); fireEvent.click(screen.getByRole('button', { name: /Nuevo producto/ })); fillProduct()
    fireEvent.change(screen.getByLabelText('Cantidad de unidades'), { target: { value: '3' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Datos del producto' }))
    expect((await screen.findByRole('alert')).textContent).toContain('cantidad debe coincidir')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('conserva el formulario cuando el backend protege una reserva futura', async () => {
    await open(); fireEvent.click(screen.getByRole('button', { name: /Nuevo producto/ })); fillProduct()
    failure = { code: '22023', message: 'El cambio afectaría reservas futuras activas.' }
    fireEvent.submit(screen.getByRole('form', { name: 'Datos del producto' }))
    expect((await screen.findByRole('alert')).textContent).toContain('reservas futuras')
    expect(screen.getByRole('form', { name: 'Datos del producto' })).toBeTruthy()
    expect(screen.queryByText(/Producto guardado/)).toBeNull()
  })
  it('carga cantidad y códigos actuales al editar un producto', async () => {
    products = [{ id: 'p1', nombre: 'Cámaras', tipo: 'CAMARA', habilitado: true, disponible_desde: '2030-01-10', disponible_hasta: '2030-01-31', roles_permitidos: ['DOCENTE'], unidades: [{ id: 'e1', codigo_inventario: 'CAM-001', habilitado: true }, { id: 'e2', codigo_inventario: 'CAM-002', habilitado: false }] }]
    await open()
    fireEvent.click(await screen.findByRole('button', { name: /Editar producto/ }))
    expect(screen.getByLabelText('Cantidad de unidades').value).toBe('1')
    expect(screen.getByLabelText('Códigos de inventario').value).toBe('CAM-001')
    expect(screen.getByLabelText('Docente').checked).toBe(true)
    expect(screen.getByLabelText('Estudiante').checked).toBe(false)
  })
})
