# Migraciones

Las migraciones de esquema viven aquí como archivos. Además se aplicaron dos
migraciones **de datos** (insert-only, sin DDL) cuyo contenido se deriva de
archivos versionados y no se repite aquí:

- `phase4_venue_baseline`: carga inicial de `public.venues` a partir de
  `data/venues.json`. Inserta con `ON CONFLICT (slug) DO NOTHING`, así que
  reaplicarla nunca pisa una corrección hecha después en el panel.
- `phase4_portaldisc_event_baseline` y `phase4_portaldisc_event_images`:
  carga de la selección editorial nueva desde `data/editorial-events.json`,
  con `ON CONFLICT (instagram_id) DO NOTHING` por la misma razón.

Ninguna de las dos reactiva un evento retirado ni renueva una fecha de revisión.
