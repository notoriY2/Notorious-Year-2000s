create table if not exists public.discount_attempt_log (
  session_id text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_discount_attempts on public.discount_attempt_log(session_id, attempted_at);

create or replace function public.check_discount_rate_limit(p_session_id text)
returns boolean language plpgsql as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.discount_attempt_log
    where session_id = p_session_id and attempted_at > now() - interval '1 minute';
  insert into public.discount_attempt_log (session_id) values (p_session_id);
  return v_count < 10;
end;
$$;

grant execute on function public.check_discount_rate_limit(text) to anon, authenticated;

alter table public.discount_attempt_log enable row level security;
create policy "discount_attempt_log_insert_anyone" on public.discount_attempt_log
  for insert with check (true);