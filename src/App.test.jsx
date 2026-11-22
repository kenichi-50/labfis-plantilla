import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), unsubscribe: vi.fn(), from: vi.fn(), callback: null }))
vi.mock('./lib/supabase', () => ({ isConfigured: true, supabase: { auth: mocks, from: mocks.from } }))
vi.mock('./modules/Reservas', () => ({ default: ({ session }) => <p>Reservas de {session.user.id}</p> }))
vi.mock('./modules/PrintingDemo', () => ({ default: () => <p>Demostración privada</p> }))
import App from './App'
const session = { user: { id: 'cuenta-1', email: 'prueba@example.edu.ec' } }
beforeEach(() => {
  mocks.from.mockImplementation(() => { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { usuario_id: 'cuenta-1', nombre: 'Prueba', rol: 'ESTUDIANTE', autorizado: true }, error: null }) }; return chain })
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.onAuthStateChange.mockImplementation(callback => { mocks.callback = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
})
afterEach(cleanup)
async function login() {
  await screen.findByRole('heading', { name: 'Bienvenido a SIGELAB' })
  fireEvent.change(screen.getByLabelText(/^Correo electrónico/), { target: { value: session.user.email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-prueba-123' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Inicio de sesión' }))
  await screen.findByRole('button', { name: 'Salir' })
}

describe('acceso independiente y navegación autenticada', () => {
  it('no muestra menú ni módulos antes de autenticar y abre el inicio después', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Bienvenido a SIGELAB' })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Inicio' })).toBeNull()
    await login()
    expect(screen.getByRole('navigation')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Un sistema/ })).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Inicio de sesión' })).toBeNull()
  })
  it('restaura una sesión existente antes de mostrar el inicio', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    render(<App />)
    await screen.findByRole('button', { name: 'Salir' })
    expect(screen.queryByRole('heading', { name: 'Bienvenido a SIGELAB' })).toBeNull()
  })
  it('vuelve al login al salir y limpia el módulo seleccionado', async () => {
    render(<App />); await login()
    fireEvent.click(screen.getByRole('button', { name: 'Reservas', exact: true }))
    await screen.findByText('Reservas de cuenta-1')
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await screen.findByRole('heading', { name: 'Bienvenido a SIGELAB' })
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(screen.queryByText('Reservas de cuenta-1')).toBeNull()
    await login()
    expect(screen.getByRole('heading', { name: /Un sistema/ })).toBeTruthy()
  })
  it('bloquea el contenido cuando expira la sesión', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    render(<App />)
    await screen.findByRole('button', { name: 'Salir' })
    act(() => mocks.callback('SIGNED_OUT', null))
    await screen.findByRole('heading', { name: 'Bienvenido a SIGELAB' })
    expect(screen.queryByRole('navigation')).toBeNull()
  })
  it('un resultado antiguo de restauración no reemplaza una sesión recién iniciada', async () => {
    let resolve
    mocks.getSession.mockImplementation(() => new Promise(done => { resolve = done }))
    render(<App />)
    expect(screen.getByRole('status').textContent).toContain('Comprobando sesión')
    act(() => mocks.callback('SIGNED_IN', session))
    await screen.findByRole('button', { name: 'Salir' })
    await act(async () => resolve({ data: { session: null }, error: null }))
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
  it('ofrece reintentar si falla la comprobación de sesión', async () => {
    mocks.getSession.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<App />)
    await screen.findByRole('button', { name: 'Reintentar conexión' })
    expect(screen.queryByRole('navigation')).toBeNull()
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conexión' }))
    await screen.findByRole('button', { name: 'Salir' })
  })
  it('muestra un error si no se puede cerrar sesión', async () => {
    mocks.signOut.mockResolvedValue({ error: new Error('Sin conexión') })
    render(<App />); await login()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo cerrar'))
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
})
