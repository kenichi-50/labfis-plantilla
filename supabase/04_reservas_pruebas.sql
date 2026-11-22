-- PRUEBAS DE ACEPTACION | Ejecutar como postgres DESPUES de 02_reservas.sql.
-- Datos sinteticos. Todos los cambios se revierten al terminar (ROLLBACK).
-- Si el editor interrumpe la ejecucion por un fallo, ejecutar ROLLBACK.
begin;
create schema sigelab_pruebas;
grant usage on schema sigelab_pruebas to authenticated, anon;
create function sigelab_pruebas.verificar(p_valor boolean, p_mensaje text)
returns void language plpgsql as $$
begin
  if p_valor is distinct from true then raise exception 'FALLO: %', p_mensaje; end if;
  raise notice 'OK: %', p_mensaje;
end;
$$;
create function sigelab_pruebas.esperar_error(p_sql text, p_codigo text)
returns void language plpgsql as $$
declare v_codigo text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
  end;
  perform sigelab_pruebas.verificar(v_codigo = p_codigo, 'Error esperado ' || p_codigo || ': ' || p_sql);
end;
$$;
insert into auth.users (id,email) values
 ('d0000000-0000-0000-0000-000000000001','sigelab-estudiante@example.invalid'),
 ('d0000000-0000-0000-0000-000000000002','sigelab-docente@example.invalid'),
 ('d0000000-0000-0000-0000-000000000003','sigelab-personal@example.invalid'),
 ('d0000000-0000-0000-0000-000000000004','sigelab-inactivo@example.invalid');
insert into public.reservas_usuarios (usuario_id,nombre,rol,autorizado) values
 ('d0000000-0000-0000-0000-000000000001','Estudiante prueba','ESTUDIANTE',true),
 ('d0000000-0000-0000-0000-000000000002','Docente prueba','DOCENTE',true),
 ('d0000000-0000-0000-0000-000000000003','Personal prueba','PERSONAL',true),
 ('d0000000-0000-0000-0000-000000000004','No autorizado','ESTUDIANTE',false);
insert into public.reservas_equipos (id,codigo_inventario,nombre,tipo) values
 ('e0000000-0000-0000-0000-000000000001','SIGELAB-TEST-001','Laptop sintetica','LAPTOP');

set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
do $$
declare v_reserva public.reservas;
begin
  v_reserva := public.reservas_crear('e0000000-0000-0000-0000-000000000001','2030-01-10 09:00-05','2030-01-10 10:00-05','Practica de laboratorio');
  perform set_config('sigelab.test.reserva',v_reserva.id::text,true);
  perform sigelab_pruebas.verificar(v_reserva.usuario_id = auth.uid() and v_reserva.estado = 'ACTIVA','HU-01 propietario autenticado y estado ACTIVA');
end;
$$;
select sigelab_pruebas.verificar(
  (select not disponible from public.reservas_disponibilidad('2030-01-10 09:30-05','2030-01-10 10:30-05','LAPTOP','SIGELAB-TEST-001')),
  'HU-02 solapamiento parcial detectado con filtros');
select sigelab_pruebas.verificar(
  (select disponible from public.reservas_disponibilidad('2030-01-10 10:00-05','2030-01-10 11:00-05','LAPTOP','SIGELAB-TEST-001')),
  'HU-02 extremos consecutivos permitidos');
select sigelab_pruebas.verificar(
  not exists (select 1 from public.reservas_disponibilidad('2030-01-10 09:00-05','2030-01-10 10:00-05',null,'NO-EXISTE-ESTE-CODIGO')),
  'HU-02 busqueda sin resultados no es error del servicio');
select sigelab_pruebas.esperar_error($q$select public.reservas_crear('e0000000-0000-0000-0000-000000000001','2030-01-10 08:00-05','2030-01-10 11:00-05','Conflicto total')$q$,'23P01');
select sigelab_pruebas.esperar_error($q$select public.reservas_disponibilidad(null,'2030-01-10 11:00-05')$q$,'22023');
select sigelab_pruebas.esperar_error($q$select public.reservas_disponibilidad('2030-01-10 11:00-05','2030-01-10 10:00-05')$q$,'22023');
select sigelab_pruebas.esperar_error($q$select public.reservas_crear('e0000000-0000-0000-0000-000000000001','2030-01-11 09:00-05','2030-01-11 10:00-05','  ')$q$,'22023');
select sigelab_pruebas.esperar_error($q$update public.reservas_usuarios set rol = 'ADMINISTRADOR'$q$,'42501');
select sigelab_pruebas.esperar_error($q$update public.reservas set estado = 'CANCELADA'$q$,'42501');
select sigelab_pruebas.esperar_error($q$delete from public.reservas$q$,'42501');
select sigelab_pruebas.esperar_error($q$select * from public.reservas_consultar(p_historial => true)$q$,'42501');
select sigelab_pruebas.esperar_error($q$select * from public.reservas_consultar(p_solicitante_id => 'd0000000-0000-0000-0000-000000000002')$q$,'42501');

select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000002',true);
select public.reservas_crear('e0000000-0000-0000-0000-000000000001','2030-01-10 10:00-05','2030-01-10 11:00-05','Reserva docente');
select sigelab_pruebas.verificar((select count(*) = 1 from public.reservas),'RLS: docente solo lee su reserva');
select sigelab_pruebas.esperar_error($q$select public.reservas_cancelar(current_setting('sigelab.test.reserva')::uuid)$q$,'42501');
select sigelab_pruebas.esperar_error($q$select public.reservas_modificar(current_setting('sigelab.test.reserva')::uuid,'2030-01-12 09:00-05','2030-01-12 10:00-05')$q$,'42501');

select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select sigelab_pruebas.esperar_error($q$select public.reservas_modificar(current_setting('sigelab.test.reserva')::uuid,'2030-01-10 09:30-05','2030-01-10 10:30-05')$q$,'23P01');
select sigelab_pruebas.verificar((select inicio = '2030-01-10 09:00-05'::timestamptz and fin = '2030-01-10 10:00-05'::timestamptz from public.reservas where id = current_setting('sigelab.test.reserva')::uuid),'HU-04 conflicto conserva periodo original');
select public.reservas_modificar(current_setting('sigelab.test.reserva')::uuid,'2030-01-10 08:00-05','2030-01-10 09:00-05');
select sigelab_pruebas.verificar((select disponible from public.reservas_disponibilidad('2030-01-10 09:00-05','2030-01-10 10:00-05',null,'SIGELAB-TEST-001')),'HU-04 cambio libera horario anterior');
select public.reservas_cancelar(current_setting('sigelab.test.reserva')::uuid);
select sigelab_pruebas.verificar((select estado = 'CANCELADA' and cancelado_en is not null from public.reservas where id = current_setting('sigelab.test.reserva')::uuid),'HU-03 conserva registro cancelado');
select sigelab_pruebas.verificar((select disponible from public.reservas_disponibilidad('2030-01-10 08:00-05','2030-01-10 09:00-05',null,'SIGELAB-TEST-001')),'HU-03 cancelacion libera periodo');
select sigelab_pruebas.esperar_error($q$select public.reservas_modificar(current_setting('sigelab.test.reserva')::uuid,'2030-01-12 09:00-05','2030-01-12 10:00-05')$q$,'22023');

select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000002',true);
select public.reservas_crear('e0000000-0000-0000-0000-000000000001','2030-01-10 08:00-05','2030-01-10 09:00-05','Reutilizacion tras cancelar');
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000003',true);
select sigelab_pruebas.verificar((select count(*) = 3 from public.reservas_consultar(p_historial => true, p_equipo_id => 'e0000000-0000-0000-0000-000000000001')),'HU-06 personal consulta historial general');
select sigelab_pruebas.verificar((select count(*) = 1 and min(total) = 1 from public.reservas_consultar(p_historial => true,p_estado => 'CANCELADA',p_solicitante_id => 'd0000000-0000-0000-0000-000000000001',p_desde => '2030-01-10',p_hasta => '2030-01-10')),'HU-06 filtros y canceladas en historial');
select sigelab_pruebas.verificar((select count(*) = 1 and min(total) = 3 from public.reservas_consultar(p_historial => true,p_equipo_id => 'e0000000-0000-0000-0000-000000000001',p_tamano => 1,p_pagina => 2)),'HU-06 paginacion con total');
select sigelab_pruebas.esperar_error($q$select public.reservas_crear('e0000000-0000-0000-0000-000000000001','2030-01-11 09:00-05','2030-01-11 10:00-05','No permitido al personal')$q$,'42501');

select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000004',true);
select sigelab_pruebas.verificar((select count(*) = 0 from public.reservas_equipos),'RLS: cuenta no autorizada no consulta equipos');
select sigelab_pruebas.esperar_error($q$select public.reservas_disponibilidad('2030-01-11 09:00-05','2030-01-11 10:00-05')$q$,'42501');
set local role anon;
select sigelab_pruebas.esperar_error($q$select * from public.reservas$q$,'42501');
select sigelab_pruebas.esperar_error($q$select public.reservas_disponibilidad('2030-01-11 09:00-05','2030-01-11 10:00-05')$q$,'42501');
reset role;
rollback;

