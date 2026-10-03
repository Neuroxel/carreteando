-- Un "momento" agrupa eventos de una misma ocasión (Mil Tambores, Año Nuevo,
-- semana universitaria) sin una arquitectura de festivales.
alter table public.events add column if not exists moment text;
alter table public.events drop constraint if exists events_moment;
alter table public.events add constraint events_moment check (moment is null or moment ~ '^[a-z0-9-]{3,60}$');
