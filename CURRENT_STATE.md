# Dónde Salgo? — estado actual

**Este documento describe solo el presente.** La historia (septiembre, release de
octubre, decisiones anteriores) está en [`docs/historia/`](docs/historia/). Si algo
de allá contradice esto, manda esto.

Última verificación: **4 de octubre de 2026** (rama `release/dondesalgo-v1`).

## Qué es

**Dónde Salgo?** reúne eventos y lugares para salir en la Región de Valparaíso:
qué hay hoy, dónde queda, cómo llegar y de dónde sale cada dato. No vende
entradas. Modela **lugares** (existen aunque hoy no pase nada) y **eventos**
(pasan en una fecha).

El nombre interno del código, del proyecto en Vercel y de la base sigue siendo
`carreteando`. Ningún texto público lo muestra.

## Dónde está

| | |
|---|---|
| Revisión V1 | rama `release/dondesalgo-v1` (URL en [`docs/CARLOS_REVIEW_V1.md`](docs/CARLOS_REVIEW_V1.md)) |
| Producción | `https://carreteando.vercel.app` (rama `main`, todavía con la marca anterior) |
| Dominio | `dondesalgo.cl` **no está registrado** (NIC Chile, 04-10-2026). Ver [`docs/MARCA_Y_DOMINIO.md`](docs/MARCA_Y_DOMINIO.md) |
| Base | Supabase, proyecto `hgwljbtqdserkdhulbts` |
| Marco | Next.js 15 App Router; la portada y Explorar son estáticas y filtran en el teléfono |

## Datos (04-10-2026)

| | |
|---|---|
| Lugares publicados | 134 |
| Candidatos pendientes | 3 (los otros 246 se resolvieron: ver el censo) |
| Con coordenada en el mapa | 96 (72 %) |
| Con horario con fuente propia | 10 |
| Con nivel de precio | 0 (muestra de 6; se necesitan 30) |
| Eventos públicos vigentes | 77 (4 hoy) |
| Eventos vigentes en revisión | 31 |
| Fuentes automáticas activas | 30, ninguna caída |
| Motor de evidencia | `active` (7 reglas, sin IA) |

Detalle por comuna y zona: [`docs/CENSO_LOCALES.md`](docs/CENSO_LOCALES.md).

## Reglas que no se negocian

- No se inventa precio, horario, género, dirección ni estado de apertura. Nunca
  se dice "abierto ahora".
- Horario: solo "Según horario publicado", con fuente y fecha.
- Precio: niveles $–$$$$ solo con fuente y fecha; sin dato, sin insignia.
- OpenStreetMap, Google y las redes sociales crean **candidatos**, no fichas
  públicas.
- Pagar compra visibilidad, nunca confianza. Hoy no se cobra nada.

## Portada V1

DÓNDE SALGO? como titular → "¿Qué hay hoy?" → búsqueda y comuna (comunas con eventos o lugares) → Hoy / Mañana / Este finde → eventos →
lugares → "¿Falta algo?". Filtros secundarios (escena, gratis, eventos/lugares,
mapa) tras "Filtros". Se quitó la ruta de zonas ("camino del carrete").

## Lectura pública

Explorar, buscar, filtrar y abrir el mapa no piden nada al servidor (medido:
0 peticiones). Las métricas se agregan por día, sin IP guardada ni identidad.
Las búsquedas sin resultado se cuentan por texto (sin correos, teléfonos ni
enlaces) en `search_misses`, 90 días.

## Comunidad

`/publicar`: proponer evento, y **¿Falta un lugar?** / **Reclama tu ficha**
(mismo formulario). Todo entra a `community_inbox` y lo resuelve una persona
en `/admin`. Nada se publica solo.

## Limitaciones conocidas

1. Dominio sin registrar y marca sin búsqueda en INAPI: **revisión legal pendiente**.
2. Precio sin calibrar: 0 niveles publicados.
3. Horario en 10 de 134 lugares (solo fuentes propias).
4. Cobertura media o baja por zona: la segunda pasada todavía encuentra locales.
5. Sin MFA para moderadores; respaldo sin ensayo de restauración.
6. Tiles de OpenStreetMap: pasar a un proveedor contratado antes de escalar.
7. No se afirma cobertura total: se mide saturación por zona.

## Veredicto

Ver el informe V1 y [`docs/CARLOS_REVIEW_V1.md`](docs/CARLOS_REVIEW_V1.md).
