-- LABFIS | DEMOSTRACIÓN EDUCATIVA
-- Ejecutar en Supabase -> SQL Editor (solo una vez).
-- No utilizar datos personales reales.

create table if not exists public.printing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  material text not null default 'PLA' check (material in ('PLA','PETG','ABS')),
  quantity integer not null check (quantity between 1 and 100),
  status text not null default 'Pendiente' check (status in ('Pendiente','En revisión','Aprobada','Rechazada')),
  created_at timestamptz not null default now()
);

alter table public.printing_requests enable row level security;

-- ACL: sólo las cuentas autenticadas tienen permisos de consulta y creación.
revoke all on table public.printing_requests from anon;
grant select, insert on table public.printing_requests to authenticated;

-- RLS: cada estudiante únicamente puede consultar e insertar sus propias solicitudes.
drop policy if exists "printing_read_own" on public.printing_requests;
create policy "printing_read_own" on public.printing_requests
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "printing_insert_own" on public.printing_requests;
create policy "printing_insert_own" on public.printing_requests
for insert to authenticated with check ((select auth.uid()) = user_id);

-- Observación: la demo sólo ofrece SELECT e INSERT; UPDATE y DELETE no están habilitados.
-- Los módulos reales requerirán sus propias tablas, relaciones, permisos y pruebas.
