-- Aplicado desde el SQL Editor autorizado del proyecto canónico.
-- Conserva respaldos y acceso administrativo; elimina lectura pública.
alter table public.backup_events_review_20261012 enable row level security;
alter table public.backup_venues_ops_20261012 enable row level security;
alter table public.backup_venues_vina_renaca_20261012 enable row level security;
revoke all on public.backup_events_review_20261012,
  public.backup_venues_ops_20261012, public.backup_venues_vina_renaca_20261012
  from public, anon, authenticated;
grant all on public.instagram_accounts to service_role;
