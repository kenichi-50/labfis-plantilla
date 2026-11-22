import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Search, RefreshCw, Clock3, CheckCircle2, X, Pencil, Ban, Laptop } from 'lucide-react'
import { supabase, isConfigured } from '../lib/supabase'
import { buildPeriod, periodFields, formatPeriod, reservationError, createReservasApi, EQUIPMENT_TYPES, ROLE_LABELS, canReserve, canViewHistory, isKnownRole } from '../lib/reservasApi'
import { useRequest } from '../lib/useRequest'
import './reservas.css'

const api = createReservasApi(supabase)
const emptyPeriod = { date: '', start: '', end: '' }
const emptyFilters = { equipment: '', requester: '', from: '', until: '', status: '' }

function ErrorNotice({ error, onRetry }) {
  return <div className="message error" role="alert"><p>{reservationError(error)}</p>{onRetry && <button type="button" className="secondary small" onClick={onRetry}><RefreshCw size={14} /> Reintentar</button>}</div>
}

function PeriodInputs({ value, onChange, disabled = false }) {
  return <div className="reservas-period-fields">
    <label>Fecha<input type="date" required value={value.date} disabled={disabled} onChange={e => onChange({ ...value, date: e.target.value })} /></label>
    <label>Hora inicial<input type="time" required step="60" value={value.start} disabled={disabled} onChange={e => onChange({ ...value, start: e.target.value })} /></label>
    <label>Hora final<input type="time" required step="60" value={value.end} disabled={disabled} onChange={e => onChange({ ...value, end: e.target.value })} /></label>
  </div>
}

function Status({ state }) {
  return <span className={`reservas-status ${state === 'ACTIVA' ? 'is-active' : 'is-cancelled'}`}>{state === 'ACTIVA' ? 'Activa' : 'Cancelada'}</span>
}

function Dialog({ title, onClose, busy, children }) {
  const ref = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus?.() }
  }, [])
  function onKeyDown(event) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); close.current() }
    if (event.key === 'Tab') {
      const elements = Array.from(ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'))
      const first = elements[0], last = elements.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus() }
    }
  }
  return createPortal(<div className="reservas-overlay"><section ref={ref} className="reservas-dialog" role="dialog" aria-modal="true" aria-labelledby="reservas-dialog-title" tabIndex="-1" onKeyDown={onKeyDown}>
    <div className="reservas-dialog-heading"><h2 id="reservas-dialog-title">{title}</h2><button type="button" className="secondary small" aria-label="Cerrar diálogo" disabled={busy} onClick={onClose}><X size={18} /></button></div>
    {children}
  </section></div>, document.body)
}

function ReservationDialog({ selection, onClose, onSaved, onConflict }) {
  const { mode, row, equipment, period } = selection
  const originalStart = row && periodFields(row.inicio)
  const [draft, setDraft] = useState(originalStart ? { date: originalStart.date, start: originalStart.time, end: periodFields(row.fin).time } : emptyPeriod)
  const [activity, setActivity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submitting = useRef(false)
  const title = mode === 'create' ? 'Confirmar reserva' : mode === 'modify' ? 'Modificar reserva' : 'Cancelar reserva'
  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    setError(null)
    try {
      let nextPeriod
      if (mode === 'modify') nextPeriod = buildPeriod(draft)
      if (mode === 'create' && !activity.trim()) throw new Error('Describe la actividad académica para la que necesitas el equipo.')
      submitting.current = true
      setBusy(true)
      const saved = mode === 'create'
        ? await api.create({ p_equipo_id: equipment.equipo_id, ...period, p_actividad: activity.trim() })
        : mode === 'modify' ? await api.modify(row.id, nextPeriod) : await api.cancel(row.id)
      onSaved(saved, mode)
      onClose()
    } catch (failure) {
      setError(failure)
      if (failure.code === '23P01') onConflict()
    } finally { submitting.current = false; setBusy(false) }
  }
  return <Dialog title={title} onClose={onClose} busy={busy}><form onSubmit={submit} className="reservas-dialog-form">
    <div className="reservas-summary"><strong>{equipment?.nombre || row.equipo_nombre}</strong><span>{equipment?.codigo_inventario || row.codigo_inventario}</span>
      <span><Clock3 size={14} /> {formatPeriod(period?.p_inicio || row.inicio, period?.p_fin || row.fin)}</span>
      {row && <code>{row.id}</code>}
    </div>
    {mode === 'create' && <><label>Actividad académica<textarea required maxLength="500" rows="4" autoComplete="off" disabled={busy} value={activity} onChange={e => setActivity(e.target.value)} placeholder="Ej.: presentación del proyecto de Ingeniería de Software" /></label><p className="hint">La disponibilidad se comprobará nuevamente al confirmar la reserva.</p></>}
    {mode === 'modify' && <><PeriodInputs value={draft} onChange={setDraft} disabled={busy} /><p className="hint">El identificador se conserva. Si el nuevo horario está ocupado, tu reserva original se mantiene.</p></>}
    {mode === 'cancel' && <p>¿Confirmas que quieres cancelar esta reserva? El equipo quedará disponible y el registro se conservará en el historial.</p>}
    {error && <ErrorNotice error={error} />}
    <div className="reservas-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Volver</button><button type="submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'create' ? 'Confirmar reserva' : mode === 'modify' ? 'Guardar cambios' : 'Sí, cancelar reserva'}</button></div>
  </form></Dialog>
}

function Availability({ allowBooking, version, onSelect, equipment, role }) {
  const [draft, setDraft] = useState({ ...emptyPeriod, type: '', search: '' })
  const [query, setQuery] = useState(null)
  const [validation, setValidation] = useState(null)
  const [retry, setRetry] = useState(0)
  const request = useRequest(() => api.availability(query.params), [query, version, retry], Boolean(query))
  const items = request.data || []
  function change(next) { setDraft(next); setQuery(null); setValidation(null) }
  function search(event) {
    event.preventDefault()
    try {
      const period = buildPeriod(draft)
      setValidation(null)
      setQuery({ period, params: { ...period, p_tipo: draft.type || null, p_busqueda: draft.search.trim() || null } })
    } catch (failure) { setQuery(null); setValidation(failure) }
  }
  return <>
    <section className="panel"><h3>Encuentra un equipo disponible</h3><p className="muted">Selecciona el día y el horario de tu actividad. Cada resultado corresponde a un equipo físico.</p>
      <form onSubmit={search}><PeriodInputs value={draft} onChange={period => change({ ...draft, ...period })} />
        <div className="reservas-filter-row"><label>Tipo de equipo<select value={draft.type} onChange={e => change({ ...draft, type: e.target.value })}><option value="">Todos los tipos</option>{EQUIPMENT_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Buscar por nombre o código<input type="search" value={draft.search} onChange={e => change({ ...draft, search: e.target.value })} placeholder="Ej.: proyector o LAB-001" /></label></div>
        <div><button type="submit" disabled={request.loading}><Search size={16} /> {request.loading ? 'Consultando…' : 'Consultar disponibilidad'}</button></div>
      </form>{validation && <ErrorNotice error={validation} />}
    </section>
    <section className="panel" aria-busy={request.loading}><div className="reservas-section-heading"><h3>Equipos</h3>{query && !request.loading && !request.error && <span className="hint">{items.filter(item => item.disponible).length} disponibles de {items.length} · hora de Ecuador</span>}</div>
      {!query ? <p className="reservas-empty"><CalendarDays size={28} /> Consulta un período para ver la disponibilidad.</p>
        : request.loading ? <p className="reservas-empty" role="status">Comprobando disponibilidad…</p>
        : request.error ? <ErrorNotice error={request.error} onRetry={() => setRetry(value => value + 1)} />
        : !items.length ? <p className="reservas-empty">No se encontraron equipos con esos filtros. Prueba otro nombre o tipo.</p>
        : <>{!items.some(item => item.disponible) && <p className="notice" role="status">No hay equipos disponibles para este período. Prueba otro horario o revisa los filtros.</p>}<div className="reservas-equipment-grid">{items.map(item => { const product = equipment.find(unit => unit.id === item.equipo_id)?.producto; const roles = product?.roles_permitidos || ['ESTUDIANTE', 'DOCENTE']; return <article className="reservas-equipment-card" key={item.equipo_id}>
          <div className="reservas-card-top"><span className="icon-box"><Laptop size={20} /></span><span className={`reservas-status ${item.disponible ? 'is-active' : 'is-cancelled'}`}>{item.disponible ? 'Disponible' : !item.habilitado ? 'No habilitado' : 'No disponible'}</span></div>
          <h4>{item.nombre}</h4><code>{item.codigo_inventario}</code><p>{EQUIPMENT_TYPES.find(([id]) => id === item.tipo)?.[1] || item.tipo}</p>
          {product && <p>Disponibilidad: {product.disponible_desde || 'sin límite'} — {product.disponible_hasta || 'sin límite'}</p>}<p>Reservan: {roles.map(value => ROLE_LABELS[value]).join(', ')}</p>{allowBooking && roles.includes(role) && <button type="button" disabled={!item.disponible} onClick={() => onSelect({ mode: 'create', equipment: item, period: query.period })}>Reservar equipo</button>}
        </article>})}</div></>}
    </section>
  </>
}

function ReservationList({ history, equipment, version, onSelect }) {
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [validation, setValidation] = useState(null)
  const users = useRequest(() => api.users(), [], history)
  const request = useRequest(() => api.list({
    p_historial: history, p_equipo_id: filters.equipment || null, p_solicitante_id: history ? filters.requester || null : null,
    p_desde: filters.from || null, p_hasta: filters.until || null, p_estado: filters.status || null, p_pagina: page, p_tamano: 10,
  }), [history, filters, page, version, retry])
  const items = request.data || []
  const total = Number(items[0]?.total || 0)
  const pages = Math.max(1, Math.ceil(total / 10))
  function apply(event) {
    event.preventDefault()
    if (draft.from && draft.until && draft.from > draft.until) { setValidation(new Error('La fecha final del filtro no puede ser anterior a la inicial.')); return }
    setValidation(null); setFilters({ ...draft }); setPage(1)
  }
  return <section className="panel" aria-busy={request.loading}><div className="reservas-section-heading"><h3>{history ? 'Historial general de reservas' : 'Mis reservas'}</h3><button type="button" className="secondary small" disabled={request.loading} onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} /> Actualizar</button></div>
    <form onSubmit={apply} className="reservas-list-filters"><div className="reservas-filter-grid">
      <label>Equipo<select value={draft.equipment} onChange={e => setDraft({ ...draft, equipment: e.target.value })}><option value="">Todos los equipos</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.codigo_inventario}</option>)}</select></label>
      {history && <label>Solicitante<select value={draft.requester} disabled={users.loading || Boolean(users.error)} onChange={e => setDraft({ ...draft, requester: e.target.value })}><option value="">Todos los solicitantes</option>{(users.data || []).map(user => <option key={user.usuario_id} value={user.usuario_id}>{user.nombre} · {ROLE_LABELS[user.rol]}</option>)}</select></label>}
      <label>Desde<input type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label><label>Hasta<input type="date" value={draft.until} onChange={e => setDraft({ ...draft, until: e.target.value })} /></label>
      <label>Estado<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="">Todos los estados</option><option value="ACTIVA">Activa</option><option value="CANCELADA">Cancelada</option></select></label>
    </div><div className="reservas-inline-actions"><button type="submit" disabled={request.loading}>Aplicar filtros</button><button type="button" className="secondary" onClick={() => { setDraft(emptyFilters); setFilters({ ...emptyFilters }); setPage(1); setValidation(null) }}>Limpiar filtros</button></div></form>
    {validation && <ErrorNotice error={validation} />}{history && users.error && <ErrorNotice error={new Error('No se pudo cargar el selector de solicitantes. Puedes consultar el historial o reintentar al volver a abrir esta pestaña.')} />}
    {request.loading ? <p className="reservas-empty" role="status">Cargando reservas…</p> : request.error ? <ErrorNotice error={request.error} onRetry={() => setRetry(value => value + 1)} /> : <>
      <div className="table-wrap"><table className="reservas-table"><caption className="reservas-sr-only">{history ? 'Reservas de estudiantes y docentes' : 'Reservas de tu cuenta'} — horarios de Ecuador</caption><thead><tr><th>Reserva</th>{history && <th>Solicitante</th>}<th>Equipo</th><th>Fecha y horario</th><th>Actividad</th><th>Estado</th>{!history && <th>Acciones</th>}</tr></thead>
      <tbody>{items.length ? items.map(row => <tr key={row.id}><td><code className="reservas-id">{row.id}</code></td>{history && <td>{row.solicitante_nombre}<small>{ROLE_LABELS[row.solicitante_rol]}</small></td>}<td><strong>{row.equipo_nombre}</strong><small>{row.codigo_inventario}</small></td><td>{formatPeriod(row.inicio, row.fin)}</td><td className="reservas-activity">{row.actividad}</td><td><Status state={row.estado} /></td>{!history && <td>{row.estado === 'ACTIVA' ? <div className="reservas-row-actions"><button type="button" className="secondary small" onClick={() => onSelect({ mode: 'modify', row })}><Pencil size={13} /> Modificar</button><button type="button" className="secondary small" onClick={() => onSelect({ mode: 'cancel', row })}><Ban size={13} /> Cancelar</button></div> : <span className="muted">Sin acciones</span>}</td>}</tr>) : <tr><td colSpan={7} className="empty">{page > 1 ? 'Esta página ya no tiene resultados. Vuelve a la página anterior.' : history ? 'No hay reservas que coincidan con los filtros.' : 'No tienes reservas que coincidan con los filtros.'}</td></tr>}</tbody></table></div>
      <div className="reservas-pagination"><span>{items.length ? `${total} reservas · página ${page} de ${pages}` : `Página ${page}`} · hora de Ecuador</span><div><button type="button" className="secondary small" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button type="button" className="secondary small" disabled={!items.length || page >= pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></div>
    </>}
  </section>
}

export default function Reservas({ session }) {
  const [tab, setTab] = useState('availability')
  const [retry, setRetry] = useState(0)
  const [version, setVersion] = useState(0)
  const [selection, setSelection] = useState(null)
  const [success, setSuccess] = useState(null)
  const profile = useRequest(() => api.profile(session.user.id), [session?.user?.id, retry], Boolean(isConfigured && session))
  const authorized = Boolean(profile.data?.autorizado && isKnownRole(profile.data?.rol))
  const catalog = useRequest(() => api.equipment(), [session?.user?.id, retry], authorized)
  const role = profile.data?.rol
  function onSaved(row, mode) { setSuccess({ row, mode }); setVersion(value => value + 1) }
  const equipment = catalog.data || []
  return <div className="module-page reservas-module"><div className="reservas-heading"><div><div className="eyebrow">SIGELAB · MÓDULO 05</div><h2>Reserva de equipos</h2><p className="muted">Encuentra el equipo que necesitas y organiza tu próxima actividad académica.</p></div><span className="icon-box"><CalendarDays size={23} /></span></div>
    {!isConfigured ? <div className="notice" role="status">La conexión con el servicio aún no está configurada. Contacta al responsable del laboratorio.</div>
      : !session ? <div className="notice" role="status">Inicia sesión con tu cuenta para consultar disponibilidad y gestionar tus reservas. El formulario de acceso está debajo.</div>
      : profile.loading ? <p className="panel" role="status">Verificando tu autorización…</p>
      : profile.error ? <ErrorNotice error={profile.error} onRetry={() => setRetry(value => value + 1)} />
      : !authorized ? <div className="panel"><h3>Cuenta pendiente de autorización</h3><p>Tu sesión está iniciada, pero necesitas autorización de LABFIS para utilizar este módulo. Solicítala al personal del laboratorio.</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} /> Comprobar autorización</button></div>
      : <><div className="reservas-account"><span><CheckCircle2 size={17} /> {profile.data.nombre}</span><span>{ROLE_LABELS[role]}</span></div>
        <div className="tabs" role="tablist" aria-label="Secciones de reservas"><button id="reservas-tab-availability" role="tab" aria-controls="reservas-tab-panel" aria-selected={tab === 'availability'} className={tab === 'availability' ? 'active' : ''} onClick={() => setTab('availability')}>Disponibilidad</button>{canReserve(role) && <button id="reservas-tab-own" role="tab" aria-controls="reservas-tab-panel" aria-selected={tab === 'own'} className={tab === 'own' ? 'active' : ''} onClick={() => setTab('own')}>Mis reservas</button>}{canViewHistory(role) && <button id="reservas-tab-history" role="tab" aria-controls="reservas-tab-panel" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historial general</button>}</div>
        {success && <div className="message success" role="status"><div className="reservas-section-heading"><strong>{success.mode === 'create' ? 'Reserva confirmada' : success.mode === 'modify' ? 'Reserva modificada' : 'Reserva cancelada'}</strong><button type="button" className="secondary small" aria-label="Cerrar confirmación" onClick={() => setSuccess(null)}><X size={14} /></button></div><p><code className="reservas-id">{success.row.id}</code></p><p>{equipment.find(item => item.id === success.row.equipo_id)?.nombre || 'Equipo reservado'} · {formatPeriod(success.row.inicio, success.row.fin)}</p><Status state={success.row.estado} /></div>}
        {catalog.error && <ErrorNotice error={catalog.error} onRetry={() => setRetry(value => value + 1)} />}
        <div id="reservas-tab-panel" role="tabpanel" aria-labelledby={`reservas-tab-${tab}`}>
          {tab === 'availability' ? <Availability equipment={equipment} role={role} allowBooking={canReserve(role)} version={version} onSelect={setSelection} /> : catalog.loading ? <p className="panel" role="status">Cargando catálogo…</p> : <ReservationList key={tab} history={tab === 'history'} equipment={equipment} version={version} onSelect={setSelection} />}
        </div>
        {selection && <ReservationDialog selection={selection} onClose={() => setSelection(null)} onSaved={onSaved} onConflict={() => setVersion(value => value + 1)} />}
      </>}
  </div>
}
