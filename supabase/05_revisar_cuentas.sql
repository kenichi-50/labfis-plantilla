-- SIGELAB | Revisar solicitudes y permisos | SOLO LECTURA
-- Ejecutar como postgres en el SQL Editor de Supabase.
-- Nombre y tipo solicitados son metadatos editables, NO permisos verificados.
-- Validar la identidad antes de asignar el rol con 03_reservas_configuracion.sql.
select
  u.id as usuario_id,
  u.email as correo,
  (u.email_confirmed_at is not null) as correo_confirmado,
  u.raw_user_meta_data ->> 'full_name' as nombre_solicitado,
  u.raw_user_meta_data ->> 'requested_role' as tipo_solicitado,
  p.nombre as nombre_validado,
  p.rol as rol_asignado,
  coalesce(p.autorizado, false) as reservas_autorizadas
from auth.users u
left join public.reservas_usuarios p on p.usuario_id = u.id
order by u.created_at desc;
