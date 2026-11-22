-- Pruebas del panel. Ejecutar después de 02 y 06 en una base de pruebas.
-- No conserva usuarios, productos ni reservas: termina en ROLLBACK.
begin;
create schema sigelab_pruebas_panel;
grant usage on schema sigelab_pruebas_panel to authenticated,anon;
create function sigelab_pruebas_panel.ok(p_valor boolean,p_mensaje text) returns void language plpgsql as $$
begin if p_valor is distinct from true then raise exception 'FALLO: %',p_mensaje; end if; raise notice 'OK: %',p_mensaje; end; $$;
create function sigelab_pruebas_panel.error(p_sql text,p_codigo text) returns void language plpgsql as $$
declare v_codigo text; begin begin execute p_sql; exception when others then get stacked diagnostics v_codigo=returned_sqlstate; end;
perform sigelab_pruebas_panel.ok(v_codigo=p_codigo,'Error esperado '||p_codigo||': '||p_sql); end; $$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('f1000000-0000-0000-0000-000000000001','panel-admin@example.invalid',now(),'{"full_name":"Panel admin"}'),
('f1000000-0000-0000-0000-000000000002','panel-pendiente@example.invalid',null,'{"full_name":"Panel estudiante","requested_role":"ESTUDIANTE"}'),
('f1000000-0000-0000-0000-000000000003','panel-docente@example.invalid',now(),'{}'),
('f1000000-0000-0000-0000-000000000004','panel-personal@example.invalid',now(),'{}'),
('f1000000-0000-0000-0000-000000000005','panel-estudiante@example.invalid',now(),'{}');
insert into public.reservas_usuarios(usuario_id,nombre,rol,autorizado) values
('f1000000-0000-0000-0000-000000000001','Panel admin','ADMINISTRADOR',true),
('f1000000-0000-0000-0000-000000000003','Panel docente','DOCENTE',true),
('f1000000-0000-0000-0000-000000000004','Panel personal','PERSONAL',true),
('f1000000-0000-0000-0000-000000000005','Panel estudiante','ESTUDIANTE',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000001',true);
select sigelab_pruebas_panel.ok((select count(*)=1 from public.admin_listar_cuentas('panel-','PENDIENTES')),'Administrador consulta solicitudes pendientes');
select sigelab_pruebas_panel.error($q$select public.admin_guardar_cuenta('f1000000-0000-0000-0000-000000000002','Panel cuenta','ESTUDIANTE',true)$q$,'22023');
select sigelab_pruebas_panel.error($q$select public.admin_guardar_cuenta('f1000000-0000-0000-0000-000000000001','Panel admin','ESTUDIANTE',true)$q$,'22023');
reset role;
update auth.users set email_confirmed_at=now() where id='f1000000-0000-0000-0000-000000000002';
set local role authenticated;
select public.admin_guardar_cuenta('f1000000-0000-0000-0000-000000000002','Panel cuenta','DOCENTE',true);
select sigelab_pruebas_panel.ok((select autorizado and rol='DOCENTE' from public.reservas_usuarios where usuario_id='f1000000-0000-0000-0000-000000000002'),'Autoriza y asigna rol efectivo');
select sigelab_pruebas_panel.ok((select count(*)=1 and min(total)=5 from public.admin_listar_cuentas('panel-','TODAS',2,1)),'Paginación de cuentas');
select sigelab_pruebas_panel.error($q$update public.reservas_usuarios set rol='ADMINISTRADOR'$q$,'42501');
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000004',true);
select sigelab_pruebas_panel.error($q$select * from public.admin_listar_cuentas()$q$,'42501');
select sigelab_pruebas_panel.error($q$select public.admin_guardar_cuenta('f1000000-0000-0000-0000-000000000005','Otro','ADMINISTRADOR',true)$q$,'42501');
select set_config('test.producto',(public.gestion_guardar_producto(null,'Panel laptops','LAPTOP','2030-01-10','2030-01-20',array['DOCENTE'],array['PANEL-001','PANEL-002'],true)).id::text,true);
select sigelab_pruebas_panel.ok((select count(*)=2 from public.reservas_equipos where producto_id=current_setting('test.producto')::uuid and habilitado),'Cantidad equivale a dos unidades individuales');
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(null,'Otro','LAPTOP','2030-01-10','2030-01-20',array['DOCENTE'],array['panel-001'],true)$q$,'22023');
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(null,'Otro','LAPTOP','2030-01-10','2030-01-20',array['DOCENTE'],array['REPETIDO','repetido'],true)$q$,'22023');
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(null,'Otro','LAPTOP','2030-01-20','2030-01-10',array['DOCENTE'],array['OTRO'],true)$q$,'22023');
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(null,'Otro','LAPTOP','2030-01-10','2030-01-20',array[]::text[],array['OTRO'],true)$q$,'22023');
select sigelab_pruebas_panel.ok((select count(*)=0 from public.reservas_auditoria_admin),'Personal no lee auditoría administrativa');
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000005',true);
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(null,'Otro','LAPTOP','2030-01-10','2030-01-20',array['ESTUDIANTE'],array['OTRO'],true)$q$,'42501');
select sigelab_pruebas_panel.ok((select count(*)=2 and bool_and(not disponible) from public.reservas_disponibilidad('2030-01-15 09:00-05','2030-01-15 10:00-05',null,'PANEL-')),'Disponibilidad respeta roles permitidos');
select set_config('test.equipo',(select id::text from public.reservas_equipos where codigo_inventario='PANEL-001'),true);
select sigelab_pruebas_panel.error($q$select public.reservas_crear(current_setting('test.equipo')::uuid,'2030-01-15 09:00-05','2030-01-15 10:00-05','No permitido')$q$,'42501');
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000003',true);
select sigelab_pruebas_panel.error($q$select public.reservas_crear(current_setting('test.equipo')::uuid,'2030-01-09 09:00-05','2030-01-09 10:00-05','Fuera de fecha')$q$,'22023');
select set_config('test.reserva',(public.reservas_crear(current_setting('test.equipo')::uuid,'2030-01-15 09:00-05','2030-01-15 10:00-05','Actividad')).id::text,true);
select set_config('test.segunda',(public.reservas_crear((select id from public.reservas_equipos where codigo_inventario='PANEL-002'),'2030-01-15 09:00-05','2030-01-15 10:00-05','Otra unidad')).id::text,true);
select sigelab_pruebas_panel.error($q$select public.reservas_crear(current_setting('test.equipo')::uuid,'2030-01-15 09:30-05','2030-01-15 10:30-05','Conflicto')$q$,'23P01');
select sigelab_pruebas_panel.error($q$select public.reservas_modificar(current_setting('test.reserva')::uuid,'2030-01-21 09:00-05','2030-01-21 10:00-05')$q$,'22023');
select sigelab_pruebas_panel.ok((select inicio='2030-01-15 09:00-05'::timestamptz from public.reservas where id=current_setting('test.reserva')::uuid),'Cambio fuera de fechas conserva reserva original');
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000004',true);
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(current_setting('test.producto')::uuid,'Panel laptops','LAPTOP','2030-01-10','2030-01-20',array['DOCENTE'],array['PANEL-001'],true)$q$,'22023');
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(current_setting('test.producto')::uuid,'Panel laptops','LAPTOP','2030-01-10','2030-01-14',array['DOCENTE'],array['PANEL-001','PANEL-002'],true)$q$,'22023');
select sigelab_pruebas_panel.error($q$select public.gestion_guardar_producto(current_setting('test.producto')::uuid,'Panel laptops','LAPTOP','2030-01-10','2030-01-20',array['ESTUDIANTE'],array['PANEL-001','PANEL-002'],true)$q$,'22023');
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000003',true);
select public.reservas_cancelar(current_setting('test.reserva')::uuid);
select public.reservas_cancelar(current_setting('test.segunda')::uuid);
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000004',true);
select public.gestion_guardar_producto(current_setting('test.producto')::uuid,'Panel laptops','LAPTOP','2030-01-10','2030-01-20',array['DOCENTE'],array['PANEL-001'],true);
select sigelab_pruebas_panel.ok((select not habilitado from public.reservas_equipos where codigo_inventario='PANEL-002'),'Retirar cantidad deshabilita sin borrar unidades');
select set_config('test.personal_producto',(public.gestion_guardar_producto(null,'Panel personal','CAMARA','2030-01-10','2030-01-20',array['PERSONAL'],array['PANEL-PERSONAL'],true)).id::text,true);
select public.reservas_crear((select id from public.reservas_equipos where codigo_inventario='PANEL-PERSONAL'),'2030-01-20 23:00-05','2030-01-21 00:00-05','Reserva permitida a personal');
select sigelab_pruebas_panel.ok((select count(*)=1 from public.reservas where solicitante_rol='PERSONAL'),'Personal puede reservar cuando el producto lo permite');
select set_config('request.jwt.claim.sub','f1000000-0000-0000-0000-000000000001',true);
select sigelab_pruebas_panel.ok((select count(*)>=4 from public.reservas_auditoria_admin),'Acciones administrativas auditadas');
set local role anon;
select sigelab_pruebas_panel.error($q$select * from public.admin_listar_cuentas()$q$,'42501');
select sigelab_pruebas_panel.error($q$select * from public.reservas_productos$q$,'42501');
reset role;
rollback;
