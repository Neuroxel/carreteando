# Donde Salgo — ejecución coordinada para cobertura real (11-nov-2026)

**Dueño del estado canónico:** Nexo, con SQL de solo lectura en la base original de Supabase `carretes` (ref `hgwljbtqdserkdhulbts`, organización *tpotp's Org*, conexión *Tpotp*). `main` y producción no se reemplazan con el nuevo proyecto vacío `dondesalgo` de Neuroxel.

## Punto de partida verificado

- **148** recintos públicos (de **416** filas históricas), **82** eventos públicos aprobados y vigentes (de **712** históricos), **34** filas `pending/review` sin publicar.
- De los 148 recintos, **86** tienen pin utilizable y **62 carecen de geocodificación suficientemente válida**; 4 carecen de zona, 9 de dirección y 17 de fuente principal de programación.
- Brechas de pins por ciudad almacenada: **Valparaíso 31**, **Viña del Mar 9**, **Reñaca 3**, **Concón 7**, La Calera 3, Quilpué 3, Quintero 2, Quillota 1, Limache 1, Olmué 1, Puchuncaví 1.
- 56 fuentes registradas, 46 activas, 458 ejecuciones en 7 días, **0 `new_events`**, **44 `queued` acumulados entre ejecuciones** (no equivale a 44 eventos únicos). Su éxito técnico NO demuestra cobertura editorial.
- La base ya contiene respaldos de recintos, evidencias, `review_audit` e `instagram_accounts`. No inventar datos ni crear registros duplicados.
- Los antiguos trabajos Gemini del 16-oct partieron de 159 registros CSV, con 63 marcados VERIFIED **en el CSV de entrada** pero **0 sublotes web ejecutados**. Lo que se llamó VERIFIED no se acepta como validación actual. El reporte Claude de noviembre contiene casos de colisión, agregaciones y URLs reutilizadas; hay que cotejar con la DB antes de declarar `NEW`.

**Inventario primario generado desde SQL real:** [62 locales sin pin](data/venues-sin-pin-publicados-2026-11-11.csv). Este CSV es **cola de verificación, no fuente geográfica ni licencia para geocodificar por intuición**.

### Modelo territorial que no debe romperse

`Región de Valparaíso → comuna administrativa → sector/barrio → recinto físico → ocurrencia de evento`.
- **Reñaca es un sector de Viña del Mar**, aunque `venues.city='Reñaca'` aparece como alias de catálogo histórico: no reescribir a ciegas las filas ni romper filtros.
- `Okko music lab` pertenece a **Concón**, no a Viña solo porque el slug termine en `-renaca`.
- `Manda Viña` y `Manda Reñaca` son entidades físicas distintas.
- `Hollywood Pub / Experience Viña` son un mismo lugar en Merino 57 salvo evidencia contraria.
- No mezclar **Casa Cochoa (Borgoño 16660)** con **Brisamar (Borgoño 12041)**.
- Antes de corregir Ipanema/Jaggers, LOCOS/Cantina/Psiquis, Idílico/Schopería 4½, **HOLD** y documentar la evidencia contradictoria.
- Polígonos de Valparaíso en `data/territorios.json` y `public/territorios.geojson` provienen del SIG municipal; no fingir polígonos oficiales de Viña/Concón donde aún faltan. PR #61 arregla identidad de URL/agrupación.

## Prompts listos para los agentes

### CLAUDE · titular de eventos/ingesta y franja Viña–Reñaca–Concón

> Actúa como auditor de producción y desarrollador de cobertura de Donde Salgo en `Neuroxel/carreteando`. Trabaja únicamente sobre tu rama `feat/claude-cobertura-eventos-2026-11` y crea un PR; no edites las ramas `fix/zonas-con-identidad-comunal-2026-11`, `ops/cobertura-geografia-fuentes-2026-11` ni la de Gemini.
>
> 1. Lee `CURRENT_STATE.md`, `docs/COVERAGE_INCIDENT_2026-10-23.md`, `lib/sources/*`, `lib/editorial-feed.ts`, `data/editorial-events.json`, `data/venue-routes.json`, PR #60 y este documento. Interroga la base original `hgwljbtqdserkdhulbts` **en modo solo lectura**, si tienes acceso. Confirma o contradice con SQL el embudo: 46 fuentes activas, 458 runs/7d, `new_events=0`, `queued=44` sumados y 34 pending/review. Diferencia fallos de extracción, filtros por tiempo/comuna, identidad de ocurrencia, duplicados, cola y aprobación. Produce 10 ejemplos reproducibles.
> 2. Revisa para **12-nov-2026 a 08-feb-2027** los eventos genuinamente nuevos en Viña del Mar, Reñaca y Concón. Fuente individual de venta/organizador fechada; nada de enlaces genéricos, citas a snippets, reuse de un URL de Halloween para otro evento, ni precios agotados como disponibles. Cada registro: `title/date/time/venue_slug/comuna_administrativa/address/source_detail_url/price_clp_nullable/status/reviewed_at/evidence`. Cruza por URL, fecha, hora, venue/alias y `event_key` con la base antes de `NEW`.
> 3. En el CSV de 62 sin pin, asigno a ti exclusivamente los **19** de `Viña del Mar` (9), `Reñaca` (3) y `Concón` (7). Verifica el negocio, dirección precisa y coordenadas únicamente mediante fuente autorizada que permita uso (p. ej. geometría OSM con procedencia/licencia compatible o geocodificador oficial). Si no puedes demostrar precisión, entrega `HOLD` sin lat/lng. Clasifica entidad, sede, área real, alias y conflicto.
> 4. Soluciona en código solamente las fallas de captura reproducidas con tests de dedupe, fecha/hora, no sobrepublicación y costo. **No modificar la DB de producción, activar Apify, tocar DNS, secretos ni migrar Supabase**. Producción se publica por Nexo después de pruebas.
> 5. Entrega PR + `docs/evidence/CLAUDE_COVERAGE_2026-11.md` con SQL/queries, resultados, hashes, links de fuentes, tabla de diferencias y archivos JSON/CSV de candidatos `VERIFIED/HOLD/REJECT`.
>
> **Criterio de salida:** cero inventados; ci y tests en verde; entre 8–15 candidatos verificables si existen (no inventar para cumplir número), explicación completa del embudo, 19 recintos auditados con fuentes. Si careces de credenciales o navegador, produce archivos de investigación con incertidumbre explícita sin afirmar acceso a herramientas.

### GEMINI · titular de recintos/mapa/taxonomía Valparaíso e interior

> Actúa como investigador geoespacial y curador territorial de Donde Salgo (`Neuroxel/carreteando`). Trabaja en tu rama aislada `research/gemini-geografia-2026-11`, sin editar la rama ni el área de ingesta de Claude. Usa el CSV canónico `docs/data/venues-sin-pin-publicados-2026-11-11.csv` generado desde Supabase el 11-nov-2026; no uses el CSV de 159 locales de octubre como si fuese inventario actual.
>
> 1. Te asigno exclusivamente los **43 recintos sin pin fuera de Viña/Reñaca/Concón**: Valparaíso 31; La Calera 3; Quilpué 3; Quintero 2; Quillota 1; Limache 1; Olmué 1; Puchuncaví 1. Búsqueda web propia **desde cero** en lotes de máximo 15; no declarar sublotes completos si no visitaste las fuentes. Conserva slug original y compara nombres/alias, dirección, comuna, sector, identificadores OSM, fecha de vigencia y fuente específica; no confundir actividad Instagram con local abierto.
> 2. Produce por recinto `slug,comuna_administrativa,sector,barrio,address_verified,lat,lng,accuracy,geocode_provider,source_url,source_type,verified_at,license/terms,confidence,decision`. Usa `null` para lat/lng si no existe evidencia suficiente. **No extraigas coordenadas mediante scraping prohibido de Google Maps**; Google Places solo vía API oficial y respetando condiciones; preferir fuentes OSM o municipales con licencia verificada, sin inventar polígonos.
> 3. Especial atención a sectores **Cerro Alegre/Concepción, Barrio Puerto, Almendral, Plan, Cumming, Subida Ecuador, Curauma/Placilla** y comunas secundarias. Reconciliar contra `data/territorios.json`/SIG municipal, sin reemplazar el polígono oficial por una aproximación. Tratar `Reñaca` como barrio de Viña pero no tocar los 19 recintos de Claude. Diferenciar locales permanentes de espacios usados ocasionalmente para eventos.
> 4. Buscar huecos de **recintos nuevos** en esas mismas áreas, incluyendo recintos sin eventos recientes; demostrar existencia/sede/actividad de cada propuesta. No subir duplicados ni asumir que datos viejos de Gemini son nuevos. Los casos conflictivos (Okko, Manda, Hollywood, Casa Cochoa/Brisamar, Ipanema/Jaggers, LOCOS/Psiquis e Idílico/Schopería) requieren `HOLD` hasta resolución con al menos dos evidencias independientes.
> 5. Entrega `docs/evidence/GEMINI_GEO_2026-11.md`, CSV de diferencias reproducible y una rama/PR de documentación; si propones coordenadas para DB, entrégalas como `PROPOSED` con fuentes y **sin SQL de actualización masiva**. Nexo autoriza/applica cada lote tras revisar licencias y precisión.
>
> **Criterio de salida:** 43/43 filas auditadas con decision `VERIFIED/HOLD/REJECT`, sin obligación de conseguir coordenadas para las que no existan; candidatos nuevos separados; etiquetas de comuna, sector y barrio trazables. Reportar cobertura real ganada, no números inflados de búsquedas.

## Reglas comunes y adjudicación

1. Cada agente lee el inventario y compara con `carretes`/catálogo actual antes de proponer inserción.
2. Entrega **una sola evidencia específica por afirmación principal**, con URL primaria y timestamp; distingue lo dicho por la fuente, lo observado, inferencia y verificación externa.
3. Publicaciones programadas, fechas pasadas y recintos sin actividad reciente NO implican `activo ahora`. No se infieren horarios, precios, stock ni coordenadas.
4. Inventario de gaps: `52 / 62` sería avance **solo** si 52 registros obtienen pin autorizado, no si se rellena un CSV; mide `map_coverage = valid_public_pins / public_venues` por comuna. Añadir `event_coverage`: recintos con programación próxima verificada, fuentes críticas actualizadas y eventos sin fuente.
5. Presupuesto Apify máximo histórico US$3/mes, PAUSADO; no se habilita por defecto.
6. Los agentes entregan PRs y evidencia, **no realizan merge/deploy/import SQL**. Nexo hace QA/reconciliación, la publicación y evalúa que la web `dondesalgo.cl` corresponde al Vercel correcto.

## Gates de publicación

- **G0** Base `carretes` accesible, RLS activo, datos y respaldo identificados: PASS.
- **G1** Rutas por comuna y compatibilidad retrospectiva (PR #61): CI y preview pendientes, no declarar PASS antes de controles.
- **G2** Geocodificación: 62 pendientes con base rastreable; 4 sin zona; no usar pines ficticios.
- **G3** Cartelera: explicar 0 eventos nuevos/7d y resolver cola sin publicar contenido no verificado.
- **G4** Integración editorial: PR #60 con dos fichas en revisión; comprobar si ya existen en la DB y revalidar fechas/precios antes de importar.
- **G5** Despliegue: `main`, Vercel `Neuroxel/carreteando` accesible; el equipo `Neuroxel` no listó aún `dondesalgo.cl` como dominio del proyecto. Usuario afirma que lo administra Neuroxel; confirmar la vinculación exacta sin mover DNS ni tocar producción por conjetura.

**Estado de referencia:** nuevos agentes deben citar este documento y mantener cada PR aislada por dueño y propósito.
