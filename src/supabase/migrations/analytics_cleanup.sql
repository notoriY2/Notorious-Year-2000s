-- Drop the per-insert COUNT(*) rate guard — replaced by client-side batching.
drop trigger if exists trg_limit_analytics_rate on public.analytics_events;
drop function if exists public.limit_analytics_rate();

-- Prune old analytics rows nightly.
create or replace function public.prune_old_analytics_events()
returns void language plpgsql as $$
begin
  delete from public.analytics_events where created_at < now() - interval '90 days';
end;
$$;

select cron.schedule('prune-analytics-events', '0 3 * * *', 'select public.prune_old_analytics_events();')
where not exists (select 1 from cron.job where jobname = 'prune-analytics-events');