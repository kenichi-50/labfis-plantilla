-- SIGELAB | Configuracion inicial | Ejecutar como postgres en SQL Editor.
-- Primero ejecutar 02_reservas.sql y registrar las cuentas con Supabase Auth.
-- Repetir este bloque para cada cuenta autorizada, cambiando correo, nombre y rol.
-- Nadie obtiene permisos automaticamente por registrarse.
begin;
do $$
declare
  v_correo text := 'CAMBIAR_POR_CORREO_DE_LA_CUENTA';
  v_nombre text := 'CAMBIAR_POR_NOMBRE';
  v_rol text := 'ESTUDIANTE'; -- ESTUDIANTE, DOCENTE, PERSONAL o ADMINISTRADOR
  v_usuario uuid;
begin
  if v_correo = 'CAMBIAR_POR_CORREO_DE_LA_CUENTA' or v_nombre = 'CAMBIAR_POR_NOMBRE' then
    raise exception 'Edite el correo, nombre y rol antes de ejecutar este script.';
  end if;
  select id into v_usuario from auth.users where lower(email) = lower(btrim(v_correo));
  if v_usuario is null then
    raise exception 'La cuenta no existe en Supabase Auth. Registrela primero.';
  end if;
  insert into public.reservas_usuarios (usuario_id, nombre, rol, autorizado)
  values (v_usuario, btrim(v_nombre), v_rol, true)
  on conflict (usuario_id) do update
    set nombre = excluded.nombre, rol = excluded.rol, autorizado = excluded.autorizado;
end;
$$;
commit;

-- CATALOGO: insertar cada equipo fisico con su codigo real y unico.
-- Descomente y reemplace estos ejemplos ANTES de ejecutar la seccion.
-- No son equipos del inventario real; no se insertan automaticamente.
-- insert into public.reservas_equipos (codigo_inventario, nombre, tipo) values
-- ('REEMPLAZAR-CODIGO-1', 'Proyector del laboratorio', 'PROYECTOR'),
-- ('REEMPLAZAR-CODIGO-2', 'Laptop del laboratorio', 'LAPTOP'),
-- ('REEMPLAZAR-CODIGO-3', 'Camara del laboratorio', 'CAMARA'),
-- ('REEMPLAZAR-CODIGO-4', 'Cable HDMI', 'CABLE'),
-- ('REEMPLAZAR-CODIGO-5', 'Adaptador USB-C a HDMI', 'ADAPTADOR');

-- Para retirar autorizacion sin borrar el historial (reemplazar UUID):
-- update public.reservas_usuarios set autorizado = false where usuario_id = 'UUID';
-- Para impedir nuevas reservas de un equipo, sin borrar las existentes:
-- update public.reservas_equipos set habilitado = false where id = 'UUID';
