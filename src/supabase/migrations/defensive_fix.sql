-- Make the notification trigger bulletproof and definer-owned
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
  -- never let a notification failure block account creation
  raise warning 'notify_new_customer failed: %', sqlerrm;
  return new;
end;
$$;

-- Belt-and-braces: make handle_new_user itself non-fatal too
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_role admin_role_type;
begin
  select true, a.admin_role into v_is_admin, v_role
  from public.admin_email_allowlist a
  where lower(a.email) = lower(new.email);

  insert into public.profiles (id, email, name, provider, is_admin, admin_role, admin_status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'provider', ''), 'email')::provider_type,
    coalesce(v_is_admin, false),
    v_role,
    'Active'
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.email, sqlerrm;
  return new;  -- still let the auth user get created
end;
$$;

-- Make sure the auth service role can reach everything the trigger touches
grant usage on schema public to supabase_auth_admin;
grant select on public.admin_email_allowlist to supabase_auth_admin;
grant select, insert on public.profiles to supabase_auth_admin;
grant insert on public.admin_notifications to supabase_auth_admin;
grant usage, select on all sequences in schema public to supabase_auth_admin;