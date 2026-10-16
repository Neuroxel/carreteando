# Ingesta de Instagram v2

Rama `feat/instagram-ingestion-v2`. Reutiliza lo existente: `instagram_pilot_runs`/`items`, `event_sources`, `event_evidence`, `review_audit`, `automation_config`, `lib/instagram-pilot.ts`, `lib/event-extraction.ts`, `/api/cron/piloto-instagram` y `/admin`. No hay base paralela ni reescritura.

## Reglas

- Toda adquisición pasa por Apify. No se usan sesión propia, cookies, crawler propio, cuentas privadas ni seguidores o comentarios.
- Instagram es pista. Un post nunca publica solo: el motor de 7 reglas sigue siendo la autoridad de publicación.
- No hay un umbral global de confianza. Si falta un campo crítico (fecha, hora, lugar), el candidato va a revisión.
- Las URLs de medios (`display_url_temp`) son temporales y privadas. Un job diario de pg_cron las borra (`purge_instagram_media_urls`, 04:45). Se guarda la URL del post original y no se fabrican imágenes.

## Flujo

1. **Corrida**: `GET /api/cron/piloto-instagram?cohorte=A|B|BENCH&actor=…`.
   - Se arma a mano (`automation_config.instagram_pilot = armed-<cohorte>-<scraper|post>`) y se consume al empezar, así que cada corrida pasa una sola vez.
   - `maxItems = cuentas × 3` y `maxTotalChargeUsd = TOPE_USD[cohorte]` (BENCH 0,25, A 0,50, B 0,50).
   - Ventana: `onlyPostsNewerThan` de 7 días. Los fijados viejos se descartan.
2. **Evidencia cruda** (`instagram_pilot_items`): post_url, shortcode, cuenta, caption, posted_at, retrieved_at, tipo, mentions, tagged_users, coauthors, location, display_url_temp, actor, cohort, apify_run_id, candidate, outcome.
3. **Extracción** (`candidatoDesdeTexto`): caption → parse determinista → lugar desde el registro de cuentas (no desde el texto) → `needs_vision` si falta lo crítico y hay imagen.
   - Salida estricta: is_event, title, start_date, time, venue, address, city, price, ticket_url, event_type, field_source, critical_missing_fields, cancelled, needs_vision, source_post_url.
   - Las fechas relativas ("este viernes") se resuelven contra la fecha del post en America/Santiago.
4. **Descubrimiento**: las cuentas citadas entran como `candidate` en `instagram_accounts` (ver `INSTAGRAM_ACCOUNTS_MASTER.md`).
5. **Revisión** en /admin, sección "Pistas de Instagram": post de origen, cuenta, fecha, valores extraídos con su procedencia (caption/visión/cuenta), campos faltantes, coautores y decisión.
6. **Dedupe** (sin cambios en el motor): fecha + venue_id + hora + organizador/título/alias. Un post colaborativo es un solo evento con varias evidencias.

## Cadencia

No se programa nada pagado. Si el piloto 2 da al menos 3 eventos únicos útiles por corrida y menos de 10 minutos de revisión por evento, se propone jueves en la tarde + sábado a mediodía. Las corridas serían incrementales: `last_post_at` por cuenta, `onlyPostsNewerThan` y tope por corrida.

## Visión (RTX 4070 Ti Super local)

- Medición sobre el corpus real del piloto 1: de 14 posts con contenido de evento, 3 eran solo imagen. Eso da **≈79 % suficiente con caption** y **≈21 % necesita flyer** (n = 14, muestra chica).
- **Benchmark de modelos: DIFERIDO.** Hay 3 flyers reales; la condición era 20 a 30. Además, la base no estaba accesible para leer el corpus completo. Se rehace con el corpus del piloto 2.
- Si se justifica, el diseño es un worker local saliente y opcional: lee candidatos `needs_vision`, usa el modelo multimodal más chico que acierte en Ollama y devuelve campos con `field_source = vision`. No es una dependencia de producción, no expone servidor y no usa la service-role key en un proceso expuesto. Si el PC está apagado, los candidatos esperan. Nunca publica ni rechaza.

## Estado

| Pieza | Estado |
|---|---|
| Código + tests (153 OK) | listo, en la rama |
| Migración `20261016120000_instagram_ingestion_v2.sql` | escrita, **no aplicada** (conector de Supabase sin acceso) |
| Despliegue | **no hecho**: requiere merge a `main` autorizado por el dueño |
| Benchmark BENCH | pendiente del despliegue |
| Piloto 2 (A + B, ≤ USD 1,00) | pendiente del despliegue y del maestro (maestro hecho) |
