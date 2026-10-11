-- Piloto de Instagram: además de contar eventos únicos, contar cuántos son baratos.
alter table public.instagram_pilot_items add column if not exists price_bucket text
  check (price_bucket is null or price_bucket in ('gratis','hasta_5000','hasta_10000','mas_de_10000','desconocido'));
