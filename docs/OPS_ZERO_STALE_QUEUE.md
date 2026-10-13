# Cola cero (12/13-10-2026): panel, eventos re-vinculados y piloto 2 preparado

**Respaldos:**

- `backup_events_review_20261012`: los 35 eventos que estaban en revisión;
- `backup_venues_ops_20261012`: todos los lugares.

**Auditoría:** cada decisión deja una fila en `review_audit` con actor "Claude · cola cero 12-10-2026", estado anterior, estado nuevo y motivo.

## 1. Conteo del panel

El panel contaba "Lugares por revisar" con `moderation_status === 'pending'`. Eso incluía 18 lugares **cerrados** que conservaban el `pending` de antes de cerrarse: mostraba 34 cuando de verdad eran 16.

**Arreglo de código** (rama `ops/zero-stale-queue`, sin desplegar):

- `lib/admin-venues.ts` agrupa por `disposition`, que es la fuente canónica (la fija el trigger):
  - por revisar = `needs_evidence`;
  - publicados;
  - cerrados, rechazados o duplicados.
- El panel muestra "Falta: …" en cada pendiente.
- Prueba: `tests/admin-venues.test.ts`.

**Arreglo de datos** (ya aplicado, para que el panel actual cuente bien sin desplegar):

- Los 18 cerrados con `moderation_status='pending'` pasan a `'rejected'`, es decir, no publicar.
- `disposition` sigue en `closed`: el trigger fija `closed` primero, sin importar la moderación. No se pierde historial.
- Cada cambio queda auditado como `normalize`.

Resultado: `moderation_status='pending'` = 12 = `needs_evidence` = 12.

## 2–7. Eventos en revisión

| | Cantidad |
|---|---|
| En revisión antes | 35 |
| Re-vinculados a lugares | 19 |
| Publicados por el motor tras re-vincular | 0 |
| En revisión al final | 1 |

### Re-vinculación determinista

Regla: nombre exacto normalizado (minúsculas, sin tildes ni puntuación) contra el nombre y los alias del lugar, más la misma ciudad. Nada difuso. Una sola regla extra, también determinista: quitar el nombre de la ciudad al final ("ex club 880 Valparaíso").

| Eventos | Lugar | Estado del lugar |
|---|---|---|
| 1327 | El Fogón de los Deseos | publicado |
| 1331 | Open Quillota | publicado |
| 1350 | Castillo del Mar (id 61; el 200 es su duplicado rechazado) | publicado |
| 1351 | Espacio Guestro | publicado |
| 1359 | Espacio la Compañía | publicado |
| 1360, 1362 | Casa Polanco | publicado |
| 1381 | El Journal | publicado |
| 1392 | Balmaceda Arte Joven | publicado |
| 1395 | Poseidón Bar | publicado |
| 1403 | Viña Stage | publicado |
| 1405 | Angel's Place | publicado |
| 1401, 1426 | Ex Club 880 | publicado |
| 1328 | Estadio Lucio Farina | rechazado |
| 1407 | Woo Club | rechazado |
| 1413 | María Clarita | rechazado |
| 1416 | Tribu | pendiente |
| 1429 | Okko | pendiente |

### Motor

Re-corrido con el pase de un solo uso de la base (`issue_cron_ticket`), igual que pg_cron:

- respuesta: `{"mode":"active","evaluated":106,"counts":{"KEEP":93,"REVIEW_INSUFFICIENT":11,"REVIEW_CONFLICT":2},"applied":0}`;
- 0 promovidos y 0 rechazados automáticamente;
- los 22 marcados "editado por una persona" el motor no los toca por diseño.

La política de 7 reglas no se cambió.

### Revisión humana

Cada fuente se revisó vigente el 13-oct:

| Decisión | Cant. | Eventos |
|---|---|---|
| PUBLICAR | 17 | Fogón, Ex 880 (Lyon), Guestro, Yorka PCdV, Balmaceda, Viña Stage, Poseidón, Compañía (agotada), Casa Polanco ×2, Open Quillota, Angel's Place, Chango (Teatro IPA), Redoles (Tribu), Woo Club Halloween, Okko "Sweet house", Máscara Halloween (Ecopass) |
| CORREGIR Y PUBLICAR | 10 | Segundo Piso Halloween (17:43 → **22:00**, PortalDisc); Cinzano ×5 (**21:30, $10.000**, cartelera oficial); Journal (conflicto de nombre: es el mismo lugar); Psiquis Halloween (**20:00**, desde $2.490, Vesti); Studio Halloween (desde $25.000, Vesti); Monstruos del Metal (Trotamundos, **17:00**, Passline) |
| CANCELADO | 1 | Tributo a Sade, Castillo del Mar: PortalDisc dice "EVENTO CANCELADO" |
| DUPLICADO | 1 | 1318 = 784 (Yorka) |
| RECHAZAR | 5 | Alumni USM, orquestas UV (Aula Magna), Expo Feria Quillota, bingo en María Clarita (fuera de alcance), Fercho Parga (Evently 404: la ticketera lo retiró) |
| SIGUE EN REVISIÓN | 1 | "Noches en Movimiento", El Huevo, 14-nov. Falta: solo existe el post oficial del 14-sep y Passline no tiene eventos de El Huevo a la venta. Se revisa al abrir la venta. |

**Cinzano:** no hizo falta cambiar ninguna regla.

- La hora sí está escrita en la fuente oficial: la cartelera de cinzanooficial.cl dice "21:30h · Gran Salón · $10.000". Faltaba solo en la página de detalle, que es la que lee el adaptador.
- Mejora propuesta, sin aplicar: que el adaptador `cinzano-agenda` lea la hora desde la cartelera.
- Propuesta de regla para casos en que la fuente de verdad no tenga hora, **no aplicada**: publicar con "Hora por confirmar" si (a) la fuente es oficial del lugar o una ticketera, (b) el lugar está publicado y (c) la fecha es exacta.

## 12. Lugares pendientes (pasada acotada)

**Publicados (5):**

| Lugar | Evidencia |
|---|---|
| Woo Club | Blanco 889; Passline, Evently propio, @wooclub_ |
| Okko Music Lab | Av. Concón Reñaca 730: es **Concón**, no Reñaca; Evently, Toliv, @okko_musiclab |
| Tribu | Camilo Henríquez 397, Quilpué; PortalDisc |
| La Barra Limache | Colón 320; @labarralimache activo oct-2026 |
| Casa Lagunita | Laguna de Maitencillo; @casa_lagunita con cartelera, activo 12-oct-2026 |

**Re-chequeados sin cambio** (siguen pendientes):

- Brighton: Instagram sin publicaciones desde 2019.
- Coyote Quemado: última publicación propia en 2025.
- Matiz: última publicación en nov-2024.
- Stingray: solo fichas antiguas.

**No re-chequeados** (verificados hace menos de 24 h, sin señal nueva esperable): Club M, El Caregallo, Espacio Social Violeta, Lo Devi, Hops, Hollywood Reñaca, Idílico, Living VIP.

**Total pendientes: 12** (Valparaíso 7, Viña 2, Reñaca 3).

## 13–17. Instagram

**Estado verificado:**

- `instagram_pilot_runs` tiene **una** corrida: FobIcczVj1jlZyiNL, USD 0,0783.
- `automation_config.instagram_pilot = 'used'`.
- Ninguna ingesta posterior leyó cuentas (`accounts_scanned = 0`, costo 0).

**Piloto 1 como línea base:**

| Métrica | Valor |
|---|---|
| Cuentas pedidas / leídas | 15 / 9 |
| Posts | 19 |
| Eventos únicos válidos | 6 |
| Costo por evento | USD 0,013 |

Cuatro de las seis cuentas que no se leyeron sí existen (se verificó @ovovinadelmar). Probablemente no tenían publicaciones dentro de la ventana de 3 días.

**Piloto 2 preparado, no ejecutado:**

| | Cohorte A: Valparaíso | Cohorte B: Viña / Reñaca |
|---|---|---|
| Cuentas | 15 | 15 |
| Cuentas | mascara_valparaiso, studiovalparaiso, el.huevo, terrazabellavista.cl, terrazamiaw (rindieron en el piloto 1); wooclub_, club.delirio.valparaiso, paganocl, klanurockbar, barproa, ukbarvalpo, malezavalparaiso, hotzenplotz_bar, lamorada.bar, bargatoenlaventana | manda.chile, mandavina.cl, hollywoodchile.cl, psiquis.bar, ovovinadelmar, bloom_barcl, glasgowpub, conclave1929, jarbarvina, bargonocl, clubgordos, schoperia4ymedio, pasajecoyotl, lachinganadelbarrio, barracentralrenaca |

- Todas las cuentas se verificaron a mano: existen y son del lugar.
- Quedaron fuera los lugares que ya tienen ticketera (Journal, Viña Stage) y los que no rindieron en el piloto 1 (El Canario, Barón).
- Límites: 3 posts por cuenta, ventana de 7 días, se descartan los fijados viejos, sin comentarios ni perfiles, tope de **USD 1 por cohorte** (USD 2 en total).
- La ruta exige `?cohorte=A|B` y que la base tenga `instagram_pilot = 'armed-A'` o `'armed-B'`; el valor se consume al empezar.
- Lo que trae el piloto se guarda como pista: nunca crea eventos.
- **Para correrlo hace falta desplegar la rama en producción (main) y armar cada cohorte. Ambas cosas requieren autorización.**

## 18. Cobertura (producción, 13-oct, fechas de Chile)

| Ciudad | Publicados | IG | Programación (cualquiera / estructurada) | Coords | Horario | Precio | Imagen | Eventos 7 d | Eventos 14 d | Pendientes |
|---|---|---|---|---|---|---|---|---|---|---|
| Valparaíso | 67 | 46 | 44 / 30 | 37 | 12 | 0 | 0 | 15 | 30 | 7 |
| Viña del Mar | 35 | 23 | 21 / 5 | 26 | 5 | 0 | 0 | 1 | 6 | 2 |
| Quilpué | 9 | 3 | 5 / 2 | 6 | 0 | 0 | 0 | 2 | 2 | 0 |
| Concón | 8 | 3 | 4 / 1 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| Quillota | 6 | 2 | 3 / 1 | 5 | 0 | 0 | 0 | 0 | 1 | 0 |
| Quintero | 5 | 2 | 2 / 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| Limache | 4 | 1 | 1 / 1 | 3 | 0 | 0 | 0 | 1 | 1 | 0 |
| Reñaca | 4 | 4 | 2 / 0 | 1 | 1 | 0 | 0 | 0 | 0 | 3 |
| Villa Alemana | 3 | 0 | 2 / 0 | 3 | 0 | 0 | 0 | 1 | 1 | 0 |
| La Calera | 3 | 1 | 1 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Olmué | 2 | 1 | 1 / 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Puchuncaví | 1 | 1 | 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Alerta de densidad, confirmada:**

- Viña tiene 35 lugares publicados y solo 6 eventos en 14 días; Reñaca, 0.
- Viña tiene apenas 5 lugares con fuente estructurada, contra 30 en Valparaíso.

## 19. Prioridad territorial (según los datos)

| Prioridad | Territorio | Por qué |
|---|---|---|
| **P0** | Descubrimiento de **eventos** en Viña y Reñaca (no más lugares) | Faltan fuentes: carteleras de Passline por lugar, la cohorte B y Club90 |
| **P0** | Reñaca / Borgoño | 4 publicados, 0 eventos, 3 pendientes |
| **P1** | Concón | 8 publicados con 1 sola coordenada; aparece Okko |
| **P2** | Quilpué y Villa Alemana | — |
| **P3** | Quillota y Limache | — |

## 21. Brechas de ficha

- Imagen: 0 de 147.
- Precio: 0 de 147.
- Horario: 18 de 147.

Prioridades:

- **P0:** eventos y fuentes.
- **P1:** coordenadas y redes sociales.
- **P2:** horario, precio e imagen. Nada de imágenes inventadas.
