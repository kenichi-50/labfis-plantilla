-- SIGELAB | HU-01 a HU-06 | PostgreSQL / Supabase
-- Ejecutar UNA VEZ como postgres en SQL Editor. No depende de 01_base_demo.sql.
-- Una transaccion: si falla algo, no queda una instalacion parcial.
begin;
create extension if not exists btree_gist with schema extensions;
set local search_path = pg_catalog, public, extensions;
create schema if not exists sigelab_privado;
revoke all on schema sigelab_privado from public, anon, authenticated;
grant usage on schema sigelab_privado to authenticated;

-- Alta y roles exclusivamente desde SQL Editor/backend administrativo.
-- No se confia en user_metadata ni en un rol enviado por el navegador.
create table public.reservas_usuarios (
  usuario_id uuid primary key references auth.users(id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 200),
  rol text not null check (rol in ('ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR')),
  autorizado boolean not null default false,
  creado_en timestamptz not null default now()
);

create table public.reservas_equipos (
  id uuid primary key default gen_random_uuid(),
  codigo_inventario text not null check (char_length(btrim(codigo_inventario)) between 1 and 80),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 200),
  tipo text not null check (tipo in ('PROYECTOR','LAPTOP','CAMARA','CABLE','ADAPTADOR')),
  habilitado boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index reservas_equipo_codigo_unico
  on public.reservas_equipos (lower(btrim(codigo_inventario)));

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.reservas_usuarios(usuario_id) on delete restrict,
  equipo_id uuid not null references public.reservas_equipos(id) on delete restrict,
  -- Copia al reservar: el historial conserva nombre y rol aunque cambie el perfil.
  solicitante_nombre text not null,
  solicitante_rol text not null check (solicitante_rol in ('ESTUDIANTE','DOCENTE')),
  actividad text not null check (char_length(btrim(actividad)) between 1 and 500),
  inicio timestamptz not null,
  fin timestamptz not null,
  estado text not null default 'ACTIVA' check (estado in ('ACTIVA','CANCELADA')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cancelado_en timestamptz,
  constraint reservas_periodo_valido check (isfinite(inicio) and isfinite(fin) and inicio < fin),
  constraint reservas_cancelacion_valida check (
    (estado = 'ACTIVA' and cancelado_en is null) or
    (estado = 'CANCELADA' and cancelado_en is not null)
  ),
  -- Protege INSERT y UPDATE, incluso si dos transacciones compiten.
  -- [inicio,fin): permite periodos consecutivos sin solapamiento.
  constraint reservas_sin_solapamiento exclude using gist (
    equipo_id with =, tstzrange(inicio, fin, '[)') with &&
  ) where (estado = 'ACTIVA')
);
create index reservas_usuario_inicio_idx on public.reservas (usuario_id, inicio desc, id);
create index reservas_inicio_idx on public.reservas (inicio desc, id);

create function sigelab_privado.rol_actual()
returns text language sql stable security definer set search_path = ''
as $$
  select u.rol from public.reservas_usuarios u
  where u.usuario_id = (select auth.uid()) and u.autorizado;
$$;
revoke all on function sigelab_privado.rol_actual() from public, anon, authenticated;
grant execute on function sigelab_privado.rol_actual() to authenticated;

create function sigelab_privado.exigir_rol(p_roles text[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid := auth.uid(); v_rol text;
begin
  v_rol := sigelab_privado.rol_actual();
  if v_usuario is null or v_rol is null or not (v_rol = any(p_roles)) then
    raise exception using errcode = '42501', message = 'No tiene autorizacion para esta operacion.';
  end if;
  return v_usuario;
end;
$$;
revoke all on function sigelab_privado.exigir_rol(text[]) from public, anon, authenticated;

create function sigelab_privado.validar_periodo(p_inicio timestamptz, p_fin timestamptz)
returns void language plpgsql set search_path = ''
as $$
begin
  if p_inicio is null or p_fin is null or not isfinite(p_inicio) or not isfinite(p_fin) or p_inicio >= p_fin then
    raise exception using errcode = '22023', message = 'Ingrese fecha y horas validas; la hora final debe ser posterior a la inicial.';
  end if;
end;
$$;
revoke all on function sigelab_privado.validar_periodo(timestamptz,timestamptz) from public, anon, authenticated;

alter table public.reservas_usuarios enable row level security;
alter table public.reservas_equipos enable row level security;
alter table public.reservas enable row level security;
revoke all on public.reservas_usuarios, public.reservas_equipos, public.reservas from public, anon, authenticated;
grant select on public.reservas_usuarios, public.reservas_equipos, public.reservas to authenticated;

create policy reservas_usuario_lectura on public.reservas_usuarios for select to authenticated
  using (usuario_id = (select auth.uid()) or (select sigelab_privado.rol_actual()) in ('PERSONAL','ADMINISTRADOR'));
create policy reservas_equipo_lectura on public.reservas_equipos for select to authenticated
  using ((select sigelab_privado.rol_actual()) is not null);
create policy reservas_lectura on public.reservas for select to authenticated
  using ((select sigelab_privado.rol_actual()) is not null and
    (usuario_id = (select auth.uid()) or (select sigelab_privado.rol_actual()) in ('PERSONAL','ADMINISTRADOR')));
-- No hay politicas ni grants de INSERT/UPDATE/DELETE: mutaciones solo mediante RPC.

create function public.reservas_disponibilidad(
  p_inicio timestamptz, p_fin timestamptz,
  p_tipo text default null, p_busqueda text default null
)
returns table (equipo_id uuid, codigo_inventario text, nombre text, tipo text, habilitado boolean, disponible boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  perform sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']);
  perform sigelab_privado.validar_periodo(p_inicio, p_fin);
  if p_tipo is not null and p_tipo not in ('PROYECTOR','LAPTOP','CAMARA','CABLE','ADAPTADOR') then
    raise exception using errcode = '22023', message = 'Tipo de equipo invalido.';
  end if;
  return query
  select e.id, e.codigo_inventario, e.nombre, e.tipo, e.habilitado,
    e.habilitado and not exists (
      select 1 from public.reservas r where r.equipo_id = e.id and r.estado = 'ACTIVA'
      and tstzrange(r.inicio, r.fin, '[)') && tstzrange(p_inicio, p_fin, '[)')
    )
  from public.reservas_equipos e
  where (p_tipo is null or e.tipo = p_tipo)
    and (nullif(btrim(p_busqueda), '') is null
      or strpos(lower(e.nombre), lower(btrim(p_busqueda))) > 0
      or strpos(lower(e.codigo_inventario), lower(btrim(p_busqueda))) > 0)
  order by e.nombre, e.codigo_inventario;
end;
$$;

create function public.reservas_crear(
  p_equipo_id uuid, p_inicio timestamptz, p_fin timestamptz, p_actividad text
)
returns public.reservas language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid; v_reserva public.reservas;
begin
  v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE']);
  perform sigelab_privado.validar_periodo(p_inicio, p_fin);
  if p_actividad is null or char_length(btrim(p_actividad)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'La actividad academica debe tener entre 1 y 500 caracteres.';
  end if;
  perform 1 from public.reservas_equipos e where e.id = p_equipo_id and e.habilitado for share;
  if not found then
    raise exception using errcode = '22023', message = 'El equipo no existe o no esta habilitado.';
  end if;
  -- La exclusion consulta el estado real al escribir; una consulta previa no es suficiente.
  insert into public.reservas (usuario_id, equipo_id, solicitante_nombre, solicitante_rol, actividad, inicio, fin)
  select v_usuario, p_equipo_id, u.nombre, u.rol, btrim(p_actividad), p_inicio, p_fin
  from public.reservas_usuarios u where u.usuario_id = v_usuario
  returning * into v_reserva;
  return v_reserva;
exception when exclusion_violation then
  raise exception using errcode = '23P01', message = 'El equipo ya tiene una reserva activa en ese periodo. Consulte nuevamente la disponibilidad.';
end;
$$;

create function public.reservas_modificar(p_reserva_id uuid, p_inicio timestamptz, p_fin timestamptz)
returns public.reservas language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid; v_reserva public.reservas;
begin
  v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE']);
  perform sigelab_privado.validar_periodo(p_inicio, p_fin);
  select r.* into v_reserva from public.reservas r
  where r.id = p_reserva_id and r.usuario_id = v_usuario for update;
  if not found then
    raise exception using errcode = '42501', message = 'Reserva inexistente o sin permiso para modificarla.';
  end if;
  if v_reserva.estado <> 'ACTIVA' then
    raise exception using errcode = '22023', message = 'Solo se pueden modificar reservas activas.';
  end if;
  perform 1 from public.reservas_equipos e where e.id = v_reserva.equipo_id and e.habilitado for share;
  if not found then
    raise exception using errcode = '22023', message = 'El equipo no esta habilitado.';
  end if;
  -- UPDATE atomico: la exclusion ignora esta misma fila. Si falla, se conserva el periodo anterior.
  update public.reservas r set inicio = p_inicio, fin = p_fin, actualizado_en = clock_timestamp()
  where r.id = v_reserva.id returning r.* into v_reserva;
  return v_reserva;
exception when exclusion_violation then
  raise exception using errcode = '23P01', message = 'El nuevo periodo tiene un conflicto. Se conserva la reserva original.';
end;
$$;

create function public.reservas_cancelar(p_reserva_id uuid)
returns public.reservas language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid; v_reserva public.reservas;
begin
  v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE']);
  select r.* into v_reserva from public.reservas r
  where r.id = p_reserva_id and r.usuario_id = v_usuario for update;
  if not found then
    raise exception using errcode = '42501', message = 'Reserva inexistente o sin permiso para cancelarla.';
  end if;
  if v_reserva.estado <> 'ACTIVA' then
    raise exception using errcode = '22023', message = 'La reserva ya esta cancelada.';
  end if;
  update public.reservas r set estado = 'CANCELADA', cancelado_en = clock_timestamp(), actualizado_en = clock_timestamp()
  where r.id = v_reserva.id returning r.* into v_reserva;
  return v_reserva;
end;
$$;

-- p_historial=false: solo propias. true: historial general exclusivo del personal.
-- Los filtros de fecha corresponden a la fecha de inicio en America/Guayaquil.
create function public.reservas_consultar(
  p_equipo_id uuid default null, p_solicitante_id uuid default null,
  p_desde date default null, p_hasta date default null, p_estado text default null,
  p_pagina integer default 1, p_tamano integer default 20, p_historial boolean default false
)
returns table (
  id uuid, usuario_id uuid, solicitante_nombre text, solicitante_rol text,
  equipo_id uuid, equipo_nombre text, codigo_inventario text, tipo text,
  actividad text, inicio timestamptz, fin timestamptz, estado text,
  creado_en timestamptz, actualizado_en timestamptz, cancelado_en timestamptz, total bigint
)
language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid;
begin
  if p_historial is null then
    raise exception using errcode = '22023', message = 'Indique el modo de consulta.';
  elsif p_historial then
    v_usuario := sigelab_privado.exigir_rol(array['PERSONAL','ADMINISTRADOR']);
  else
    v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']);
    if p_solicitante_id is not null and p_solicitante_id <> v_usuario then
      raise exception using errcode = '42501', message = 'No puede consultar las reservas de otro usuario.';
    end if;
  end if;
  if p_pagina is null or p_pagina < 1 or p_tamano is null or p_tamano not between 1 and 100
    or (p_desde is not null and not isfinite(p_desde))
    or (p_hasta is not null and not isfinite(p_hasta))
    or (p_desde is not null and p_hasta is not null and p_desde > p_hasta)
    or (p_estado is not null and p_estado not in ('ACTIVA','CANCELADA')) then
    raise exception using errcode = '22023', message = 'Filtros o paginacion invalidos.';
  end if;
  return query
  select r.id, r.usuario_id, r.solicitante_nombre, r.solicitante_rol,
    e.id, e.nombre, e.codigo_inventario, e.tipo, r.actividad, r.inicio, r.fin,
    r.estado, r.creado_en, r.actualizado_en, r.cancelado_en, count(*) over ()
  from public.reservas r join public.reservas_equipos e on e.id = r.equipo_id
  where (p_historial or r.usuario_id = v_usuario)
    and (p_equipo_id is null or r.equipo_id = p_equipo_id)
    and (p_solicitante_id is null or r.usuario_id = p_solicitante_id)
    and (p_desde is null or r.inicio >= (p_desde::timestamp at time zone 'America/Guayaquil'))
    and (p_hasta is null or r.inicio < ((p_hasta + 1)::timestamp at time zone 'America/Guayaquil'))
    and (p_estado is null or r.estado = p_estado)
  order by r.inicio desc, r.id
  limit p_tamano offset ((p_pagina::bigint - 1) * p_tamano);
end;
$$;

-- PostgreSQL concede EXECUTE a PUBLIC por defecto: se retira explicitamente.
revoke all on function public.reservas_disponibilidad(timestamptz,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.reservas_crear(uuid,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.reservas_modificar(uuid,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.reservas_cancelar(uuid) from public, anon, authenticated;
revoke all on function public.reservas_consultar(uuid,uuid,date,date,text,integer,integer,boolean) from public, anon, authenticated;
grant execute on function public.reservas_disponibilidad(timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.reservas_crear(uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.reservas_modificar(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.reservas_cancelar(uuid) to authenticated;
grant execute on function public.reservas_consultar(uuid,uuid,date,date,text,integer,integer,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
