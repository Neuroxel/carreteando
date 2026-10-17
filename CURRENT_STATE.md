# Dónde Salgo? — estado actual

> **Verificación actual: 17-10-2026.** Estado recuperado, evidencia de producción
> y bloqueos: [Checklist de lanzamiento](docs/RELEASE_CHECKLIST_2026-10-17.md).
> Ese corte prevalece sobre las cifras históricas de esta página. Admin,
> migración Instagram e importación editorial todavía no están cerrados.

El contenido de abajo corresponde al **10 de octubre de 2026**
(rama `release/dondesalgo-v1`).

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

**Valparaíso, censo final (12-10-2026):** 67 → **66** publicados tras cerrar la cola (7 pendientes con lo que falta); primera pasada: 67 → 56, todos con evidencia
de operación vigente (evento propio, cuenta o sitio oficial activo).
- 17 pasaron a pendientes, 2 se cerraron y 1 se rechazó.
- Hay 9 altas nuevas con evidencia A.
- 30 quedan en cola, con lo que falta y fecha de recheque.

Detalle, conflictos y monitoreo: [`docs/VALPARAISO_FINAL_CENSUS.md`](docs/VALPARAISO_FINAL_CENSUS.md).
La investigación intensiva de Valparaíso queda cerrada; sigue Viña del Mar / Reñaca.

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

## Presupuesto: “¿Dónde salgo con mi presupuesto?”

Requisito central del producto desde el 10-10-2026 (pedido de Carlos: “falta que
nuestra página busque cosas más baratas”).

- `price_clp` = la entrada individual más barata **vigente** (no promociones de
  grupo, no consumo de barra salvo que la fuente diga que es la entrada).
  `price_text` = el texto público completo (“$10.000 + cargo”, “Entradas
  agotadas”, “Precio por confirmar”).
- Filtro en “Filtros”: Cualquiera · Gratis · Hasta $5.000 · Hasta $10.000 ·
  Hasta $15.000 (`?precio=gratis|5000|10000|15000`; `pago` y `todos` siguen
  funcionando). Orden opcional “Más barato” (`?orden=barato`): precios conocidos
  de menor a mayor y los desconocidos al final. Todo en el teléfono, sin pedir
  nada al servidor.
- **Barato** = gratis o hasta $5.000 por entrada individual. El atajo “Barato hoy”
  aparece solo si hay al menos un evento así.
- Un precio desconocido **nunca** cuenta como barato ni gratis. El precio **no** es
  requisito para publicar.
- El nivel de precio de un **lugar** ($–$$$$, canasta cerveza + cóctel) es otra
  cosa y sigue sin activarse (muestra de 6 locales).

Indicadores (10-10-2026, 22:30):

| | Hoy (11 públicos) | Vigentes públicos con ticketera (77) |
|---|---|---|
| Cobertura de precio | 6/11 (55 %) | 21/77 (27 %) |
| Precio desconocido | 5/11 (45 %) | 56/77 (73 %) |
| Gratis | 0 | 0 |
| Barato (≤ $5.000) | 1 | 5 |
| Hasta $10.000 | 4 | 11 |

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
