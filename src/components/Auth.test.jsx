import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn() }))
vi.mock('../lib/supabase', () => ({ isConfigured: true, supabase: { auth: mocks } }))
import Auth from './Auth'
const session = { user: { id: 'cuenta-1', email: 'prueba@example.edu.ec' } }
beforeEach(() => {
  mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null })
})
afterEach(cleanup)
function credentials() {
  fireEvent.change(screen.getByLabelText(/^Correo electrónico/), { target: { value: 'prueba@example.edu.ec' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-prueba-123' } })
}
function registration() {
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Docente de prueba' } })
  fireEvent.change(screen.getByLabelText('Tipo de cuenta solicitado'), { target: { value: 'DOCENTE' } })
  credentials()
}

describe('pantalla de autenticación', () => {
  it('envía credenciales y comunica la sesión para abrir el inicio', async () => {
    const authenticated = vi.fn()
    render(<Auth onAuthenticated={authenticated} />)
    credentials()
    fireEvent.submit(screen.getByRole('form', { name: 'Inicio de sesión' }))
    await vi.waitFor(() => expect(authenticated).toHaveBeenCalledWith(session))
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'prueba@example.edu.ec', password: 'clave-prueba-123' })
  })
  it('registra estudiante/docente como solicitud sin conceder rol ni autorización', async () => {
    const authenticated = vi.fn()
    render(<Auth onAuthenticated={authenticated} />)
    registration()
    expect(screen.queryByRole('option', { name: 'Administrador' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Personal' })).toBeNull()
    fireEvent.submit(screen.getByRole('form', { name: 'Registro de cuenta' }))
    await screen.findByRole('status')
    expect(mocks.signUp).toHaveBeenCalledWith({ email: 'prueba@example.edu.ec', password: 'clave-prueba-123', options: { data: { full_name: 'Docente de prueba', requested_role: 'DOCENTE' } } })
    expect(authenticated).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('personal de LABFIS')
  })
  it('entra al inicio si el registro devuelve una sesión activa', async () => {
    const authenticated = vi.fn()
    mocks.signUp.mockResolvedValue({ data: { session }, error: null })
    render(<Auth onAuthenticated={authenticated} />)
    registration()
    fireEvent.submit(screen.getByRole('form', { name: 'Registro de cuenta' }))
    await vi.waitFor(() => expect(authenticated).toHaveBeenCalledWith(session))
  })
  it('muestra errores de credenciales sin iniciar una sesión', async () => {
    const authenticated = vi.fn()
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: 'invalid_credentials' } })
    render(<Auth onAuthenticated={authenticated} />)
    credentials()
    fireEvent.submit(screen.getByRole('form', { name: 'Inicio de sesión' }))
    expect((await screen.findByRole('alert')).textContent).toContain('no son correctos')
    expect(authenticated).not.toHaveBeenCalled()
  })
  it('evita solicitudes duplicadas mientras se procesa el formulario', async () => {
    let resolve
    mocks.signInWithPassword.mockImplementation(() => new Promise(done => { resolve = done }))
    render(<Auth onAuthenticated={vi.fn()} />)
    credentials()
    const form = screen.getByRole('form', { name: 'Inicio de sesión' })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1)
    resolve({ data: { session }, error: null })
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Ingresar' }).disabled).toBe(false))
  })
})
