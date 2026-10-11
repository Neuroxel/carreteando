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

---

# Experimento de dos semanas (aprobado como plan; no corre solo)

Decisión del 10-10-2026, después del piloto: **no** se raspa de nuevo esa
noche (la muestra de 3 días sería casi toda repetida) y `APIFY_PAUSED` sigue en
`true`. La ingesta diaria no toca Instagram.

## Diseño

| | |
|---|---|
| Cuentas | las mismas 15 de arriba (no ampliar a 30 todavía) |
| Frecuencia | jueves en la tarde (16:00) y sábado a mediodía (12:00), hora de Chile |
| Duración | 2 semanas: 4 corridas (15, 17, 22 y 24 de octubre de 2026) |
| Posts | 3 recientes por cuenta, ventana de 3 días (jueves cubre lunes–jueves; sábado cubre jueves–sábado) |
| Costo | `maxTotalChargeUsd = 1` por corrida (el piloto costó 0,078 USD) |
| Regla | Instagram es siempre evidencia `lead`; nunca se publica solo desde Instagram. Lo único se aprueba a mano o cuando aparece una segunda fuente |

## Cómo se ejecuta cada corrida

Cada corrida se arma a mano y se consume al empezar, así nada queda raspando:

```sql
update automation_config set value = 'armed' where key = 'instagram_pilot';
select issue_cron_ticket();  -- pase de un solo uso
```

y luego `GET /api/cron/piloto-instagram?ticket=<pase>` en el despliegue que tenga
el token (producción después del merge). Al terminar, `instagram_pilot` vuelve a
`used`. Si se quiere automatizar los dos horarios, son dos trabajos de
`pg_cron` que arman y llaman: **no se crearon**; requieren aprobación del dueño.

## Qué se mide en cada corrida

| Corrida | Posts | Eventos válidos únicos | Duplicados | Falsos positivos | Ambiguos | Minutos de revisión | Costo USD | USD por único |
|---|---|---|---|---|---|---|---|---|
| Piloto 10-10 | 19 | 6 | 1 | 0 | 4 | ~30 | 0,078 | 0,013 |
| Jue 15-10 | | | | | | | | |
| Sáb 17-10 | | | | | | | | |
| Jue 22-10 | | | | | | | | |
| Sáb 24-10 | | | | | | | | |

Consulta para llenar la tabla:

```sql
select apify_run_id, classification, count(*) from instagram_pilot_items
group by 1, 2 order by 1, 2;
select created_at, summary from instagram_pilot_runs order by created_at;
```

## Precio de lo único (agregado el 10-10-2026)

Cada evento único se clasifica por su entrada individual más barata vigente
(`instagram_pilot_items.price_bucket`): gratis · hasta $5.000 · hasta $10.000 ·
más de $10.000 · desconocido. **Rendimiento barato** = únicos gratis o hasta
$5.000 por corrida. Dice si Instagram ayuda específicamente a encontrar salidas
baratas.

| Corrida | Únicos | Gratis | ≤ $5.000 | ≤ $10.000 | > $10.000 | Desconocido | Rendimiento barato |
|---|---|---|---|---|---|---|---|
| Piloto 10-10 | 6 | 0 | 1 (Halloween Psiquis, preventa $4.000) | 2 (+ Máscara $8.000) | 0 | 4 | 1 de 6 |
| Jue 15-10 | | | | | | | |
| Sáb 17-10 | | | | | | | |
| Jue 22-10 | | | | | | | |
| Sáb 24-10 | | | | | | | |

```sql
select apify_run_id, price_bucket, count(*) from instagram_pilot_items
where classification = 'UNIQUE_VALID_EVENT' group by 1, 2 order by 1, 2;
```

## Cuándo decidir

Al final de las dos semanas: si el promedio es de al menos 3 eventos únicos por
corrida y menos de 10 minutos por evento, se deja fijo en jueves y sábado. Si
baja de 1 único por corrida, se apaga. Ampliar a 30 cuentas solo si las 15 dan
más de 5 únicos por corrida y la revisión manual sigue siendo abordable.
