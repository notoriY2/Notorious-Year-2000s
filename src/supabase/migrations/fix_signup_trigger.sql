-- ============================================================================
-- FIX: "type admin_role_type does not exist" during signup
--
-- Root cause: handle_new_user() is SECURITY DEFINER but has no
-- `set search_path`. It's fired by the Auth service role
-- (supabase_auth_admin) inserting into auth.users. That role's default
-- search_path does not reliably include `public`, so the unqualified
-- reference to `admin_role_type` (a type that lives in public) fails
-- with 42704, aborting the whole signup transaction and surfacing as
-- Auth's generic "Database error saving new user" / 500.
--
-- Fix: pin search_path = public on every SECURITY DEFINER function this
-- trigger chain touches, and make the whole chain non-fatal so a bug in
-- notifications/allowlist lookups can never again block account
-- creation.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_role public.admin_role_type;
begin
  select true, a.admin_role into v_is_admin, v_role
  from public.admin_email_allowlist a
  where lower(a.email) = lower(new.email);

  insert into public.profiles (id, email, name, provider, is_admin, admin_role, admin_status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'provider', ''), 'email')::public.provider_type,
    coalesce(v_is_admin, false),
    v_role,
    'Active'
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- Never let a profile-creation hiccup block the underlying auth
  -- account from being created. Log it so it's still visible in
  -- Postgres logs, but don't re-raise.
  raise warning 'handle_new_user failed for %: % (%)', new.email, sqlerrm, sqlstate;
  return new;
end;
$$;

create or replace function public.notify_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_admin then
    insert into public.admin_notifications (title, description, type)
    values ('New Customer Account', new.email || ' registered a new account.', 'customer');
  end if;
  return new;
exception when others then
  raise warning 'notify_new_customer failed for %: % (%)', new.email, sqlerrm, sqlstate;
  return new;
end;
$$;

-- Belt-and-braces: pin search_path on the other SECURITY DEFINER auth
-- helper functions too, in case they're ever called from a session
-- whose search_path doesn't include public.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_admin_write()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.is_admin and p.admin_role is distinct from 'Viewer'
     from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Make sure the auth service role can actually reach everything this
-- trigger chain touches (belt-and-braces; usually already granted by
-- Supabase's bootstrap, but cheap to re-assert).
grant usage on schema public to supabase_auth_admin;
grant select on public.admin_email_allowlist to supabase_auth_admin;
grant select, insert on public.profiles to supabase_auth_admin;
grant insert on public.admin_notifications to supabase_auth_admin;
grant usage, select on all sequences in schema public to supabase_auth_admin;

-- ============================================================================
-- DONE. Try signing up again — it should now succeed even in edge cases
-- (missing allowlist row, notification insert failure, etc.).
-- ============================================================================
