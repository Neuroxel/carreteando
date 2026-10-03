-- Preparación para un futuro destacado pagado. Invariante: la ubicación pagada
-- nunca cambia confianza, frescura, estado en vivo ni verificación; es una
-- columna aparte que el motor de decisión no lee.
alter table public.events add column if not exists placement text not null default 'organic';
alter table public.events drop constraint if exists events_placement;
alter table public.events add constraint events_placement check (placement in ('organic','promoted'));
