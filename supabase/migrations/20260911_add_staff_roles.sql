-- Staff usernames and scoped administration roles
alter table public.admin_users
  add column if not exists username text,
  add column if not exists role text not null default 'ADMIN',
  add column if not exists must_change_password boolean not null default false;

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('ADMIN', 'SPORTS_EDITOR', 'DOCUMENT_REVIEWER'));

create unique index if not exists admin_users_username_lower_key
  on public.admin_users (lower(username))
  where username is not null;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.admin_users
  where user_id = auth.uid() and role = 'ADMIN'
) $$;

create or replace function public.can_access_panel()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.admin_users where user_id = auth.uid()
) $$;

create or replace function public.can_manage_sports()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.admin_users
  where user_id = auth.uid() and role in ('ADMIN', 'SPORTS_EDITOR')
) $$;

create or replace function public.can_review_documents()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.admin_users
  where user_id = auth.uid() and role in ('ADMIN', 'SPORTS_EDITOR', 'DOCUMENT_REVIEWER')
) $$;

create or replace function public.get_my_staff_profile()
returns table(username text, display_name text, role text, must_change_password boolean)
language sql stable security definer set search_path = public
as $$
  select a.username, a.display_name, a.role, a.must_change_password
  from public.admin_users a where a.user_id = auth.uid()
$$;

create or replace function public.finish_password_change()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.admin_users
  set must_change_password = false
  where user_id = auth.uid();
end;
$$;

create or replace function public.review_participant_document(
  p_participant_id uuid,
  p_document_status text,
  p_admin_notes text
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_review_documents() then
    raise exception 'Not authorized';
  end if;

  update public.participants
  set document_status = p_document_status,
      admin_notes = p_admin_notes
  where id = p_participant_id;
end;
$$;

revoke all on function public.get_my_staff_profile() from public;
revoke all on function public.finish_password_change() from public;
revoke all on function public.review_participant_document(uuid, text, text) from public;
grant execute on function public.get_my_staff_profile() to authenticated;
grant execute on function public.finish_password_change() to authenticated;
grant execute on function public.review_participant_document(uuid, text, text) to authenticated;
