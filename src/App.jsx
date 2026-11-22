import {useCallback,useEffect,useRef,useState} from 'react'
import {LayoutDashboard,Printer,PackageSearch,Laptop,Wrench,KeyRound,CalendarDays,DoorOpen,QrCode,ChartColumn,LogOut,Menu,X,Database,Code2,ShieldCheck} from 'lucide-react'
import {modules} from './modules/config'
import {supabase,isConfigured} from './lib/supabase'
import Auth from './components/Auth'
import PrintingDemo from './modules/PrintingDemo'
import StudentModule from './modules/StudentModule'
import Reservas from './modules/Reservas'
import Gestion from './modules/Gestion'
import { createReservasApi } from './lib/reservasApi'
import { canManageProducts, displayAccount } from './lib/gestionApi'
import { useRequest } from './lib/useRequest'
const icons={'package-search':PackageSearch,'laptop':Laptop,'wrench':Wrench,'key-round':KeyRound,'calendar-days':CalendarDays,'door-open':DoorOpen,'qr-code':QrCode,'chart-column':ChartColumn}
function Workspace({session,onSignOut,signingOut,signOutError}){const [active,setActive]=useState('home'),[menuOpen,setMenuOpen]=useState(false)
const [permissionsRevision,setPermissionsRevision]=useState(0)
const permissions=useRequest(()=>createReservasApi(supabase).profile(session.user.id),[session.user.id,permissionsRevision])
const canManage=permissions.data?.autorizado&&canManageProducts(permissions.data?.rol)
const choose=id=>{setActive(id);setMenuOpen(false)}
return <div className="app"><aside className={'sidebar '+(menuOpen?'show':'')}><div className="brand"><span className="brand-mark">L</span><span><b>LABFIS</b><small>Gestión de laboratorios</small></span></div><nav><button className={active==='home'?'nav active':'nav'} onClick={()=>choose('home')}><LayoutDashboard size={18}/>Inicio</button><div className="nav-label">MÓDULOS</div>{modules.map(m=>{const Icon=icons[m.icon];return <button key={m.id} className={active===m.id?'nav active':'nav'} onClick={()=>choose(m.id)}><Icon size={18}/><span>{m.name}</span></button>})}{canManage&&<><div className="nav-label">GESTIÓN</div><button className={active==='gestion'?'nav active':'nav'} onClick={()=>choose('gestion')}><ShieldCheck size={18}/>Gestión del laboratorio</button></>}<div className="nav-label">DEMOSTRACIÓN</div><button className={active==='demo'?'nav active':'nav'} onClick={()=>choose('demo')}><Printer size={18}/>Impresión 3D</button></nav><div className="sidebar-foot">Proyecto académico · datos de prueba</div></aside>{menuOpen&&<button className="scrim" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>}
<main className="main"><header className="topbar"><button className="menu-toggle" aria-label="Abrir menú" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button><div><strong>LABFIS</strong><span className="top-sub"> · Sistema modular</span></div><div className="right"><span className={'pill '+(isConfigured?'ok':'')}>{isConfigured?'Supabase configurado':'Modo sin conexión'}</span><span className="session-email">{displayAccount(session.user.email)}</span><button className="secondary small" disabled={signingOut} onClick={onSignOut}><LogOut size={15}/>{signingOut?'Saliendo…':'Salir'}</button></div></header><div className="content">{signOutError&&<div className="message error workspace-error" role="alert">{signOutError}</div>}
{active==='home'&&<><div className="hero"><div className="eyebrow">PLANTILLA BASE · INGENIERÍA DE SOFTWARE II</div><h1>Un sistema. Ocho módulos.<br/><span>Un mismo estándar.</span></h1><p>Del prototipo a un incremento verificable: implementa tus historias de usuario, conecta PostgreSQL y ejecuta tus pruebas de aceptación.</p><div className="hero-actions"><button onClick={()=>choose('demo')}>Ver ejemplo funcional →</button><button className="secondary" onClick={()=>choose('objetos')}>Explorar módulos</button></div></div><div className="stats"><div><Code2/><b>React + Vite</b><span>Frontend común</span></div><div><Database/><b>Supabase</b><span>PostgreSQL + Auth</span></div><div><ShieldCheck/><b>RLS</b><span>Registros protegidos</span></div></div><h2 className="section-title">Módulos del proyecto</h2><div className="module-grid">{modules.map(m=>{const Icon=icons[m.icon];return <button key={m.id} className="module-card" onClick={()=>choose(m.id)}><span className="icon-box"><Icon size={21}/></span><span className="module-no">MÓDULO {m.number}</span><strong>{m.name}</strong><span className="module-summary">{m.summary}</span><span className="module-link">Abrir módulo →</span></button>})}</div></>}
{active==='gestion'&&<Gestion session={session} onPermissionsChanged={()=>setPermissionsRevision(v=>v+1)}/>}{active==='demo'&&<PrintingDemo session={session}/>}{active==='reservas'&&<Reservas key={session?.user?.id || 'anon'} session={session}/>}{active!=='reservas'&&modules.some(m=>m.id===active)&&<StudentModule module={modules.find(m=>m.id===active)}/>}
</div><footer>LABFIS · Proyecto de aprendizaje · No ingresar datos personales reales</footer></main></div>
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(isConfigured)
  const [sessionError, setSessionError] = useState('')
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [retry, setRetry] = useState(0)
  const authVersion = useRef(0)
  const acceptSession = useCallback(next => {
    authVersion.current += 1
    setSession(next)
    setChecking(false)
    setSessionError('')
    setSignOutError('')
  }, [])
  useEffect(() => {
    if (!supabase || !isConfigured) { setChecking(false); return }
    let mounted = true
    const version = authVersion.current
    setChecking(true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) acceptSession(next)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      // Un resultado antiguo nunca reemplaza un login o logout más reciente.
      if (!mounted || authVersion.current !== version) return
      if (error) throw error
      acceptSession(data?.session || null)
    }).catch(() => {
      if (mounted && authVersion.current === version) {
        setSession(null)
        setSessionError('No se pudo comprobar tu sesión. Reintenta o inicia sesión nuevamente.')
        setChecking(false)
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [acceptSession, retry])
  async function signOut() {
    if (signingOut) return
    setSigningOut(true); setSignOutError('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      acceptSession(null)
    } catch {
      setSignOutError('No se pudo cerrar la sesión. Comprueba tu conexión y vuelve a intentarlo.')
    } finally { setSigningOut(false) }
  }
  if (checking) return <main className="session-check" role="status"><strong>SIGELAB</strong><span>Comprobando sesión…</span></main>
  if (!session) return <Auth onAuthenticated={acceptSession} sessionError={sessionError} onRetry={() => setRetry(value => value + 1)} />
  return <Workspace key={session.user.id} session={session} onSignOut={signOut} signingOut={signingOut} signOutError={signOutError} />
}
