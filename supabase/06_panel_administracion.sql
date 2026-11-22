-- SIGELAB | Administración de cuentas y productos | Aplicar una vez después de 02_reservas.sql.
-- Migración transaccional: preserva reservas y códigos existentes.
begin;
create table public.reservas_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 200),
  tipo text not null check (tipo in ('PROYECTOR','LAPTOP','CAMARA','CABLE','ADAPTADOR')),
  habilitado boolean not null default true,
  disponible_desde date,
  disponible_hasta date,
  roles_permitidos text[] not null default array['ESTUDIANTE','DOCENTE'],
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint productos_fechas_validas check (
    (disponible_desde is null and disponible_hasta is null) or
    (disponible_desde is not null and disponible_hasta is not null and isfinite(disponible_desde) and isfinite(disponible_hasta) and disponible_desde <= disponible_hasta)
  ),
  constraint productos_roles_validos check (
    cardinality(roles_permitidos) between 1 and 4 and array_position(roles_permitidos,null) is null and
    roles_permitidos <@ array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']::text[]
  )
);
alter table public.reservas_equipos add column producto_id uuid references public.reservas_productos(id) on delete restrict;
-- Cada unidad antigua se conserva como un producto de cantidad 1, sin límite de fechas.
insert into public.reservas_productos (id,nombre,tipo,habilitado)
select id,nombre,tipo,habilitado from public.reservas_equipos;
update public.reservas_equipos set producto_id = id;
alter table public.reservas_equipos alter column producto_id set not null;
create index reservas_equipo_producto_idx on public.reservas_equipos(producto_id);
alter table public.reservas_productos enable row level security;
revoke all on public.reservas_productos from public,anon,authenticated;
grant select on public.reservas_productos to authenticated;
create policy productos_lectura on public.reservas_productos for select to authenticated
using ((select sigelab_privado.rol_actual()) is not null);
alter table public.reservas drop constraint reservas_solicitante_rol_check;
alter table public.reservas add constraint reservas_solicitante_rol_check
  check (solicitante_rol in ('ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR'));

create table public.reservas_auditoria_admin (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  accion text not null,
  entidad_id uuid not null,
  detalle jsonb not null,
  creado_en timestamptz not null default now()
);
alter table public.reservas_auditoria_admin enable row level security;
revoke all on public.reservas_auditoria_admin from public,anon,authenticated;
grant select on public.reservas_auditoria_admin to authenticated;
create policy auditoria_admin_lectura on public.reservas_auditoria_admin for select to authenticated
using ((select sigelab_privado.rol_actual()) = 'ADMINISTRADOR');

create function public.admin_listar_cuentas(
  p_busqueda text default null, p_estado text default 'PENDIENTES', p_pagina integer default 1, p_tamano integer default 20
)
returns table(usuario_id uuid,correo text,correo_confirmado boolean,nombre_solicitado text,tipo_solicitado text,nombre text,rol text,autorizado boolean,total bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform sigelab_privado.exigir_rol(array['ADMINISTRADOR']);
  if p_estado is null or p_estado not in ('TODAS','PENDIENTES','AUTORIZADAS') or p_pagina is null or p_pagina < 1 or p_tamano is null or p_tamano not between 1 and 100 then
    raise exception using errcode='22023',message='Filtros o paginación inválidos.';
  end if;
  return query select u.id,u.email::text,u.email_confirmed_at is not null,
    u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'requested_role',p.nombre,p.rol,coalesce(p.autorizado,false),count(*) over()
  from auth.users u left join public.reservas_usuarios p on p.usuario_id=u.id
  where (p_estado='TODAS' or (p_estado='PENDIENTES' and not coalesce(p.autorizado,false)) or (p_estado='AUTORIZADAS' and p.autorizado))
    and (nullif(btrim(p_busqueda),'') is null or strpos(lower(coalesce(u.email,'')),lower(btrim(p_busqueda)))>0
      or strpos(lower(coalesce(p.nombre,u.raw_user_meta_data->>'full_name','')),lower(btrim(p_busqueda)))>0)
  order by u.created_at desc,u.id limit p_tamano offset ((p_pagina::bigint-1)*p_tamano);
end;
$$;

create function public.admin_guardar_cuenta(p_usuario_id uuid,p_nombre text,p_rol text,p_autorizado boolean)
returns public.reservas_usuarios language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_anterior public.reservas_usuarios; v_guardado public.reservas_usuarios; v_confirmado boolean;
begin
  -- Serializa las bajas/cambios de administradores, incluso entre dos sesiones.
  perform pg_advisory_xact_lock(6711,1);
  v_actor := sigelab_privado.exigir_rol(array['ADMINISTRADOR']);
  if p_nombre is null or char_length(btrim(p_nombre)) not between 1 and 200 or p_rol is null or p_rol not in ('ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR') or p_autorizado is null then
    raise exception using errcode='22023',message='Nombre, rol o autorización inválidos.';
  end if;
  select u.email_confirmed_at is not null into v_confirmado from auth.users u where u.id=p_usuario_id;
  if not found then raise exception using errcode='22023',message='La cuenta no existe en el servicio de autenticación.'; end if;
  if p_autorizado and not v_confirmado then raise exception using errcode='22023',message='La cuenta debe confirmar su correo antes de autorizarla.'; end if;
  select p.* into v_anterior from public.reservas_usuarios p where p.usuario_id=p_usuario_id for update;
  if v_anterior.autorizado and v_anterior.rol='ADMINISTRADOR' and not (p_autorizado and p_rol='ADMINISTRADOR')
    and (select count(*) from public.reservas_usuarios where autorizado and rol='ADMINISTRADOR') <= 1 then
    raise exception using errcode='22023',message='Debe conservarse al menos un administrador autorizado.';
  end if;
  insert into public.reservas_usuarios(usuario_id,nombre,rol,autorizado) values(p_usuario_id,btrim(p_nombre),p_rol,p_autorizado)
  on conflict(usuario_id) do update set nombre=excluded.nombre,rol=excluded.rol,autorizado=excluded.autorizado returning * into v_guardado;
  insert into public.reservas_auditoria_admin(actor_id,accion,entidad_id,detalle) values(v_actor,'CUENTA_ACTUALIZADA',p_usuario_id,
    jsonb_build_object('rol_anterior',v_anterior.rol,'autorizado_anterior',v_anterior.autorizado,'rol',p_rol,'autorizado',p_autorizado));
  return v_guardado;
end;
$$;

create function public.gestion_guardar_producto(
  p_producto_id uuid,p_nombre text,p_tipo text,p_desde date,p_hasta date,p_roles text[],p_codigos text[],p_habilitado boolean default true
)
returns public.reservas_productos language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid := coalesce(p_producto_id,gen_random_uuid()); v_codigos text[]; v_lower text[]; v_producto public.reservas_productos; v_codigo text;
begin
  v_actor := sigelab_privado.exigir_rol(array['PERSONAL','ADMINISTRADOR']);
  if p_nombre is null or char_length(btrim(p_nombre)) not between 1 and 200 or p_tipo is null or p_tipo not in ('PROYECTOR','LAPTOP','CAMARA','CABLE','ADAPTADOR') or p_habilitado is null then
    raise exception using errcode='22023',message='Nombre o tipo de producto inválido.';
  end if;
  if p_desde is null or p_hasta is null or not isfinite(p_desde) or not isfinite(p_hasta) or p_desde>p_hasta then
    raise exception using errcode='22023',message='Define una fecha inicial y final de disponibilidad válidas.';
  end if;
  if p_roles is null or cardinality(p_roles) not between 1 and 4 or array_position(p_roles,null) is not null or not(p_roles <@ array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']::text[]) then
    raise exception using errcode='22023',message='Selecciona al menos un rol válido para reservar.';
  end if;
  if p_codigos is null or cardinality(p_codigos) not between 1 and 500 or exists(select 1 from unnest(p_codigos) c where c is null or char_length(btrim(c)) not between 1 and 80) then
    raise exception using errcode='22023',message='Registra entre 1 y 500 códigos de inventario válidos.';
  end if;
  select array_agg(btrim(c) order by n),array_agg(lower(btrim(c)) order by n) into v_codigos,v_lower from unnest(p_codigos) with ordinality as x(c,n);
  if cardinality(v_lower)<>(select count(distinct c) from unnest(v_lower) c) then
    raise exception using errcode='22023',message='Los códigos de inventario no pueden repetirse.';
  end if;
  if p_producto_id is not null then
    perform 1 from public.reservas_productos where id=v_id for update;
    if not found then raise exception using errcode='22023',message='El producto ya no existe.'; end if;
  end if;
  if exists(select 1 from public.reservas_equipos e where lower(btrim(e.codigo_inventario))=any(v_lower) and e.producto_id<>v_id) then
    raise exception using errcode='22023',message='Un código de inventario ya pertenece a otro producto.';
  end if;
  -- No invalida reservas futuras ya confirmadas al retirar unidades, fechas o roles.
  if exists(select 1 from public.reservas r join public.reservas_equipos e on e.id=r.equipo_id where e.producto_id=v_id and r.estado='ACTIVA' and r.fin>now()
    and (not p_habilitado or not(lower(btrim(e.codigo_inventario))=any(v_lower)) or not(r.solicitante_rol=any(p_roles))
      or r.inicio<(p_desde::timestamp at time zone 'America/Guayaquil') or r.fin>((p_hasta+1)::timestamp at time zone 'America/Guayaquil'))) then
    raise exception using errcode='22023',message='El cambio afectaría reservas futuras activas. Conserva sus unidades, fechas y roles hasta que finalicen o se cancelen.';
  end if;
  insert into public.reservas_productos(id,nombre,tipo,habilitado,disponible_desde,disponible_hasta,roles_permitidos)
  values(v_id,btrim(p_nombre),p_tipo,p_habilitado,p_desde,p_hasta,p_roles)
  on conflict(id) do update set nombre=excluded.nombre,tipo=excluded.tipo,habilitado=excluded.habilitado,
    disponible_desde=excluded.disponible_desde,disponible_hasta=excluded.disponible_hasta,roles_permitidos=excluded.roles_permitidos,actualizado_en=clock_timestamp();
  -- Las unidades retiradas se deshabilitan; conservan identificador e historial.
  update public.reservas_equipos set habilitado=false where producto_id=v_id and not(lower(btrim(codigo_inventario))=any(v_lower));
  foreach v_codigo in array v_codigos loop
    update public.reservas_equipos set nombre=btrim(p_nombre),tipo=p_tipo,habilitado=true,codigo_inventario=v_codigo
      where producto_id=v_id and lower(btrim(codigo_inventario))=lower(v_codigo);
    if not found then insert into public.reservas_equipos(producto_id,codigo_inventario,nombre,tipo,habilitado) values(v_id,v_codigo,btrim(p_nombre),p_tipo,true); end if;
  end loop;
  select * into v_producto from public.reservas_productos where id=v_id;
  insert into public.reservas_auditoria_admin(actor_id,accion,entidad_id,detalle) values(v_actor,'PRODUCTO_GUARDADO',v_id,
    jsonb_build_object('cantidad',cardinality(v_codigos),'roles',p_roles,'desde',p_desde,'hasta',p_hasta,'habilitado',p_habilitado));
  return v_producto;
exception when unique_violation then
  raise exception using errcode='22023',message='Un código ya está registrado. Actualiza el catálogo antes de reintentar.';
end;
$$;

create function sigelab_privado.validar_reserva_producto()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_producto public.reservas_productos; v_equipo public.reservas_equipos; v_rol text;
begin
  if new.estado<>'ACTIVA' then return new; end if;
  -- Orden de bloqueo compartido con las RPC: producto, luego unidad.
  select p.* into v_producto from public.reservas_productos p join public.reservas_equipos e on e.producto_id=p.id where e.id=new.equipo_id for share of p;
  if not found then raise exception using errcode='22023',message='El producto no existe.'; end if;
  select e.* into v_equipo from public.reservas_equipos e where e.id=new.equipo_id for share;
  if not v_producto.habilitado or not v_equipo.habilitado then raise exception using errcode='22023',message='El producto o la unidad no están habilitados.'; end if;
  select u.rol into v_rol from public.reservas_usuarios u where u.usuario_id=new.usuario_id and u.autorizado;
  if v_rol is null or not(v_rol=any(v_producto.roles_permitidos)) then
    raise exception using errcode='42501',message='El rol de tu cuenta no está habilitado para reservar este producto.';
  end if;
  if (v_producto.disponible_desde is not null and new.inicio<(v_producto.disponible_desde::timestamp at time zone 'America/Guayaquil'))
    or (v_producto.disponible_hasta is not null and new.fin>((v_producto.disponible_hasta+1)::timestamp at time zone 'America/Guayaquil')) then
    raise exception using errcode='22023',message='El período está fuera de las fechas de disponibilidad del producto.';
  end if;
  return new;
end;
$$;
revoke all on function sigelab_privado.validar_reserva_producto() from public,anon,authenticated;
create trigger reservas_validar_producto before insert or update of inicio,fin,equipo_id,estado on public.reservas
for each row execute function sigelab_privado.validar_reserva_producto();

create or replace function public.reservas_disponibilidad(p_inicio timestamptz,p_fin timestamptz,p_tipo text default null,p_busqueda text default null)
returns table(equipo_id uuid,codigo_inventario text,nombre text,tipo text,habilitado boolean,disponible boolean)
language plpgsql security definer set search_path = '' as $$
declare v_rol text;
begin
  perform sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']);
  perform sigelab_privado.validar_periodo(p_inicio,p_fin);
  v_rol := sigelab_privado.rol_actual();
  if p_tipo is not null and p_tipo not in ('PROYECTOR','LAPTOP','CAMARA','CABLE','ADAPTADOR') then raise exception using errcode='22023',message='Tipo de equipo inválido.'; end if;
  return query select e.id,e.codigo_inventario,e.nombre,e.tipo,e.habilitado and p.habilitado,
    e.habilitado and p.habilitado and v_rol=any(p.roles_permitidos)
    and (p.disponible_desde is null or p_inicio>=(p.disponible_desde::timestamp at time zone 'America/Guayaquil'))
    and (p.disponible_hasta is null or p_fin<=((p.disponible_hasta+1)::timestamp at time zone 'America/Guayaquil'))
    and not exists(select 1 from public.reservas r where r.equipo_id=e.id and r.estado='ACTIVA' and tstzrange(r.inicio,r.fin,'[)') && tstzrange(p_inicio,p_fin,'[)'))
  from public.reservas_equipos e join public.reservas_productos p on p.id=e.producto_id
  where (p_tipo is null or e.tipo=p_tipo) and (nullif(btrim(p_busqueda),'') is null or strpos(lower(e.nombre),lower(btrim(p_busqueda)))>0 or strpos(lower(e.codigo_inventario),lower(btrim(p_busqueda)))>0)
  order by e.nombre,e.codigo_inventario;
end;
$$;

create or replace function public.reservas_crear(
  p_equipo_id uuid, p_inicio timestamptz, p_fin timestamptz, p_actividad text
)
returns public.reservas language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid; v_reserva public.reservas;
begin
  v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']);
  perform sigelab_privado.validar_periodo(p_inicio, p_fin);
  if p_actividad is null or char_length(btrim(p_actividad)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'La actividad academica debe tener entre 1 y 500 caracteres.';
  end if;
  perform 1 from public.reservas_productos p join public.reservas_equipos e on e.producto_id=p.id where e.id=p_equipo_id for share of p;
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

create or replace function public.reservas_modificar(p_reserva_id uuid, p_inicio timestamptz, p_fin timestamptz)
returns public.reservas language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid; v_reserva public.reservas;
begin
  v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']);
  perform sigelab_privado.validar_periodo(p_inicio, p_fin);
  select r.* into v_reserva from public.reservas r
  where r.id = p_reserva_id and r.usuario_id = v_usuario for update;
  if not found then
    raise exception using errcode = '42501', message = 'Reserva inexistente o sin permiso para modificarla.';
  end if;
  if v_reserva.estado <> 'ACTIVA' then
    raise exception using errcode = '22023', message = 'Solo se pueden modificar reservas activas.';
  end if;
  perform 1 from public.reservas_productos p join public.reservas_equipos e on e.producto_id=p.id where e.id=v_reserva.equipo_id for share of p;
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

create or replace function public.reservas_cancelar(p_reserva_id uuid)
returns public.reservas language plpgsql security definer set search_path = ''
as $$
declare v_usuario uuid; v_reserva public.reservas;
begin
  v_usuario := sigelab_privado.exigir_rol(array['ESTUDIANTE','DOCENTE','PERSONAL','ADMINISTRADOR']);
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

revoke all on function public.admin_listar_cuentas(text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.admin_guardar_cuenta(uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.gestion_guardar_producto(uuid,text,text,date,date,text[],text[],boolean) from public,anon,authenticated;
grant execute on function public.admin_listar_cuentas(text,text,integer,integer) to authenticated;
grant execute on function public.admin_guardar_cuenta(uuid,text,text,boolean) to authenticated;
grant execute on function public.gestion_guardar_producto(uuid,text,text,date,date,text[],text[],boolean) to authenticated;
notify pgrst,'reload schema';
commit;
