# Maestro de Instagram de lugares

Corte: 2026-10-16. 159 lugares (147 publicados, 12 needs_evidence). Fuente de lugares: snapshot público + needs_evidence; `venue_id` queda vacío porque la base no estaba accesible al generar el corte (se cruza por `slug`).

Regla: ningún handle se deduce del nombre. Solo se clasifican los handles que ya estaban en la base; los lugares sin handle quedan `NONE`.

## Estados

| Estado | Lugares | Significado |
|---|---:|---|
| `VERIFIED` | 63 | Perfil existe, nombre y ciudad coinciden, publicó en los últimos 12 meses |
| `INACTIVE` | 6 | Perfil existe pero sin publicaciones hace más de 12 meses (handle viejo: no sirve como fuente) |
| `RENAMED` | 1 | El handle de la base es una cuenta antigua; el lugar publica en otra |
| `AMBIGUOUS` | 2 | El handle no es claramente la cuenta propia de este lugar |
| `NOT_FOUND` | 2 | Instagram responde que el perfil no está disponible |
| `UNVERIFIED` | 18 | Handle en la base sin revisar todavía |
| `NONE` | 67 | Sin handle en la base |

## Por ciudad

| Ciudad | Lugares | VERIFIED | INACTIVE | RENAMED | AMBIGUOUS | NOT_FOUND | UNVERIFIED | NONE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Valparaíso | 74 | 31 | 5 | 1 | 1 | 1 | 10 | 25 |
| Viña del Mar | 37 | 20 | 1 | 0 | 0 | 0 | 3 | 13 |
| Quilpué | 9 | 2 | 0 | 0 | 0 | 0 | 1 | 6 |
| Concón | 8 | 2 | 0 | 0 | 0 | 1 | 0 | 5 |
| Reñaca | 7 | 4 | 0 | 0 | 1 | 0 | 0 | 2 |
| Quillota | 6 | 2 | 0 | 0 | 0 | 0 | 0 | 4 |
| Quintero | 5 | 0 | 0 | 0 | 0 | 0 | 2 | 3 |
| Limache | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 3 |
| La Calera | 3 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| Villa Alemana | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| Olmué | 2 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| Puchuncaví | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |

## Casos que requieren acción

- **Chicago Bar** (Concón, `chicago-bar-concon`) — `@chicagobar.cl` → `NOT_FOUND`. Perfil no disponible
- **Hollywood Experience Reñaca** (Reñaca, `hollywood-renaca`) — `@hollywoodchile.cl` → `AMBIGUOUS` (última publicación 2026-10-16). La cuenta de marca solo cita el local de Viña (Merino 57); no confirma Reñaca.
- **Balada El Huevo** (Valparaíso, `balada-el-huevo`) — `@barelhuevo` → `RENAMED` (última publicación 2016-01-02). Cuenta antigua; la activa es @el.huevo. Reemplazar por @el.huevo.
- **Bar de Pisco** (Valparaíso, `bar-de-pisco`) — `@bardepisco` → `INACTIVE` (última publicación 2024-08-18). Bio: Almirante Montt 454; sin publicaciones desde 2024-08
- **Barbones Curauma** (Valparaíso, `barbones-curauma`) — `@barbonesbar` → `NOT_FOUND`. Perfil no disponible
- **Brighton** (Valparaíso, `brighton`) — `@brightonoficial_` → `INACTIVE` (última publicación 2019-02-25). Bio: Paseo Atkinson 151; inactiva desde 2019
- **El Coyote Quemado** (Valparaíso, `el-coyote-quemado`) — `@coyotequemado` → `INACTIVE` (última publicación 2025-04-19). Bio: Subida Ecuador 144; sin publicaciones desde 2025-04
- **Liberty** (Valparaíso, `liberty`) — `@bar.restaurantliberty` → `INACTIVE` (última publicación 2024-01-20). Sin publicaciones desde 2024-01
- **Matiz** (Valparaíso, `matiz`) — `@matizvalpo.oficial` → `INACTIVE` (última publicación 2024-11-01). Sin publicaciones desde 2024-11.
- **Sala Negra UV** (Valparaíso, `sala-negra-uv`) — `@escuelateatrouv` → `AMBIGUOUS` (última publicación 2026-10-15). Es la cuenta de la Escuela de Teatro UV; la sala tiene cuenta propia (@salanegrajbc, sin verificar).
- **Hops** (Viña del Mar, `hops-vina-del-mar-osm`) — `@hopscraftbeer` → `INACTIVE` (última publicación 2023-04-01). Sin publicaciones desde 2023-04

## Pendientes de verificación

`@lapastora_restobar`, `@terravivaolmue`, `@trotaquilpue`, `@pattos_schop`, `@stoney.cl`, `@ouioui_valpo`, `@terrazamiaw`, `@pimentonvalpo`, `@rosmarinovalpo`, `@lemuttbar`, `@losalquintadelpuerto`, `@magura_curauma`, `@malizioso.pizzeria`, `@teatromauriscdvalparaiso`, `@trotamundosvalpo`, `@vienesbar`, `@teatro.munivina`, `@vinastage`

## Método y límites

- Verificación de 2026-10-16 abriendo el perfil público de cada handle sin iniciar sesión, a ritmo de consulta humana. Solo se leyó el encabezado del perfil (título y bio) y la fecha de la publicación más reciente, que se obtiene del código del post. No se leyeron seguidores, comentarios ni medios, y no se guardó nada fuera de este maestro.
- La revisión se detuvo con 18 handles pendientes. La adquisición de contenido de Instagram va siempre por Apify; esta revisión no es una fuente de eventos.
- `last_activity_at` es la fecha de la publicación propia más reciente visible en la grilla y excluye las fijadas antiguas cuando se distinguen.
- `programming_value`: `alto` si publicó en los últimos 14 días, `medio` si fue en los últimos 90, `bajo` si es más antiguo. Mide frecuencia de publicación, no calidad de la agenda.
- Archivos: `data/exports/venues_instagram_master.csv` y `.json`, generados con `scripts/build-venues-instagram-master.py`.
