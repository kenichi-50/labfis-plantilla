import { useRef, useState } from 'react'
import { Plus, RefreshCw, ShieldCheck, Package, Pencil, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRequest } from '../lib/useRequest'
import { createReservasApi, ROLE_LABELS, EQUIPMENT_TYPES, reservationError } from '../lib/reservasApi'
import { createGestionApi, canManageAccounts, canManageProducts, displayAccount, productPayload } from '../lib/gestionApi'
import './gestion.css'
const api = createGestionApi(supabase)
const profiles = createReservasApi(supabase)
const initialProduct = { name: '', type: 'PROYECTOR', quantity: 1, codes: '', from: '', until: '', roles: ['ESTUDIANTE', 'DOCENTE'], enabled: true }
function Failure({ error, retry }) { return <div className="message error" role="alert"><p>{reservationError(error)}</p>{retry && <button type="button" className="secondary small" onClick={retry}>Reintentar</button>}</div> }
function Pager({ page, total, count, onPage }) { return <div className="reservas-pagination"><span>Página {page}{count ? ` · ${total} cuentas` : ''}</span><div><button className="secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><button className="secondary small" disabled={!count || page * 20 >= total} onClick={() => onPage(page + 1)}>Siguiente</button></div></div> }

function AccountEditor({ account, onClose, onSaved }) {
  const [name, setName] = useState(account.nombre || account.nombre_solicitado || displayAccount(account.correo) || '')
  const [role, setRole] = useState(account.rol || (['ESTUDIANTE', 'DOCENTE'].includes(account.tipo_solicitado) ? account.tipo_solicitado : 'ESTUDIANTE'))
  const [authorized, setAuthorized] = useState(account.autorizado)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const lock = useRef(false)
  async function save(event) {
    event.preventDefault(); if (lock.current) return
    if (!name.trim()) { setError(new Error('Ingresa el nombre validado de la cuenta.')); return }
    lock.current = true; setBusy(true); setError(null)
    try { await api.saveAccount({ p_usuario_id: account.usuario_id, p_nombre: name.trim(), p_rol: role, p_autorizado: authorized }); onSaved() }
    catch (failure) { setError(failure) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="panel gestion-editor"><div className="reservas-section-heading"><h3>Revisar cuenta</h3><button type="button" className="secondary small" disabled={busy} onClick={onClose} aria-label="Cerrar revisión"><X size={16} /></button></div>
    <p><strong>{displayAccount(account.correo)}</strong></p><p className="hint">Tipo solicitado: {ROLE_LABELS[account.tipo_solicitado] || 'Sin solicitud'}. Valida la identidad antes de asignar el rol.</p>
    {!account.correo_confirmado && <p className="notice">La cuenta debe confirmar su correo antes de ser autorizada.</p>}
    <form aria-label="Revisión de cuenta" onSubmit={save}><label>Nombre validado<input required maxLength="200" value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
      <label>Rol asignado<select value={role} disabled={busy} onChange={e => setRole(e.target.value)}>{Object.entries(ROLE_LABELS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      <label className="gestion-check"><input type="checkbox" checked={authorized} disabled={busy || !account.correo_confirmado} onChange={e => setAuthorized(e.target.checked)} /> Autorizar acceso a Reservas</label>
      {error && <Failure error={error} />}<div className="reservas-inline-actions"><button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar permisos'}</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>Volver</button></div>
    </form>
  </section>
}

function Accounts({ onPermissionsChanged }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('PENDIENTES')
  const [query, setQuery] = useState({ search: '', status: 'PENDIENTES' })
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [target, setTarget] = useState(null)
  const [success, setSuccess] = useState('')
  const request = useRequest(() => api.accounts({ p_busqueda: query.search || null, p_estado: query.status, p_pagina: page, p_tamano: 20 }), [query, page, revision])
  const rows = request.data || []
  function saved() { setTarget(null); setSuccess('Permisos actualizados. La cuenta puede comprobar su autorización o recargar la página.'); setRevision(v => v + 1); onPermissionsChanged() }
  return <>
    <section className="panel"><div className="reservas-section-heading"><h3>Autorización de cuentas</h3><button className="secondary small" disabled={request.loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={14} /> Actualizar</button></div>
      <form onSubmit={event => { event.preventDefault(); setQuery({ search: search.trim(), status }); setPage(1); setTarget(null) }}><div className="gestion-filter-grid"><label>Buscar cuenta<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o correo" /></label><label>Estado de autorización<select value={status} onChange={e => setStatus(e.target.value)}><option value="PENDIENTES">Pendientes</option><option value="AUTORIZADAS">Autorizadas</option><option value="TODAS">Todas las cuentas</option></select></label></div><div><button type="submit" disabled={request.loading}>Buscar cuentas</button></div></form>
      {success && <p className="message success" role="status">{success}</p>}
      {request.loading ? <p role="status">Cargando cuentas…</p> : request.error ? <Failure error={request.error} retry={() => setRevision(v => v + 1)} /> : <><div className="table-wrap"><table><caption className="reservas-sr-only">Cuentas registradas y autorización</caption><thead><tr><th>Cuenta</th><th>Tipo solicitado</th><th>Rol efectivo</th><th>Acceso</th><th>Acciones</th></tr></thead><tbody>{rows.length ? rows.map(account => <tr key={account.usuario_id}><td><strong>{account.nombre || account.nombre_solicitado || 'Sin nombre'}</strong><small className="gestion-secondary">{displayAccount(account.correo)}</small>{!account.correo_confirmado && <small className="gestion-secondary">Correo sin confirmar</small>}</td><td>{ROLE_LABELS[account.tipo_solicitado] || 'Sin solicitud'}</td><td>{ROLE_LABELS[account.rol] || 'Sin asignar'}</td><td>{account.autorizado ? 'Autorizado' : 'Pendiente'}</td><td><button className="secondary small" onClick={() => { setTarget(account); setSuccess('') }}>Revisar</button></td></tr>) : <tr><td className="empty" colSpan="5">No hay cuentas que coincidan con los filtros.</td></tr>}</tbody></table></div><Pager page={page} total={Number(rows[0]?.total || 0)} count={rows.length} onPage={value => { setPage(value); setTarget(null) }} /></>}
    </section>{target && <AccountEditor key={target.usuario_id} account={target} onClose={() => setTarget(null)} onSaved={saved} />}
  </>
}

function ProductEditor({ product, onClose, onSaved }) {
  const activeUnits = product?.unidades?.filter(unit => unit.habilitado) || []
  const [draft, setDraft] = useState(product ? { name: product.nombre, type: product.tipo, quantity: activeUnits.length || 1, codes: activeUnits.map(unit => unit.codigo_inventario).join('\n'), from: product.disponible_desde || '', until: product.disponible_hasta || '', roles: product.roles_permitidos, enabled: product.habilitado } : initialProduct)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const lock = useRef(false)
  function change(field, value) { setDraft(current => ({ ...current, [field]: value })) }
  function toggle(role) { change('roles', draft.roles.includes(role) ? draft.roles.filter(value => value !== role) : [...draft.roles, role]) }
  async function save(event) {
    event.preventDefault(); if (lock.current) return
    setError(null)
    try {
      const params = productPayload(draft, product?.id || null)
      lock.current = true; setBusy(true)
      await api.saveProduct(params)
      onSaved()
    } catch (failure) { setError(failure) }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="panel gestion-editor"><div className="reservas-section-heading"><h3>{product ? 'Editar producto' : 'Registrar producto'}</h3><button type="button" className="secondary small" disabled={busy} onClick={onClose} aria-label="Cerrar producto"><X size={16} /></button></div>
    <form aria-label="Datos del producto" onSubmit={save}><div className="gestion-filter-grid"><label>Nombre del producto<input required maxLength="200" disabled={busy} value={draft.name} onChange={e => change('name', e.target.value)} /></label><label>Tipo de producto<select disabled={busy} value={draft.type} onChange={e => change('type', e.target.value)}>{EQUIPMENT_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      <label>Cantidad de unidades<input type="number" min="1" max="500" step="1" required disabled={busy} value={draft.quantity} onChange={e => change('quantity', e.target.value)} /></label>
      <label>Códigos de inventario<textarea rows="4" required disabled={busy} value={draft.codes} onChange={e => change('codes', e.target.value)} placeholder={'Un código por unidad, en cada línea\nLAB-001\nLAB-002'} /></label><p className="hint">La cantidad debe coincidir con los códigos. Cada unidad se reserva por separado; al retirar un código se conserva su historial.</p>
      <div className="gestion-filter-grid"><label>Disponible desde<input type="date" required disabled={busy} value={draft.from} onChange={e => change('from', e.target.value)} /></label><label>Disponible hasta<input type="date" required disabled={busy} value={draft.until} onChange={e => change('until', e.target.value)} /></label></div><p className="hint">Ambas fechas están incluidas, en horario de Ecuador.</p>
      <fieldset disabled={busy} className="gestion-roles"><legend>Roles que pueden reservar</legend>{Object.entries(ROLE_LABELS).map(([id, label]) => <label className="gestion-check" key={id}><input type="checkbox" checked={draft.roles.includes(id)} onChange={() => toggle(id)} />{label}</label>)}</fieldset>
      <label className="gestion-check"><input type="checkbox" disabled={busy} checked={draft.enabled} onChange={e => change('enabled', e.target.checked)} />Producto habilitado para reservas</label>
      {error && <Failure error={error} />}<div className="reservas-inline-actions"><button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>Volver</button></div>
    </form>
  </section>
}

function Products() {
  const [revision, setRevision] = useState(0)
  const [target, setTarget] = useState(null)
  const [success, setSuccess] = useState('')
  const request = useRequest(() => api.products(), [revision])
  const rows = request.data || []
  return <><section className="panel"><div className="reservas-section-heading"><h3>Productos del laboratorio</h3><div className="reservas-inline-actions"><button type="button" className="secondary small" disabled={request.loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={14} />Actualizar</button><button type="button" onClick={() => { setTarget({ new: true }); setSuccess('') }}><Plus size={16} />Nuevo producto</button></div></div>
    <p className="muted">Define unidades, fechas de disponibilidad y perfiles autorizados para reservar.</p>{success && <p className="message success" role="status">{success}</p>}
    {request.loading ? <p role="status">Cargando productos…</p> : request.error ? <Failure error={request.error} retry={() => setRevision(v => v + 1)} /> : <div className="table-wrap"><table><caption className="reservas-sr-only">Catálogo de productos</caption><thead><tr><th>Producto</th><th>Cantidad</th><th>Disponibilidad</th><th>Roles permitidos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.length ? rows.map(product => <tr key={product.id}><td><strong>{product.nombre}</strong><small className="gestion-secondary">{EQUIPMENT_TYPES.find(([id]) => id === product.tipo)?.[1] || product.tipo}</small></td><td>{product.unidades.filter(unit => unit.habilitado).length} unidades</td><td>{product.disponible_desde ? `${product.disponible_desde} — ${product.disponible_hasta}` : 'Sin límite de fechas'}</td><td>{product.roles_permitidos.map(role => ROLE_LABELS[role]).join(', ')}</td><td>{product.habilitado ? 'Habilitado' : 'No habilitado'}</td><td><button className="secondary small" onClick={() => { setTarget(product); setSuccess('') }}><Pencil size={14} />Editar producto</button></td></tr>) : <tr><td className="empty" colSpan="6">Todavía no hay productos. Registra el primero para habilitar sus unidades.</td></tr>}</tbody></table></div>}
  </section>{target && <ProductEditor key={target.id || 'new'} product={target.new ? null : target} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); setSuccess('Producto guardado. Las unidades y condiciones se aplican a las nuevas consultas de disponibilidad.'); setRevision(v => v + 1) }} />}</>
}

export default function Gestion({ session, onPermissionsChanged = () => {} }) {
  const [tab, setTab] = useState('products')
  const [revision, setRevision] = useState(0)
  const profile = useRequest(() => profiles.profile(session.user.id), [session.user.id, revision])
  const allowed = profile.data?.autorizado && canManageProducts(profile.data?.rol)
  return <div className="module-page reservas-module gestion-module"><div className="reservas-heading"><div><div className="eyebrow">SIGELAB · ADMINISTRACIÓN</div><h2>Gestión del laboratorio</h2><p className="muted">Organiza el catálogo y los permisos de acceso de LABFIS.</p></div><span className="icon-box"><ShieldCheck size={23} /></span></div>
    {profile.loading ? <p className="panel" role="status">Comprobando permisos…</p> : profile.error ? <Failure error={profile.error} retry={() => setRevision(v => v + 1)} /> : !allowed ? <p className="notice" role="alert">Tu cuenta no tiene autorización para gestionar el laboratorio.</p> : <>
      <div className="tabs" aria-label="Secciones de gestión"><button className={tab === 'products' ? 'active' : ''} aria-pressed={tab === 'products'} onClick={() => setTab('products')}><Package size={15} /> Productos</button>{canManageAccounts(profile.data.rol) && <button className={tab === 'accounts' ? 'active' : ''} aria-pressed={tab === 'accounts'} onClick={() => setTab('accounts')}>Cuentas y roles</button>}</div>
      {tab === 'accounts' && canManageAccounts(profile.data.rol) ? <Accounts onPermissionsChanged={() => { setRevision(v => v + 1); onPermissionsChanged() }} /> : <Products />}
    </>}
  </div>
}
