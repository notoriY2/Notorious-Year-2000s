-- 20260915_consent_tracking.sql


alter table public.orders add column if not exists stripe_payment_intent_id text;


create table if not exists public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  email        text not null,
  consent_type text not null,        -- 'marketing_email', 'analytics_tracking'
  granted      boolean not null,
  source       text not null,        -- 'checkout_checkbox', 'footer_signup', 'account_settings'
  ip_address   text,
  created_at   timestamptz not null default now()
);

alter table public.consent_records enable row level security;

create policy "consent_owner_or_admin" on public.consent_records
  for select using (user_id = auth.uid() or public.is_admin());

create policy "consent_insert_self_or_guest" on public.consent_records
  for insert with check (user_id = auth.uid() or user_id is null);