import { useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, Eye, EyeOff, FlaskConical, ShieldCheck } from 'lucide-react'
import { supabase, isConfigured } from '../lib/supabase'
import { loginIdentity } from '../lib/loginIdentity'
import './auth.css'

function authMessage(error) {
  if (error?.code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.'
  if (error?.code === 'email_not_confirmed') return 'Confirma tu correo electrónico antes de iniciar sesión.'
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) return 'Se alcanzó el límite de intentos. Espera unos minutos y vuelve a intentarlo.'
  if (error?.code === 'signup_disabled') return 'El registro no está disponible. Solicita una cuenta al personal de LABFIS.'
  if (error instanceof TypeError || /fetch|network/i.test(error?.message || '')) return 'No se pudo contactar con el servicio. Comprueba tu conexión y vuelve a intentarlo.'
  return error?.message || 'No se pudo completar el acceso. Vuelve a intentarlo.'
}

export default function Auth({ onAuthenticated, sessionError, onRetry }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [requestedRole, setRequestedRole] = useState('ESTUDIANTE')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const submitting = useRef(false)
  const registering = mode === 'register'
  function changeMode(next) { setMode(next); setPassword(''); setShowPassword(false); setError(''); setMessage('') }
  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    setError(''); setMessage('')
    if (!supabase || !isConfigured) { setError('El servicio de acceso aún no está configurado. Contacta al responsable del laboratorio.'); return }
    if (!email.trim() || !password) { setError('Ingresa tu correo y contraseña.'); return }
    if (registering && (!name.trim() || password.length < 6 || !['ESTUDIANTE', 'DOCENTE'].includes(requestedRole))) {
      setError('Completa tu nombre, el tipo de cuenta y una contraseña de al menos 6 caracteres.'); return
    }
    submitting.current = true; setBusy(true)
    try {
      const credentials = { email: registering ? email.trim() : loginIdentity(email), password }
      // Estos metadatos expresan una SOLICITUD, nunca un permiso efectivo.
      const { data, error: failure } = registering
        ? await supabase.auth.signUp({ ...credentials, options: { data: { full_name: name.trim(), requested_role: requestedRole } } })
        : await supabase.auth.signInWithPassword(credentials)
      if (failure) throw failure
      if (data?.session) onAuthenticated?.(data.session)
      else if (registering) {
        setMessage('Solicitud de cuenta recibida. Si recibes un correo de confirmación, confírmalo antes de iniciar sesión. El personal de LABFIS debe validar tu tipo de cuenta y autorizar las reservas.')
        setPassword('')
      } else setError('No se recibió una sesión válida. Vuelve a iniciar sesión.')
    } catch (failure) { setError(authMessage(failure)) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-intro" aria-label="SIGELAB">
    <div className="auth-brand"><span className="auth-brand-icon"><FlaskConical size={29} /></span><div><strong>SIGELAB</strong><span>Servicios de LABFIS</span></div></div>
    <div className="auth-intro-content"><span className="auth-kicker">ESCUELA POLITÉCNICA NACIONAL</span><h1>Tu laboratorio.<br />Todo en un lugar.</h1><p>Organiza tus actividades académicas y accede a los servicios del laboratorio con tu cuenta.</p>
      <div className="auth-feature"><CalendarDays size={22} /><div><strong>Equipos para tus actividades</strong><span>Consulta disponibilidad y gestiona tus reservas.</span></div></div>
      <div className="auth-feature"><ShieldCheck size={22} /><div><strong>Acceso según tu perfil</strong><span>Estudiantes, docentes y personal de LABFIS.</span></div></div>
    </div><p className="auth-intro-footer">Facultad de Ingeniería de Sistemas · LABFIS</p>
  </section><section className="auth-form-side" aria-label="Acceso a SIGELAB"><div className="auth-form-card">
    <div className="auth-switch" aria-label="Opciones de acceso"><button type="button" className={!registering ? 'selected' : ''} aria-pressed={!registering} disabled={busy} onClick={() => changeMode('login')}>Iniciar sesión</button><button type="button" className={registering ? 'selected' : ''} aria-pressed={registering} disabled={busy} onClick={() => changeMode('register')}>Crear cuenta</button></div>
    <h2>{registering ? 'Crea tu cuenta' : 'Bienvenido a SIGELAB'}</h2><p className="auth-description">{registering ? 'Solicita acceso a los servicios del laboratorio.' : 'Ingresa para acceder al inicio y a los módulos de LABFIS.'}</p>
    {!isConfigured && <div className="message error" role="alert">El servicio de acceso aún no está configurado. Contacta al responsable del laboratorio.</div>}
    {sessionError && <div className="message error" role="alert"><p>{sessionError}</p>{onRetry && <button type="button" className="secondary small" disabled={busy} onClick={onRetry}>Reintentar conexión</button>}</div>}
    <form onSubmit={submit} className="auth-login-form" aria-label={registering ? 'Registro de cuenta' : 'Inicio de sesión'}>
      {registering && <><label>Nombre completo<input required maxLength="200" autoComplete="name" value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="Tu nombre y apellido" /></label><label>Tipo de cuenta solicitado<select value={requestedRole} disabled={busy} onChange={event => setRequestedRole(event.target.value)}><option value="ESTUDIANTE">Estudiante</option><option value="DOCENTE">Docente</option></select></label></>}
      <label>{registering ? 'Correo electrónico' : 'Correo electrónico o usuario'}<input type={registering ? 'email' : 'text'} required autoComplete="username" autoCapitalize="none" spellCheck="false" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} placeholder={registering ? 'tu.correo@ejemplo.edu.ec' : 'Tu correo o admin'} /></label>
      <label htmlFor="auth-password">Contraseña</label><div className="auth-password"><input id="auth-password" type={showPassword ? 'text' : 'password'} required minLength={registering ? 6 : undefined} autoComplete={registering ? 'new-password' : 'current-password'} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} placeholder={registering ? 'Al menos 6 caracteres' : 'Tu contraseña'} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
      {registering && <p className="auth-registration-note"><CheckCircle2 size={17} /><span>El personal validará tu solicitud antes de habilitar Reservas. Las cuentas de personal y administrador se asignan por el responsable de LABFIS.</span></p>}
      {error && <div className="message error" role="alert">{error}</div>}{message && <div className="message success" role="status">{message}</div>}
      <button type="submit" className="auth-submit" disabled={busy || !isConfigured}>{busy ? 'Procesando…' : registering ? 'Solicitar cuenta' : 'Ingresar'}</button>
    </form><p className="auth-form-footer">{registering ? 'El tipo solicitado no concede permisos automáticamente.' : '¿Necesitas autorización para Reservas? Contacta al personal de LABFIS.'}</p>
  </div></section></main>
}
