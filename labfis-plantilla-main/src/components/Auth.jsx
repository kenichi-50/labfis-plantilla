import {useState} from 'react'
import {supabase} from '../lib/supabase'
export default function Auth(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  async function run(mode){
    if(!email || password.length<6){setMessage('Ingresa un correo y una contraseña de al menos 6 caracteres.');return}
    setBusy(true); setMessage('')
    try{
      const {data,error}=mode==='register' ? await supabase.auth.signUp({email,password}) : await supabase.auth.signInWithPassword({email,password})
      if(error) throw error
      if(mode==='register' && !data.session) setMessage('Cuenta creada. Revisa el correo de confirmación antes de ingresar.')
      else setMessage('Acceso correcto.')
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  return <div className="auth-card"><div className="eyebrow">ACCESO DE PRUEBAS</div><h2>Ingresa para guardar datos en PostgreSQL</h2><p>Usa tu propia cuenta. No compartas contraseñas con tu equipo.</p><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="estudiante@ejemplo.edu.ec"/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" placeholder="Mínimo 6 caracteres"/></label><div className="button-row"><button disabled={busy} onClick={()=>run('login')}>Ingresar</button><button className="secondary" disabled={busy} onClick={()=>run('register')}>Crear cuenta</button></div>{message&&<div className="message" role="status">{message}</div>}<div className="hint">Si está habilitada la confirmación por correo en Supabase, debes confirmar tu dirección antes de ingresar.</div></div>
}
