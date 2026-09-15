-- Campaigns need actual email content to send, plus a record of when
-- they were sent. body_html defaults to '' so existing rows (created
-- before this column existed) don't break the NOT NULL constraint.
alter table public.campaigns
  add column if not exists body_html text not null default '',
  add column if not exists sent_at timestamptz;

-- One row per recipient per campaign — this is what makes per-person
-- open/click tracking possible (each row gets a unique token embedded
-- in that person's copy of the email), and lets re-sending a campaign
-- skip anyone already sent to via the unique constraint.
create table if not exists public.campaign_recipients (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  email        text not null,
  token        uuid not null default gen_random_uuid(),
  sent_at      timestamptz not null default now(),
  opened_at    timestamptz,
  clicked_at   timestamptz,
  unique (campaign_id, email)
);

create index if not exists idx_campaign_recipients_campaign on public.campaign_recipients(campaign_id);
create unique index if not exists idx_campaign_recipients_token on public.campaign_recipients(token);

alter table public.campaign_recipients enable row level security;

drop policy if exists "campaign_recipients_admin_read" on public.campaign_recipients;
create policy "campaign_recipients_admin_read" on public.campaign_recipients
  for select using (public.is_admin());

-- No anon/authenticated write grants — every insert/update to this table
-- happens through the send-campaign / campaign-webhook edge functions,
-- which use the service role key and bypass RLS entirely by design
-- (same pattern as track-shipment and remove-background).
grant select on public.campaign_recipients to authenticated;