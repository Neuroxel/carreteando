# Dónde Salgo? — estado canónico actual

**Este documento describe el presente.** La historia y checkpoints anteriores están en `docs/historia/` y en los informes fechados de `docs/`. Si contradicen este archivo, manda este archivo.

Última consolidación: **17 de octubre de 2026, 19:57 Chile** — cierre del piloto. App en producción: `73d8689` (`73d868909da6b507be289333f9f662f556f73cc4`); esta consolidación entra en el commit de documentación inmediatamente posterior. Rama canónica: `main`.

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
| Catálogo versionado | **147 lugares**; DB, `/api/snapshot` y vista Lugares coinciden 147/147 |
| Estado de despliegue | App `73d8689`: CI verde, Vercel Production READY, `npm run verify` 225 tests |
| Dominio | `dondesalgo.vercel.app`. Plan `dondesalgo.cl` + rollback en `docs/MARCA_Y_DOMINIO.md` (no ejecutado) |

## UX aprobada por Carlos

Navegación: **Carretes · Lugares · Radar · Aportar** (“Boliches” ya no es etiqueta pública; la taxonomía interna no cambió).

- Radar abre en **Carretes hoy**; puede cambiar a Lugares. El marcador “Tú” se mantiene al cambiar de capa y el mapa se centra en la persona salvo que lo haya movido.
- GPS se solicita **solo al entrar a Radar** o al pedir cercanía.
- La ubicación queda en el navegador: no se almacena ni se envía al backend.
- `Permissions-Policy` permite `geolocation=(self)` y mantiene cámara/micrófono bloqueados.
- Evento de hoy: marcador distintivo; lugares sin evento: punto atenuado.
- Carretes vuelve realmente a la lista, no deja el mapa activo.
- En Carretes, los eventos nocturnos se ordenan antes de los diurnos del mismo día.

QA de producción 17-oct (GPS simulado, no físico): 360, 375, 390, 430 y escritorio PASS — `docs/evidence/QA_PILOTO_2026-10-17.md`. **Pendiente:** prueba final en Android/iPhone físico.

## Datos y cobertura

No presentar una cifra de eventos como “actual” si no se leyó la DB/snapshot vivo.

- Cierre del piloto (19:57): **114 eventos públicos futuros**, **25 hoy en la región / 17 hoy en Valparaíso**, **13 “Precio por confirmar”** (16 sin precio numérico: incluye 2 agotados y 1 venta cerrada), **24 en revisión**, 29 sin pin, 10 sin afiche, 0 activos vencidos. Snapshot final `tl9f4z` (22:57 UTC) = DB. La cobertura no es exhaustiva.
- Identidad de ocurrencia: dos funciones el mismo día son dos eventos (Don Carter 24-oct 20:00 y 22:00); la misma función vista por dos fuentes es una sola.
- Estado temporal: “ya empezó” no es “terminó”; solo un final explícito lo termina.
- Precio: el tramo agotado nunca es el precio vigente; conflictos de disponibilidad quedan sin precio y en revisión.
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

Última corrida: `179e466a-5488-4869-93e2-a998595c6297` (22:19:11–22:22:23 UTC): 8/8 fuentes OK, 23 a revisión, 0 publicadas solas, 106 duplicados, 0 fallos de lectura, US$0, snapshot refrescado. Una solicitud posterior respondió 200 con `skip` por el cooldown de 3 h (no se fuerza).

Fuentes: 34 activas de 44 registradas. En revisión (nivel C, no publican solas): TicketPlus (activa), ComedyPass, ComediaTicket. Pausada: Cinzano (`active=false`, revisión) hasta aprobación humana.

## Provenance

- No se inventan horario, precio, dirección, disponibilidad ni estado de apertura.
- Fuente primaria > índice/agregador.
- Conflictos permanecen visibles; si la hora no se puede resolver, `time: null`.
- `apify_instagram`/Instagram se muestra como Instagram; Facebook/Google conservan su origen; otros adaptadores web se muestran como **web**, no como Instagram.
- Los hallazgos de Gemini obtenidos sólo desde snippets son **pistas**, no verificación.
- Antigravity puede aportar evidencia `LIVE_FETCH`; se reconcilia contra catálogo/DB antes de publicar.

## Instagram / Apify

- Presupuesto mensual (mes UTC, ingesta + piloto): objetivo US$2,50, tope duro US$3,00, US$0,05 por corrida (`lib/apify-budget.ts`). Ninguna corrida empieza si su peor caso pasa el tope; sobre el objetivo, una por día; sin contabilidad legible, no corre.
- Octubre: **US$0,1377** gastados, US$2,8623 disponibles bajo el tope. Estado: **pausado**. `main` escribe el watermark pero todavía no lo lee para corridas incrementales; no se ejecuta hasta corregirlo.
- Instagram es pista/evidencia: nunca publica solo. Sin login personal ni cookies.

## Estado de integración 17-oct

Integrado:
- #4 — lote editorial Woo/Studio/Cómpeta/Ignacio.
- #6 — cobertura por local/día, Vesti/Evently, dedupe, Cinzano, Liberty.
- #7 — política de geolocalización para Radar.
- #9 — provenance pública web ≠ Instagram.
- #11 — identidad de ocurrencia y estado temporal.
- #12 — precios vigentes (tramos, PortalTickets sin "+ Cargo", Evently) y refresco dinámico.
- #13 — Radar/Lugares/accesibilidad y alias de lugar (Liberty).
- #14 — ComedyPass/ComediaTicket en revisión y presupuesto Apify.
- #15 — TicketPlus/Cinzano en revisión, tickets de Cinzano por `event_id`, cancelaciones de PortalTickets.

PR #2 queda como **legado/handoff**: no mergear completo.

## Pendientes (no bloquean el piloto)

1. **Móvil físico:** QA final Android/iPhone con GPS real.
2. **Revisión humana:** aprobar o descartar TicketPlus, Cinzano y las comedias en cola; The House (17-oct) sin primaria estática verificable.
3. **Cobertura:** 121 lugares sin ruta automática son deuda de cobertura, no fallo del catálogo.
4. **Dominio:** registrar `dondesalgo.cl` y seguir el plan de `docs/MARCA_Y_DOMINIO.md` tras validar el piloto.
5. **Menores:** `og:url` ausente; afiches faltantes.
6. **Seguridad Vercel:** confirmar que el bypass secret legado de `carreteando3d` fue revocado.

## Criterio de lanzamiento

No bloquear V1 por completar los 147 locales ni por terminar Instagram.

Sí bloquear si:
- el cron no actualiza la cartelera;
- el snapshot visible queda desfasado de la DB;
- admin/escrituras no pueden verificarse;
- Radar no puede obtener GPS cuando el usuario lo pide;
- una regresión de provenance o dedupe permite datos falsos/duplicados.

La expansión territorial y nuevas fuentes continúan después del lanzamiento de una V1 operativamente verificable.
