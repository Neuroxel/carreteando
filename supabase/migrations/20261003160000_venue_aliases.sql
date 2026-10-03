-- Cada ticketera escribe el mismo local a su manera ("Aula Magna - Universidad
-- Federico Santa María", "Teatro Aula Magna USM"). Los alias lo reconocen.
alter table public.venues add column if not exists aliases text[] not null default '{}';
