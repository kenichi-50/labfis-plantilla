"""Prueba de concurrencia en PostgreSQL local descartable, después de 02 y 06.
No se conecta a Supabase. Inserta datos sintéticos en el contenedor indicado.
Uso: python supabase/tests/panel_concurrencia.py sigelab-admin-validacion
"""
import concurrent.futures
import subprocess
import sys
import threading
container = sys.argv[1]
command = ['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
def sql(query, required=True):
    result = subprocess.run(command,input=query,text=True,encoding="utf-8",capture_output=True,timeout=30)
    if required and result.returncode: raise RuntimeError(result.stderr)
    return result
admin_a='f2000000-0000-0000-0000-000000000001'
admin_b='f2000000-0000-0000-0000-000000000002'
student='f2000000-0000-0000-0000-000000000003'
sql(f"""insert into auth.users(id,email,email_confirmed_at) values
('{admin_a}','panel-race-admin-a@example.invalid',now()),('{admin_b}','panel-race-admin-b@example.invalid',now()),('{student}','panel-race-student@example.invalid',now()) on conflict(id) do nothing;
insert into public.reservas_usuarios(usuario_id,nombre,rol,autorizado) values
('{admin_a}','Admin A','ADMINISTRADOR',true),('{admin_b}','Admin B','ADMINISTRADOR',true),('{student}','Estudiante','ESTUDIANTE',true) on conflict(usuario_id) do nothing;""")
product=sql(f"""begin; set local role authenticated; set local "request.jwt.claim.sub"='{admin_a}';
select (public.gestion_guardar_producto(null,'Carrera configuración','LAPTOP','2035-01-01','2035-01-31',array['ESTUDIANTE'],array['PANEL-RACE-001'],true)).id; commit;""").stdout.strip()
equipment=sql(f"select id from public.reservas_equipos where producto_id='{product}';").stdout.strip()
def race(operations):
    barrier=threading.Barrier(2)
    def run(operation):
        user,query=operation
        barrier.wait(timeout=10)
        return sql(f"""begin;set local role authenticated;set local "request.jwt.claim.sub"='{user}';{query};select pg_sleep(2);commit;""",False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(run,operations))
    if sum(result.returncode==0 for result in results)!=1 or sum(result.returncode!=0 and '22023' in result.stderr for result in results)!=1:
        raise AssertionError([(r.returncode,r.stderr) for r in results])
race([(student,f"select public.reservas_crear('{equipment}','2035-01-15 09:00-05','2035-01-15 10:00-05','Concurrencia')"),
      (admin_a,f"select public.gestion_guardar_producto('{product}','Carrera configuración','LAPTOP','2035-01-01','2035-01-10',array['ESTUDIANTE'],array['PANEL-RACE-001'],true)")])
valid=sql(f"""select not exists(select 1 from public.reservas r join public.reservas_equipos e on e.id=r.equipo_id join public.reservas_productos p on p.id=e.producto_id
where p.id='{product}' and r.estado='ACTIVA' and r.fin>((p.disponible_hasta+1)::timestamp at time zone 'America/Guayaquil'));""").stdout.strip()
assert valid=='t'
print('OK: reserva concurrente y reducción de fechas conservan condiciones válidas sin deadlock')
race([(admin_a,f"select public.admin_guardar_cuenta('{admin_a}','Admin A','ESTUDIANTE',true)"),
      (admin_b,f"select public.admin_guardar_cuenta('{admin_b}','Admin B','ESTUDIANTE',true)")])
count=sql("select count(*) from public.reservas_usuarios where autorizado and rol='ADMINISTRADOR';").stdout.strip()
assert count=='1',count
print('OK: dos cambios de rol simultáneos conservan al último administrador')

