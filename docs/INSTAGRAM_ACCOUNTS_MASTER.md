# Registro de cuentas de Instagram (`instagram_accounts`)

Tabla privada definida en `supabase/migrations/20261016120000_instagram_ingestion_v2.sql`: RLS activa, sin acceso para anon ni authenticated.

**Estado al 17-oct: migración aplicada y registrada desde el SQL Editor
autenticado.** El conector MCP sigue sin acceso. Se reconciliaron 92 filas
con handle del maestro contra los slugs canónicos: 90 cuentas distintas,
61 activas vinculadas a lugares publicados, 21 candidatas y 8 rechazadas.
El benchmark agregó una candidata nueva: quedan 22. La tabla es privada.
Ver `scripts/seed-instagram-accounts.sql` y el checklist del 17-oct.

## Campos

`username` (PK), `kind`, `status`, `venue_id`, `city`, `origin`, `origin_accounts[]`, `appearances`, `last_post_at`, `last_scraped_at`, `last_checked_at`, `created_at`.

- `kind`: venue, centro_alumnos, universidad, centro_cultural, productora, colectivo, promotor, banda_artista, fiesta_recurrente, other.
- `status`: active, candidate, rejected, paused.

## Criterio del maestro para la siembra inicial

Las cuentas de lugares salen de `docs/data/VENUES_INSTAGRAM_MASTER.md`:

| Estado en el maestro | Entra como |
|---|---|
| `VERIFIED` (63) | `kind=venue`, `status=active`, con `venue_id` |
| `INACTIVE` (6), `NOT_FOUND` (2) | `status=rejected`, con la nota |
| `RENAMED` (barelhuevo) | `barelhuevo` rejected; `el.huevo` active para Balada El Huevo |
| `AMBIGUOUS` (2), `UNVERIFIED` (18) | `status=candidate` hasta revisarlas |

Cuentas que no son lugares (`active` / `candidate` / `rejected`): **0 / 0 / 0** hoy. No se siembra ninguna a mano sin evidencia. Se llenan solo por descubrimiento.

## Descubrimiento

- Fuentes: `mentions`, `taggedUsers` y `coauthorProducers` de los posts que trae Apify, excluyendo la propia cuenta del post. Lo hace `cuentasCitadas()` en `lib/instagram-pilot.ts`.
- Cada cuenta citada entra como `candidate`, nunca `active`. Lleva `origin = mention:<cuenta origen>`, `origin_accounts` y `appearances` (apariciones independientes: cuántas cuentas distintas la citan).
- Una candidata pasa a `active` solo por decisión en /admin, con `kind` asignado.
- No se recorren seguidores ni seguidos.
- Búsqueda web (Brave o Apify Google Search): opcional y acotada. No está activa.
