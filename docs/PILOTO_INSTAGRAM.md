# Piloto controlado de Instagram — 10 de octubre de 2026

Una sola corrida, armada a mano (`automation_config.instagram_pilot = 'armed'`,
consumida al empezar: hoy vale `used`). `APIFY_PAUSED` siguió en `true`: la
ingesta diaria no leyó Instagram (corridas de 11:00, 15:53 y 21:00 con costo 0).
Endpoint: `/api/cron/piloto-instagram` (con pase), código en `lib/instagram-pilot.ts`.
Lo leído queda en `instagram_pilot_items` (privado, sin acceso público).

## Límites usados
15 cuentas oficiales · 3 posts por cuenta · últimos 3 días · `maxItems=45` ·
`maxTotalChargeUsd=1` · sin comentarios, seguidores ni perfiles.

Cuentas: el.huevo, mascara_valparaiso, terrazabellavista.cl, studiovalparaiso,
barlamorada, gatoenlaventanavalparaiso, barelcanario, terrazamiaw,
barindustrialvalparaiso, baronrooftop, ovovinadelmar, hollywoodchile.cl,
psiquis.bar, chicagobar.cl, trotaquilpue. Ninguna tiene cartelera en una ticketera
que ya leamos.

## Resultado (Apify run `FobIcczVj1jlZyiNL`, 62 s)

| Medida | Valor |
|---|---|
| Cuentas pedidas | 15 |
| Cuentas con posts leídos | 9 |
| Ítems devueltos / posts de las cuentas | 31 / 19 |
| Posts con algo de evento | 14 |
| Eventos válidos únicos (nuevos en la base) | 6 |
| Duplicados (mismo evento, otro post) | 1 |
| Ya conocidos en la base | 0 |
| No es evento | 4 |
| Ambiguos | 4 (3 posts solo imagen, Halloween de Hollywood sin local) |
| Vencidos | 4 (incluye posts fijados viejos) |
| Costo | 0,078 USD |
| Revisión manual | ~30 min |

- Rendimiento: 6 eventos únicos / 19 posts = 32 %; 0,4 por cuenta pedida.
- Costo por evento único: 0,013 USD. Minutos por evento único: ~5.
- Corroborado con una segunda fuente: 1 de 6 (Máscara, en Ecopass). Vesti y
  Passline no se pueden leer automáticamente.

Los 6 quedaron **en revisión, no públicos**, con su post como evidencia `lead`
(y Ecopass como `transactional` en Máscara). El motor los juzgó en la corrida
manual de las 21:3x: `REVIEW_INSUFFICIENT`, nada publicado.

| Evento | Fecha | Lugar |
|---|---|---|
| La Maleca en vivo | sáb 10-10, 21:00 | Terraza Miaw |
| Especial Old School: Old Is Cool | dom 11-10, 23:00 | Terraza Bellavista |
| Halloween Máscara (Ecopass) | sáb 31-10, 21:00 | Máscara |
| Halloween Psiquis | sáb 31-10 | Psiquis Bar |
| Halloween Night | sáb 31-10, 22:00 | Studio Valparaíso |
| Noches en Movimiento | sáb 14-11, 22:00 | Balada El Huevo |

## Antes y después

| | Antes (21:15) | Después |
|---|---|---|
| Públicos hoy | 6 | 6 |
| En revisión hoy | 7 | 8 |
| Públicos próximos 7 días | 18 | 18 |
| En revisión próximos 7 días | 19 | 21 |

## Recomendación: piloto semanal de 15 cuentas

Lo medido: barato y con rendimiento real (6 únicos por 0,08 USD), pero solo 1
evento era de hoy y 2 de la semana; el resto se anuncia con semanas de
anticipación (Halloween). Leer a diario volvería a traer los mismos posts.
Semanal, con ventana de 7 días, 3 posts por cuenta y el mismo tope. No ampliar a
30: 6 de las 15 cuentas no publicaron nada en 3 días. El cuello de botella no es
el costo sino la corroboración: Vesti y Ecopass venden varios de estos eventos y
sumarlos como fuentes podría traerlos sin Instagram.
