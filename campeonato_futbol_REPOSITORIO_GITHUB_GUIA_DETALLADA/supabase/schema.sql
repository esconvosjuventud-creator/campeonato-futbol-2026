-- ============================================================
-- CAMPEONATO DE FÚTBOL 2026 — SUPABASE
-- Ejecutar completo en Supabase > SQL Editor > New query > Run.
-- ============================================================

create extension if not exists pgcrypto;

create sequence if not exists public.registration_number_seq start 1;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  upload_token uuid not null default gen_random_uuid(),
  registration_number text unique,
  team_name text not null,
  category text not null check (category in ('M13-15','M16-22','F-LIBRE')),
  delegate_name text not null,
  delegate_ci text not null,
  delegate_birth date,
  delegate_phone text not null,
  delegate_email text not null,
  represented_group text,
  second_contact_name text,
  second_contact_phone text,
  data_consent boolean not null default false,
  final_declaration boolean not null default false,
  status text not null default 'Pendiente' check (status in ('Pendiente','En revisión','Confirmado','Observado','Rechazado')),
  is_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.participants (
  id uuid primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  ci text not null,
  birth_date date not null,
  phone text,
  contact_phone text not null,
  email text,
  fitness_expiry date not null,
  guardian_name text,
  guardian_ci text,
  guardian_relation text,
  guardian_phone text,
  guardian_email text,
  participation_consent boolean not null default false,
  image_consent boolean not null,
  image_consent_at timestamptz not null default now(),
  document_status text not null default 'Documentación completa' check (document_status in ('Documentación completa','Documentación a corregir','Documentación faltante','Verificado')),
  admin_notes text,
  created_at timestamptz not null default now(),
  unique(team_id, ci)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  document_type text not null check (document_type in ('CEDULA','APTITUD')),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  uploaded_at timestamptz not null default now(),
  unique(participant_id, document_type)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.documents enable row level security;
alter table public.admin_users enable row level security;

-- Solo los administradores autenticados pueden leer/modificar tablas directamente.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins select teams" on public.teams;
create policy "admins select teams" on public.teams for select to authenticated using (public.is_admin());
drop policy if exists "admins update teams" on public.teams;
create policy "admins update teams" on public.teams for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins select participants" on public.participants;
create policy "admins select participants" on public.participants for select to authenticated using (public.is_admin());
drop policy if exists "admins update participants" on public.participants;
create policy "admins update participants" on public.participants for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins select documents" on public.documents;
create policy "admins select documents" on public.documents for select to authenticated using (public.is_admin());
drop policy if exists "admins select admin_users" on public.admin_users;
create policy "admins select admin_users" on public.admin_users for select to authenticated using (public.is_admin());

revoke all on public.teams from anon;
revoke all on public.participants from anon;
revoke all on public.documents from anon;
revoke all on public.admin_users from anon;
grant select,update on public.teams to authenticated;
grant select,update on public.participants to authenticated;
grant select on public.documents to authenticated;
grant select on public.admin_users to authenticated;

-- Función auxiliar de edad exacta al 11/09/2026.
create or replace function public.age_on_reference(p_birth date)
returns integer
language sql
immutable
as $$ select extract(year from age(date '2026-09-11', p_birth))::int $$;

-- Crea el borrador y valida reglas sensibles en el servidor.
create or replace function public.create_registration_draft(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t jsonb := payload->'team';
  arr jsonb := payload->'participants';
  n int;
  team_id uuid := gen_random_uuid();
  token uuid := gen_random_uuid();
  p jsonb;
  p_age int;
  p_ci text;
begin
  if (timezone('America/Montevideo', now())::date < date '2026-08-26') or (timezone('America/Montevideo', now())::date > date '2026-09-11') then
    raise exception 'El período de inscripción no está habilitado.';
  end if;
  if t is null or arr is null or jsonb_typeof(arr) <> 'array' then raise exception 'Datos incompletos.'; end if;
  n := jsonb_array_length(arr); if n < 5 or n > 10 then raise exception 'El equipo debe tener entre 5 y 10 participantes.'; end if;
  if coalesce(t->>'category','') not in ('M13-15','M16-22','F-LIBRE') then raise exception 'Categoría inválida.'; end if;
  if nullif(trim(t->>'team_name'),'') is null or nullif(trim(t->>'delegate_name'),'') is null or nullif(trim(t->>'delegate_ci'),'') is null or nullif(trim(t->>'delegate_phone'),'') is null or nullif(trim(t->>'delegate_email'),'') is null then raise exception 'Faltan datos obligatorios del equipo.'; end if;
  if coalesce((t->>'data_consent')::boolean,false) is false or coalesce((t->>'final_declaration')::boolean,false) is false then raise exception 'Faltan consentimientos obligatorios.'; end if;
  if (select count(*) from (select x->>'ci' ci from jsonb_array_elements(arr) x group by x->>'ci' having count(*)>1) d) > 0 then raise exception 'Hay cédulas repetidas en el equipo.'; end if;

  insert into public.teams(id,upload_token,team_name,category,delegate_name,delegate_ci,delegate_birth,delegate_phone,delegate_email,represented_group,second_contact_name,second_contact_phone,data_consent,final_declaration)
  values(team_id,token,trim(t->>'team_name'),t->>'category',trim(t->>'delegate_name'),regexp_replace(t->>'delegate_ci','[^0-9]','','g'),nullif(t->>'delegate_birth','')::date,trim(t->>'delegate_phone'),lower(trim(t->>'delegate_email')),nullif(trim(t->>'represented_group'),''),nullif(trim(t->>'second_contact_name'),''),nullif(trim(t->>'second_contact_phone'),''),true,true);

  for p in select * from jsonb_array_elements(arr) loop
    p_ci := regexp_replace(coalesce(p->>'ci',''),'[^0-9]','','g');
    if nullif(trim(p->>'first_name'),'') is null or nullif(trim(p->>'last_name'),'') is null or nullif(p_ci,'') is null or nullif(p->>'birth_date','') is null or nullif(trim(p->>'contact_phone'),'') is null or nullif(p->>'fitness_expiry','') is null then raise exception 'Faltan datos obligatorios de un participante.'; end if;
    p_age := public.age_on_reference((p->>'birth_date')::date);
    if t->>'category'='M13-15' and (p_age<13 or p_age>15) then raise exception 'Hay un participante fuera del rango 13 a 15 años.'; end if;
    if t->>'category'='M16-22' and (p_age<16 or p_age>22) then raise exception 'Hay un participante fuera del rango 16 a 22 años.'; end if;
    if (p->>'fitness_expiry')::date < date '2026-09-11' then raise exception 'Hay un carné de aptitud física vencido.'; end if;
    if p_age < 18 and (nullif(trim(p->>'guardian_name'),'') is null or nullif(trim(p->>'guardian_ci'),'') is null or nullif(trim(p->>'guardian_relation'),'') is null or nullif(trim(p->>'guardian_phone'),'') is null or coalesce((p->>'participation_consent')::boolean,false) is false) then raise exception 'Falta autorización obligatoria de un menor.'; end if;

    insert into public.participants(id,team_id,first_name,last_name,ci,birth_date,phone,contact_phone,email,fitness_expiry,guardian_name,guardian_ci,guardian_relation,guardian_phone,guardian_email,participation_consent,image_consent)
    values((p->>'id')::uuid,team_id,trim(p->>'first_name'),trim(p->>'last_name'),p_ci,(p->>'birth_date')::date,nullif(trim(p->>'phone'),''),trim(p->>'contact_phone'),nullif(lower(trim(p->>'email')),''),(p->>'fitness_expiry')::date,nullif(trim(p->>'guardian_name'),''),nullif(regexp_replace(coalesce(p->>'guardian_ci',''),'[^0-9]','','g'),''),nullif(trim(p->>'guardian_relation'),''),nullif(trim(p->>'guardian_phone'),''),nullif(lower(trim(p->>'guardian_email')),''),case when p_age<18 then true else true end,coalesce((p->>'image_consent')::boolean,false));
  end loop;
  return jsonb_build_object('team_id',team_id,'upload_token',token);
end; $$;

revoke execute on function public.create_registration_draft(jsonb) from public;
grant execute on function public.create_registration_draft(jsonb) to anon;

-- Valida que la ruta de Storage pertenezca a un borrador reciente y secreto.
create or replace function public.valid_document_upload(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare parts text[]; tid uuid; tok uuid; pid uuid;
begin
  parts := storage.foldername(object_name);
  if array_length(parts,1) <> 3 then return false; end if;
  begin tid:=parts[1]::uuid; tok:=parts[2]::uuid; pid:=parts[3]::uuid; exception when others then return false; end;
  return exists(select 1 from public.teams t join public.participants p on p.team_id=t.id where t.id=tid and t.upload_token=tok and p.id=pid and t.is_submitted=false and t.created_at > now()-interval '3 hours');
end; $$;

revoke execute on function public.valid_document_upload(text) from public;
grant execute on function public.valid_document_upload(text) to anon;

-- Bucket privado (8 MB y tipos permitidos).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('documentos','documentos',false,8388608,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "anonymous controlled uploads" on storage.objects;
create policy "anonymous controlled uploads" on storage.objects for insert to anon with check (bucket_id='documentos' and public.valid_document_upload(name));
drop policy if exists "admins read private documents" on storage.objects;
create policy "admins read private documents" on storage.objects for select to authenticated using (bucket_id='documentos' and public.is_admin());

-- Confirma la inscripción solo si existen exactamente 2 documentos válidos por participante.
create or replace function public.finalize_registration(p_team_id uuid,p_upload_token uuid,p_documents jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  pc int; dc int; d jsonb; reg text;
begin
  if not exists(select 1 from public.teams where id=p_team_id and upload_token=p_upload_token and is_submitted=false and created_at>now()-interval '3 hours') then raise exception 'La sesión de inscripción no es válida o venció.'; end if;
  pc := (select count(*) from public.participants where team_id=p_team_id);
  if jsonb_typeof(p_documents)<>'array' or jsonb_array_length(p_documents)<>pc*2 then raise exception 'La cantidad de documentos no coincide.'; end if;
  for d in select * from jsonb_array_elements(p_documents) loop
    if coalesce(d->>'document_type','') not in ('CEDULA','APTITUD') then raise exception 'Tipo documental inválido.'; end if;
    if not exists(select 1 from public.participants p where p.id=(d->>'participant_id')::uuid and p.team_id=p_team_id) then raise exception 'Participante inválido.'; end if;
    if position(p_team_id::text||'/'||p_upload_token::text||'/'||(d->>'participant_id')||'/' in (d->>'storage_path')) <> 1 then raise exception 'Ruta documental inválida.'; end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='documentos' and o.name=d->>'storage_path') then raise exception 'No se encontró un archivo cargado.'; end if;
    insert into public.documents(participant_id,document_type,storage_path,original_name,mime_type,size_bytes)
    values((d->>'participant_id')::uuid,d->>'document_type',d->>'storage_path',left(d->>'original_name',240),d->>'mime_type',(d->>'size_bytes')::bigint);
  end loop;
  if exists(select 1 from public.participants p where p.team_id=p_team_id and ((select count(*) from public.documents d where d.participant_id=p.id)<>2)) then raise exception 'Falta documentación de un participante.'; end if;
  reg := 'CF2026-' || lpad(nextval('public.registration_number_seq')::text,3,'0');
  update public.teams set registration_number=reg,is_submitted=true,submitted_at=now(),upload_token=gen_random_uuid() where id=p_team_id;
  return jsonb_build_object('registration_number',reg);
end; $$;

revoke execute on function public.finalize_registration(uuid,uuid,jsonb) from public;
grant execute on function public.finalize_registration(uuid,uuid,jsonb) to anon;

-- Bloquea ejecución innecesaria para anon/authenticated.
revoke execute on function public.age_on_reference(date) from public;
grant execute on function public.age_on_reference(date) to anon,authenticated;

-- RECOMENDACIÓN: crear un usuario en Authentication > Users y después ejecutar:
-- insert into public.admin_users(user_id, display_name) values ('UUID_DEL_USUARIO', 'Organización');
