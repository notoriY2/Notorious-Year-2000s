-- Ensure Viewer exists on the enum (idempotent, safe to re-run)
do $$ begin
  alter type admin_role_type add value if not exists 'Viewer';
exception when others then null; end $$;

create or replace function public.invite_admin_user(
  p_email text,
  p_role  public.admin_role_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can invite team members';
  end if;

  insert into public.admin_email_allowlist (email, admin_role)
  values (lower(p_email), p_role)
  on conflict (email) do update set admin_role = excluded.admin_role;

  update public.profiles
    set is_admin = true, admin_role = p_role, admin_status = 'Active'
  where lower(email) = lower(p_email);
end;
$$;

grant execute on function public.invite_admin_user(text, public.admin_role_type) to authenticated;