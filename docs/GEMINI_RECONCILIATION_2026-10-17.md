# Reconciliación de los 50 candidatos de Gemini (16–18 oct)

Corte: madrugada del 17-oct-2026 (hora de Chile). Comparado contra la cartelera pública de producción (`/api/snapshot`, generado el 17-oct 02:59 UTC: 102 eventos, 147 lugares).

Cada fila que podía entrar se reabrió en su ticketera. Nada se importó por venir de Gemini.

**Límite de esta pasada:** el conector de Supabase no tenía acceso al proyecto, así que no se leyeron `event_sources`, `event_evidence` ni la cola de revisión. "Ya conocido" significa aquí "ya público".

## Resultado

| Clase | Filas | Detalle |
|---|---:|---|
| `ALREADY_PUBLIC` | 15 | 1, 4, 5, 7, 8, 11, 14 · 24, 26, 27, 28, 29, 33, 35, 46 |
| `NEW_VALID` | 10 | 34, 36, 37, 40, 41, 43, 44, 47, 48 (17-oct) · 50 (18-oct) |
| `CONFLICT` | 1 | 32 "INFERNO 19:00 desde $5.000": no existe esa fecha. El evento real de The House ese día se agregó corregido |
| `BAD_SOURCE_MAPPING` | 6 | 12, 38, 39: tres eventos distintos apuntan a la misma página de Vamoh ("Las vidas de Charly"). 13: perfil de Vamoh. 22 y 45: listado genérico de Vamoh |
| `OUT_OF_SCOPE` | 7 | 3, 30, 31, 49 (cine) · 23 (automovilismo) · 2 (café concierto escolar de día) · 25 (feria de día) |
| `STALE` | 10 | Filas del 16-oct que no estaban publicadas y ya pasaron: 6, 9, 10, 15, 16, 17, 18, 19, 20, 21 |
| `DUPLICATE` | 0 | Ningún evento repetido entre filas. Hay 14 lugares duplicados (ver abajo) |
| Sigue en revisión | 1 | 42 "Sking B-Day": fuente agregadora, hora inferida de "09:30", sin ficha de venta |

Total: 15 + 10 + 1 + 6 + 7 + 10 + 1 = 50.

## Correcciones al reabrir la fuente

| Fila | Gemini decía | Fuente dice |
|---|---|---|
| 32 INFERNO · The House | 19:00, desde $5.000 | "Sábado 17 / Fiesta + Extended", 23:00, aporte $1.000 hasta 00:30 y $5.000 hasta 01:00. INFERNO fue el 8-ago |
| 36 Amy Winehouse · Klanu | 21:00 (inferido) | La ficha dice 09:00, pero el texto del organizador dice "desde las 21 horas": se usa el texto |
| 43 Columbia · Brisamar | desde $5.000 | La preventa de $5.000 está agotada; desde $8.000 |
| 44 Sábado Prime · Hollywood | 23:00 | Inicio 19:00; invitaciones gratis por horario; +23 |
| 41 Reggaetón · Open Hotel | $8.000 | Preventas 1–3 agotadas; $10.000 |
| 27 Mono Guitarra · Espacio Musa | $4.000 | General $2.500 |
| 50 Mad Professor · Trotamundos | 21:00, puertas 22:00 | Puertas 18:00, término 00:00; General $23.000 |
| 14 Bar Vienés | $5.000 | La cartelera pública dice desde $3.000. Conflicto no resuelto: queda lo publicado |

## Gratis condicional

Ningún candidato del 17-oct es gratis sin condición. Seis lo son con condición, y la tarjeta lo dice con palabras:

- 35 Metal Attack: ticket gratis hasta agotar stock.
- 40 WAUW: cortesía nominativa de 23:00 a 00:00.
- 44 Hollywood: invitación gratis por horario.
- 37 Manda: cortesía hasta 23:59.
- 47 Infinito Pop: liberada hasta agotar stock.
- 48 Garage: gratis hasta las 00:00.

El precio guardado es 0 (es el mínimo que se puede pagar) y el texto visible explica la condición; nunca se muestra "Gratis" a secas.

## Lugares: Gemini no conocía el registro

**Gemini los marcó `NEW_VENUE_CANDIDATE`, pero ya existen (14):** Panic House, Los Alquinta del Puerto, Café Rock, El Parque Quilpué, Okko music lab, Garage 597, Casa de la Cultura de Valparaíso, Espacio Barcelona, Espacio Musa, Espacio Guestro, Klanu Rock Bar, Espantapájaros Karaoke, Cassot Bar y Open Hotel Quillota (es Open Quillota, Rafael Ariztía 527).

**Gemini los marcó `KNOWN_OR_CORE`, pero no están en el registro:** Insomnia Teatro Condell, Sala Rívoli y Alto San Andrés.

**Propuestas de lugar nuevo** (no creadas, porque la base no estaba accesible):

| Lugar | Dirección | Observación |
|---|---|---|
| Alto San Andrés | Av. Brasil 1395, pisos 3 y 4 | Mismo edificio que Club Segundo Piso |
| The House | Errázuriz 336, Valparaíso | |
| Brisamar | Balneario Las Salinas, Viña del Mar | |
| Club D | Camino Internacional 537, Viña del Mar | |

Sus eventos se publican con el nombre del lugar, pero sin punto en el mapa hasta que se creen en el registro.

## Cómo entran

Los 11 eventos válidos (10 + el de The House corregido) quedaron en `data/editorial-events.json` como aprobación editorial versionada, con `review_basis` que dice qué se vio y qué se corrigió. El cron diario (`/api/cron/scrape`, 18:00 UTC = 15:00 en Chile) o `/api/cron/automatizacion` los insertan sin pisar nada.
