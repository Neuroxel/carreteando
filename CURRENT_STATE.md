# Dónde Salgo? — estado canónico actual

**Este documento describe el presente.** La historia y checkpoints anteriores están en `docs/historia/` y en los informes fechados de `docs/`. Si contradicen este archivo, manda este archivo.

Última consolidación: **17 de octubre de 2026, Chile**. Rama canónica: `main`.

## Producto

**Dónde Salgo?** descubre carretes, conciertos, tocatas, comedia y vida nocturna de la Región de Valparaíso. Modela por separado **lugares** y **eventos**. No vende entradas: conserva la fuente y deriva al origen.

Arquitectura **client-first**: snapshot cacheado y filtros/búsqueda/mapa locales en el teléfono; backend para ingestión, moderación y escrituras.

## Producción y repositorio

| Componente | Estado |
|---|---|
| Repo | `Neuroxel/carreteando` |
| Producción canónica | `https://dondesalgo.vercel.app` |
| Alias antiguo | `https://carreteando.vercel.app` redirige permanentemente al dominio canónico |
| Base canónica | Supabase / PostgreSQL, proyecto `hgwljbtqdserkdhulbts` |
| Framework | Next.js 15 App Router |
| Catálogo versionado | **147 lugares publicados**, snapshot generado 2026-10-17T16:06:54Z |
| Estado de despliegue | merges recientes con CI y checks de Vercel; verificar siempre el SHA final antes de declarar producción lista |

## UX aprobada por Carlos

Navegación: **Carretes · Boliches · Radar · Aportar**.

- Radar abre en **Carretes hoy**; puede cambiar a Boliches.
- GPS se solicita **solo al entrar a Radar** o al pedir cercanía.
- La ubicación queda en el navegador: no se almacena ni se envía al backend.
- `Permissions-Policy` permite `geolocation=(self)` y mantiene cámara/micrófono bloqueados.
- Evento de hoy: marcador distintivo; boliches sin evento: punto atenuado.
- Carretes vuelve realmente a la lista, no deja el mapa activo.
- En Carretes, los eventos nocturnos se ordenan antes de los diurnos del mismo día.

QA responsive automatizada/capturas: 360, 375, 390, 430 y escritorio. **Pendiente:** prueba final en Android/iPhone físico.

## Datos y cobertura

No presentar una cifra de eventos como “actual” si no se leyó la DB/snapshot vivo.

- Última observación pública documentada del 17-oct: **16 planes hoy en Valparaíso**, después de incorporar Liberty. Es una observación histórica del turno, no una garantía del conteo actual.
- El feed editorial versionado conserva decisiones humanas y se deduplica contra filas existentes en cualquier estado.
- La cobertura automática de #6 incluye:
  - PortalTickets/PortalDisc (carteleras y recorrido regional);
  - Vesti por compañía con host exacto;
  - Evently con subdominio exacto;
  - API oficial de Cinzano;
  - presupuesto de fuentes, rotación anti-inanición, deadline por request y dedupe paginado.
- `data/catalogo-publico.json` contiene los 147 lugares y obliga a reportar como `PENDING` los locales sin ruta; no se confunde falta de ruta con “sin eventos”.
- Una ruta vacía no prueba ausencia de programación. Un anuncio vigente sin stock verificable no se marca `AVAILABLE`.

### Programación automática

Cuatro turnos diarios, separados seis horas:
- Supabase pg_cron: **00:00, 06:00 y 12:00 UTC**.
- Vercel cron: **18:00 UTC**.

El endpoint es `/api/cron/scrape`; la reserva de corrida aplica cooldown de tres horas.

**Pendiente operativo:** comprobar una corrida completa posterior al merge final y verificar que refresque snapshot + páginas públicas.

## Provenance

- No se inventan horario, precio, dirección, disponibilidad ni estado de apertura.
- Fuente primaria > índice/agregador.
- Conflictos permanecen visibles; si la hora no se puede resolver, `time: null`.
- `apify_instagram`/Instagram se muestra como Instagram; Facebook/Google conservan su origen; otros adaptadores web se muestran como **web**, no como Instagram.
- Los hallazgos de Gemini obtenidos sólo desde snippets son **pistas**, no verificación.
- Antigravity puede aportar evidencia `LIVE_FETCH`; se reconcilia contra catálogo/DB antes de publicar.

## Instagram / Apify

El trabajo incremental existe parcialmente en el PR legado #2, pero **#2 no debe mergearse completo**: quedó basado en un main anterior y solapa cambios ya integrados.

Siguiente trabajo de Claude:
1. partir desde el `main` actual;
2. rescatar sólo la lógica incremental de Instagram/Apify y sus tests;
3. conservar redirects, Radar, cobertura #6 y provenance posterior;
4. no ejecutar Apify recurrente hasta que exista un **tope mensual explícito**;
5. no inventar handles ni usar login personal.

## Estado de integración 17-oct

Integrado:
- #4 — lote editorial Woo/Studio/Cómpeta/Ignacio.
- #6 — cobertura por local/día, Vesti/Evently, dedupe, Cinzano, Liberty.
- #7 — política de geolocalización para Radar.
- #9 — provenance pública web ≠ Instagram.

PR #2 queda como **legado/handoff**: no mergear completo.

## Bloqueos y pendientes de lanzamiento

1. **Supabase MCP:** en el chat coordinador actual el proyecto conocido responde “no tienes permiso”; no se puede inspeccionar/limpiar admin ni forzar una importación hasta restaurar acceso.
2. **Ingesta post-merge:** verificar la siguiente corrida programada y el conteo público resultante.
3. **Admin:** confirmar cola sin stale items desde DB real.
4. **Móvil físico:** ejecutar QA final Android/iPhone.
5. **Apify:** definir presupuesto recurrente antes de activar Instagram.
6. **Seguridad Vercel:** confirmar que el bypass secret legado de `carreteando3d` haya sido revocado.
7. **Fuentes nuevas:** priorizar ComedyPass/ComediaTicket y rutas oficiales que hoy quedan fuera de los adaptadores gratuitos; Google sirve para descubrir rutas, no como evidencia final.

## Criterio de lanzamiento

No bloquear V1 por completar los 147 locales ni por terminar Instagram.

Sí bloquear si:
- el cron no actualiza la cartelera;
- el snapshot visible queda desfasado de la DB;
- admin/escrituras no pueden verificarse;
- Radar no puede obtener GPS cuando el usuario lo pide;
- una regresión de provenance o dedupe permite datos falsos/duplicados.

La expansión territorial y nuevas fuentes continúan después del lanzamiento de una V1 operativamente verificable.
