# Viña del Mar / Reñaca: reconciliación de datos (12-10-2026)

Punto de partida: la base de producción (Supabase), no los informes.

- El censo de Gemini y la auditoría de Sonnet se trataron como pistas.
- Cada cambio se verificó contra una fuente actual: sitio oficial, ticketera, cuenta oficial con publicaciones fechadas u OSM.
- Respaldo previo: `backup_venues_vina_renaca_20261012` (110 filas).
- Script aplicado, en una sola transacción: [`sql/2026-10-12-vina-renaca.sql`](sql/2026-10-12-vina-renaca.sql).
- Auditoría: 25 filas en `review_audit` (actor "Claude · reconciliación Viña/Reñaca 12-10-2026"). Cada una lleva fila anterior completa, fila nueva, motivo y URLs.

## Conteos

| | Publicados | Pendientes | Cerrados | Rechazados | Total |
|---|---|---|---|---|---|
| **ANTES** Viña del Mar | 26 | 4 | 6 | 59 | 95 |
| **ANTES** Reñaca | 4 | 0 | 0 | 11 | 15 |
| **ANTES** total | **30** | **4** | **6** | **70** | 110 |
| **DESPUÉS** Viña del Mar | 35 | 2 | 6 | 58 | 101 |
| **DESPUÉS** Reñaca | 4 | 3 | 0 | 9 | 16 |
| **DESPUÉS** total | **39** | **5** | **6** | **67** | 117 |

Valparaíso no se tocó: 66 publicados y 7 pendientes.

## Qué estaba mal en los informes (verificado)

| Tema | Gemini | Sonnet | Verdad verificada |
|---|---|---|---|
| Journal | Álvarez 1084, @journaldevina | Agua Santa 4, @journalvinaoficial | **Sonnet**: Passline lo confirma, con 6 eventos entre 16-oct y 12-nov-2026. Producción tenía "1 Poniente 452": corregido. |
| Barra Central | Av. Central 14507 | Av. Central 55 (Tripadvisor) | **Gemini y producción**: el sitio oficial dice Av. Central 14507. |
| El VAR (IG) | @elvarvina | @elvar.cl | **Ninguno**: el sitio oficial enlaza @elvar_cl. |
| Bargoño (IG) | @bargono.cl | desconocido | @bargonocl, desde el sitio oficial. |
| Cine Arte (IG) | @cineartevina | desconocido | @cinearte.vina, desde el sitio oficial. |
| Bloom (IG) | @bloomnikkeibar | @bloom_barcl | **Sonnet**: ambos dominios oficiales enlazan @bloom_barcl. |
| Hollywood / Club O | Club O activo | Hollywood activo en Borgoño 14738 | La marca hoy solo declara Merino 57 (Viña). Passline lista Borgoño 14738 sin eventos y el subdominio de Reñaca no responde. Reñaca queda **pendiente**; Club O no se importa. |
| Bar Vienés | activo | activo hasta jun-2026 | Activo: nuestro adaptador de PortalDisc tiene eventos hasta 14-nov-2026. |
| Hops | 2 Norte 162, cerrado | 4 Poniente 454 | 4 Poniente 454 (varias fuentes coinciden), pero sin publicaciones desde abr-2023: **pendiente**. |
| Schopería 4½ | 6 Norte 398 | 4½ Poniente 490 / Borgoño 14650 | Cuenta oficial: "6 Norte esquina 4 1/2 Poniente", activa oct-2026. |
| Coordenadas | 46 sin fuente | "todas sin fuente" | Ninguna se importó. Solo se aceptaron puntos OSM donde el POI tiene el nombre del local y el número correcto. |
| Precios | 8 cartas | sin respaldo | Ninguno importado. |

## Lugares nuevos (7)

| Lugar | Dirección | Evidencia | Estado |
|---|---|---|---|
| Glasgow Pub | 3 Poniente 660 esq. 8 Norte | IG @glasgowpub (12-oct-2026), FB oficial, OSM way/1055850566 | publicado |
| Club Gordos Viña | Av. San Martín 529 | clubgordos.cl (dirección + horario), IG activo 11-oct-2026 | publicado |
| Cónclave 1929 | 3 Norte 603 | IG con dirección en la bio (9-oct-2026), OSM way/552412322 | publicado |
| Bar La Virgen Viña del Mar | 4 Norte 55, Sector 101 | barlavirgen.cl/sucursales (dirección + horario) | publicado |
| El VAR | 5 Norte 164 esq. San Martín | elvar.cl, IG @elvar_cl (23-sep-2026) | publicado |
| Pasaje Coyotl | Av. Valparaíso 1137 (dentro de La Mexicana) | pasajecoyotl.cl, IG activo, OSM node/2859387867 | publicado |
| Living VIP Reñaca | Av. Borgoño 13101 | RA y directorios, sin cuenta oficial ni evento reciente | pendiente |

## Registros existentes corregidos o reclasificados

| Registro | Cambio | Motivo |
|---|---|---|
| El Journal (59) | Dirección → Agua Santa 4 esq. Álvarez; IG/FB oficiales; coordenadas OSM | Passline |
| Manda Reñaca (46) | rechazado → **publicado**, Borgoño 14880, IG @manda.chile | Cuenta activa, publicaciones 7–11-oct-2026 |
| Bargoño (279) | rechazado → **publicado**, 1 Poniente 474 | Sitio oficial, publicaciones sep–oct-2026 |
| Schopería 4½ (329) | rechazado → **publicado** (sede Viña) | Cuenta oficial activa |
| Viña Stage (364) | pendiente → **publicado**, Av. Valparaíso 65, sala en vivo | PortalDisc 23-oct-2026; IG activo |
| Hollywood Reñaca (56) | publicado → **pendiente** | Sin prueba actual en Reñaca (ver arriba) |
| Idílico (342) | rechazado → **pendiente** | Publicaciones de verano 2026, sin prueba actual |
| Hops (234) | dirección 416 → 454, sigue pendiente | Fuentes coinciden; cuenta inactiva desde 2023 |
| Restaurante María Clarita (362) | pendiente → **rechazado** | Restaurante; el evento era un bingo |
| Rufino (228) | dirección → 4 Norte 165; alias "Club Multiespacio" | Directorios 2026 |
| Bloom (123) | IG @bloom_barcl; alias "Nikki", "Sunset Bloom" | Nikki es la fiesta dentro de Bloom, no otro local |
| Bar 3T (116) | Sitio y horario oficiales | bar3t.cl |
| La Virgen Reñaca (124) | Horario oficial; IG de la cadena | barlavirgen.cl |
| Barra Central (243) | IG y sitio oficiales; **se mantiene** Av. Central 14507 | Sitio oficial |
| Manda Viña (355) | IG @mandavina.cl | Cuenta activa |
| Cine Arte (25), La Chingana (254), JarBar (301) | Cuentas oficiales enlazadas desde sus sitios | — |

**Duplicados fusionados: 0.** Nikki quedó como alias de Bloom, no como registro.

## Rechazos del set de Sonnet

No requirieron escritura:

| Candidato | Situación en producción |
|---|---|
| Club O, La Picá San Martín, Mi Bar, Kamikaze, Delirio | Nunca estuvieron. No se importan (sin funcionamiento actual o colisión inventada). |
| Von Bar, Club Viña | Ya estaban rechazados. |

Cierres previos que se mantienen:

| Local | Por qué se mantiene cerrado |
|---|---|
| Kunstmann Craft Bar | Uber Eats cerrado desde abr-2026 |
| Club de Cervezas | En 2 Norte 162 hoy funciona otro local |
| Jaggers Club | Cerrado según Wanderlog; Sonnet no halló evidencia 2026 |

## Siguen sin resolver

| Caso | Dónde queda |
|---|---|
| Hollywood Reñaca | Pendiente; ¿abre en verano? |
| Idílico | Pendiente; sede y temporada |
| Living VIP Reñaca | Pendiente |
| Hops | Pendiente |
| Stingray | Pendiente desde antes |
| Pargo (Av. Central 176) | No importado: restaurante nikkei con terraza; su cuenta no publica desde jun-2024 |
| Schopería 4½ Reñaca (Borgoño 14650) | Sin confirmar; la misma dirección aparece para Idílico |

Candidatos de Gemini sin evidencia independiente, no tocados:

- Beer House, Tapera, Costa Sushi, Club Español;
- bares de Pullman y Sheraton;
- Il Mascalzone (Recreo y Miraflores), Casa Recreo, Rúa;
- Espacio Sporting y Sala Viña (salvo los que ya estaban en producción).

Se descartaron por estar fuera del alcance:

- **Sativo:** grupo gastronómico.
- **Terraza Guadalupe:** restaurante.

## Cobertura por zona

Rendimiento marginal: la pasada A usó Bing, Instagram y sitios oficiales; la pasada B, el directorio RA y Tripadvisor.

| Zona | Publicados | Pendientes | Nuevos | Pasada A | Pasada B | Confianza |
|---|---|---|---|---|---|---|
| Reñaca Bajo / Av. Central | 3 | 0 | 0 | Manda (reabierto) | 0 válidos (Guadalupe = restaurante) | **MEDIA-BAJA** |
| Borgoño | 2 (Bloom, Manda) | 3 | 1 pend. | Living VIP, Idílico | Opium Beach (2011, histórico) | **BAJA**: la pasada A aún encuentra lugares |
| Reñaca Alto | 0 | 0 | 0 | sin resultados útiles | — | **SIN EVALUAR** |
| Viña Poniente / Barrio Poniente | 12 | 0 | 3 + 2 restaurados | Glasgow, Cónclave, La Virgen; Bargoño, Schopería | Praga y Oasis (RA, históricos) | **MEDIA** |
| Viña Centro | 14 | 1 | 1 | Pasaje Coyotl, Viña Stage | Espacio Fez (2018), Cluber (sin rastro) | **MEDIA** |
| Viña Norte (San Martín / 5–6 Norte) | 7 | 1 | 2 | Club Gordos, El VAR | — | **MEDIA** |
| Recreo, Miraflores, Santa Inés, Gómez Carreño, Chorrillos, Cochoa, Las Salinas, Caleta Abarca, hoteles | 0 | 0 | 0 | El buscador degradó las consultas por zona (resultados irrelevantes) | Sala Murano (Caleta Abarca) y Bodegón del Mar (Las Salinas) en RA, sin evidencia actual | **SIN EVALUAR** |

No se declara saturación en ninguna zona.

## Oportunidades de automatización

No se implementó nada nuevo.

**HIGH_VALUE_PUBLIC_HTML**

| Fuente | Qué ofrece |
|---|---|
| Passline `/venue/journal-vina` | 6 eventos fechados |
| PortalDisc `/cartelera/vinastage` | Viña Stage, ya enlazada como `calendar_url` |
| PortalDisc (Bar Vienés, El Pasaje, Teatro Municipal) | Ya tienen adaptador |
| Evently (journalvina, substance, quintapanoramas) | Ya cubierto por el adaptador regional |

Club90 (OVO, Manda) es multi-local, pero su último evento visto es de 2025: valor bajo.

**HIGH_VALUE_SOCIAL_ONLY**

- @manda.chile, @mandavina.cl, @hollywoodchile.cl, @glasgowpub, @conclave1929, @clubgordos;
- @vinastage, @schoperia4ymedio, @pasajecoyotl, @bargonocl, @bloom_barcl.

**MANUAL/BLOCKED**

- Passline devuelve 403 a clientes sin navegador.
- El subdominio Reñaca de Hollywood no resuelve.
- pargo.cl no responde.

No se verificó ninguna API pública: ninguna fuente se etiqueta como "estructurada".

## Snapshot

El snapshot público se regenera solo cada 5 minutos (`unstable_cache`, `revalidate: 300`). No hizo falta invocar el cron.

Verificado a las 23:17 UTC:

- dondesalgo.vercel.app y dondesalgo3d.vercel.app sirven el mismo snapshot: 142 lugares, 39 publicados en Viña y Reñaca;
- los 9 lugares nuevos o restaurados aparecen;
- Hollywood Reñaca ya no aparece.

## Veredicto

**VIÑA/REÑACA DATA READY FOR PRODUCT: PARCIAL.**

- **Lo que está listo:** lo publicado tiene evidencia actual y las direcciones y cuentas están corregidas contra fuentes oficiales.
- **Por qué es parcial:**
  - Reñaca tiene cobertura baja: la pasada A todavía encuentra lugares y Reñaca Alto no se evaluó.
  - Las zonas residenciales de Viña siguen sin evaluar.
  - Quedan 5 pendientes, uno de ellos estacional (Hollywood Reñaca).
  - La mayoría de los lugares nuevos no tiene coordenadas, porque OSM no tenía su número.
