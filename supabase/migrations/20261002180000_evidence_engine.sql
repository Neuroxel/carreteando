-- Automatización 3.0: un evento deja de ser "una fila de una fuente". Cada
-- fuente que lo menciona deja evidencia con lo que afirma (fecha, hora, lugar,
-- estado), y un motor decide con esa evidencia: publicar, descartar, vencer,
-- cancelar o pedir a una persona solo cuando hay contradicción o falta prueba.

create table if not exists public.event_evidence (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  source_id text,
  source_family text,
  -- Dos URLs no son dos fuentes: un directorio que copia la ticketera es la
  -- ticketera. origin_group agrupa lo que tiene el mismo origen real.
  origin_group text not null,
  authority text not null check (authority in ('human','first_party','transactional','directory','community','lead')),
  source_url text,
  retrieved_at timestamptz not null default now(),
  claims jsonb not null default '{}'::jsonb,
  structured boolean not null default false,
  active boolean not null default true
);
create index if not exists event_evidence_event on public.event_evidence(event_id);
create unique index if not exists event_evidence_dedupe
  on public.event_evidence(event_id, origin_group, coalesce(source_url,''), (claims->>'date'), coalesce(claims->>'start_time',''), coalesce(claims->>'status',''));
alter table public.event_evidence enable row level security;

create table if not exists public.automation_decisions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_id bigint references public.events(id) on delete set null,
  decision text not null check (decision in ('AUTO_PUBLISH','AUTO_PROMOTE_FROM_REVIEW','AUTO_REJECT','AUTO_EXPIRE','AUTO_CANCEL','REVIEW_CONFLICT','REVIEW_INSUFFICIENT','KEEP')),
  applied boolean not null default false,
  mode text not null check (mode in ('shadow','active','backtest')),
  reasons jsonb not null default '[]'::jsonb,
  supporting jsonb not null default '[]'::jsonb,
  conflicting jsonb not null default '[]'::jsonb,
  previous jsonb
);
create index if not exists automation_decisions_event on public.automation_decisions(event_id, created_at desc);
alter table public.automation_decisions enable row level security;

create table if not exists public.automation_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  note text
);
alter table public.automation_config enable row level security;
insert into public.automation_config(key, value, note) values
  ('engine_mode', 'shadow', 'shadow: solo registra lo que haría. active: aplica. Se cambia después del backtest.')
on conflict (key) do nothing;

alter table public.events
  add column if not exists event_status text not null default 'scheduled',
  add column if not exists auto_decision text,
  add column if not exists auto_reasons jsonb,
  add column if not exists auto_decided_at timestamptz,
  add column if not exists human_reason text;
alter table public.events drop constraint if exists events_event_status;
alter table public.events add constraint events_event_status check (
  event_status in ('scheduled','cancelled','postponed','rescheduled'));

alter table public.event_sources
  add column if not exists reviewed_n integer not null default 0,
  add column if not exists confirmed_n integer not null default 0,
  add column if not exists serious_errors integer not null default 0,
  add column if not exists precision_lb numeric,
  add column if not exists earned_trust text,
  add column if not exists trust_changed_at timestamptz,
  add column if not exists trust_reason text;
