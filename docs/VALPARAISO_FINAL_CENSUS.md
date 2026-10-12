# Valparaíso — censo final de locales (12-10-2026)

Pasada final de reconciliación sobre la base real, con dos informes externos como
**pistas, no como verdad**: el censo de Gemini (V2) y una auditoría independiente
de Sonnet. Ninguno de los dos se importó en bloque. Cada cambio en producción salió
de la base canónica más evidencia fresca abierta en esta pasada.

**Respaldo previo:** la tabla `public.backup_venues_valparaiso_20261012` guarda las
125 filas de Valparaíso tal como estaban (solo recuperación, sin acceso público).
Cada mutación tiene su fila en `review_audit` con el actor
`Claude · censo final Valparaíso` (86 filas).

## Antes y después

| | Antes | Después |
|---|---|---|
| Publicados | 67 | **56** |
| Pendientes de evidencia | 5 | **30** |
| Cerrados | 9 | **11** |
| Rechazados | 44 | **45** |
| Total | 125 | 142 |

## Regla de evidencia aplicada

- **Publicado** solo si hay base actual de operación:
  - evento propio vigente en ticketera o sitio (A);
  - o cuenta oficial con publicaciones en los últimos 180 días (A);
  - o sitio oficial con información vigente (A).
- **Directorios no publican solos.** Google, OSM, Wanderlog o Tripadvisor (C) nunca
  bastaron para publicar ni para dar algo por abierto.
- **Cierre:**
  - un cierre explícito gana sobre fichas abiertas viejas;
  - "cerrado permanentemente" en un directorio se usó para **cerrar** solo cuando
    coincidió con silencio total del canal propio (Pixel Bar, Casa Cervecera Altamira);
  - en los demás casos el local quedó **pendiente**, no cerrado.
- **Fecha de un post de Instagram:** sale del propio identificador de la
  publicación, porque el código codifica la marca de tiempo.
- **Instagram:**
  - no se hizo scraping pagado ni se pidió sesión;
  - solo se leyeron perfiles públicos.
- **Procedencia por campo:**
  - se usa `field_sources` (ya existía, no hubo cambio de esquema);
  - cada decisión deja `censo_final_valpo` con la URL de evidencia, su fecha y el
    grado de evidencia;
  - las direcciones y los Instagram corregidos llevan su propia fuente.

## Los 67 publicados: decisión

| Decisión | Cantidad |
|---|---|
| KEEP | 38 |
| UPDATE | 9 |
| DOWNGRADE → pendiente | 17 |
| CLOSE | 2 |
| REJECT | 1 |
| MERGE | 0 |

**KEEP por evento vigente propio (27):**
- Trotamundos;
- Emporio Echaurren;
- Club Segundo Piso;
- Espacio Barcelona;
- Cassot Bar;
- Espantapájaros Karaoke;
- La Colombina;
- Lemutt Bar;
- Los Alquinta del Puerto;
- Panic House;
- La Pará Kultural;
- Multiespacio Condell;
- Club Alemán;
- Teatro Mauri SCD;
- Parque Cultural;
- Casa de la Cultura (Serrano 567);
- Studio Valparaíso;
- Teatro IPA;
- Aula Magna USM;
- Barbones Curauma;
- Bar Cinzano;
- Balada El Huevo;
- Terraza Bellavista;
- Teatro Municipal;
- Máscara;
- Valparaíso Profundo;
- Bar Terraza Miaw.

**KEEP por cuenta, sitio o ticketera vigente (11):**
- Sala Negra UV;
- Barón Rooftop;
- UK Bar;
- Bar del Tío;
- Cervecería Anfiteatro;
- El Canario;
- Oui Oui;
- Bar Restaurant Victoria (Passline, evento 15-10);
- Centro Cultural Casa Polanco (PortalTickets, 31-10);
- Espacio la Compañía (PortalTickets, 31-10);
- Fauna Hotel (sitio oficial).

**UPDATE (9):**

| Local | Cambio |
|---|---|
| Bar La Morada | El IG guardado `@barlamorada` era de **un bar de Rosario, Argentina**. Ahora: `@lamorada.bar` (enlazado desde barlamorada.cl). |
| El Gato en la Ventana | El IG guardado no existía. Ahora: `@bargatoenlaventana`. |
| Bar de Pisco | Dirección 448 → **Almirante Montt 454** (biografía oficial). Se agrega `@bardepisco`. |
| Cervezocracia | Se agrega `@cervezocracia`. |
| El Rincón de las Guitarras | Se agrega su IG (post oficial confirma Freire 431). |
| Pajarito | Se agrega `@bar_pajarito16` y barpajarito.cl. |
| Magura | Dirección **Avenida Fundadores 717** (biografía oficial). |
| Proa | Se agrega `@barproa`. Conflicto de número anotado: 302 en directorios y sitio, 308 en post oficial. No se adivinó. |
| Galería Rosmarino | Se agrega `@rosmarinovalpo` (Dimalow 167, piso 2). |

**DOWNGRADE → pendiente (17):**

| Local | Motivo |
|---|---|
| Bar Inglés | Cerrado desde 2017; edificio restaurado en 2025, sin reapertura confirmada. |
| Bar La Playa | Anunció su cierre en 2021; IG sin posts desde 2019; solo ficha de directorio. |
| Bar Industrial | IG ya no existe; Almirante Montt 24 coincide con Klanu Rock Bar. |
| Brighton | IG sin posts desde 2019; edificio en venta. |
| El Caregallo | IG eliminado. |
| El Coyote Quemado | El IG oficial confirma Subida Ecuador 144, pero su último post es del 09-10-2025. |
| Liberty | Solo directorios y reseñas. |
| Liverpool Cervecería | IG eliminado. |
| Matiz | Último post 2024-11. |
| Mero Club | Marcado cerrado; dirección en conflicto. |
| **Pagano** | Dirección corregida de Blanco 236 a **Av. Errázuriz 1852** (Passline y Facebook oficial). Último evento fechado: oct-2025. Su IG es +18 y no se lee sin sesión. **Prioridad 1 de recheque.** |
| Restobar Mi Casa | Último post 2025-05. |
| Sky Bar 360 | Su dominio ya no resuelve. |
| Terraza Mimi | IG sin posts desde 2015. |
| Espacio Social Violeta | IG eliminado. |
| Ele Bar | Directorio lo marca cerrado. |
| Flora Bar | Cerrado temporalmente; hoy Rosmarino ocupa Dimalow 167. |

**CLOSE (2):**
- **Pixel Bar** (Ecuador 265): figura cerrado permanentemente, no tiene canal propio y el IG homónimo es de Curacaví.
- **Casa Cervecera Altamira:** figura cerrado permanentemente y no publica desde 2022. Además duplicaba el id 100, ya rechazado.

**REJECT (1):** **Il Paparazzo**, restaurante italiano que cierra entre las 16:00 y las 21:00 (OUT_OF_SCOPE).

## Candidatos nuevos

**Publicados (9), todos con evidencia A vigente:**

| Local | Dirección | Evidencia |
|---|---|---|
| Club Tendedero | Blanco 331 | IG oficial, 11-10 |
| El Pimentón | Av. Ecuador 27 | IG oficial con horario; coordenadas desde su nodo OSM |
| Blanco Centro de Eventos (alias Blanco Social Club) | Blanco 889 | IG oficial, 11-10 |
| Poseidón Bar | Plaza Aníbal Pinto 339 | PortalTickets, evento 24-10 |
| Balmaceda Arte Joven | Santa Isabel 739 | PortalTickets, 23-10 |
| Corazón Continto | Templeman 561 | IG oficial con horario |
| Madame Claude | Almirante Montt 60 | IG oficial con horario |
| Del Barrio | Pedro Montt 2302 | IG oficial |
| Cervecería Run Run | Esmeralda 1060, local 7 | IG oficial con horario |

Poseidón y Balmaceda ya estaban en la cola, propuestos por la ingesta; ahora tienen
dirección y tipo.

**Pendientes de evidencia (10):**

| Local | Qué falta |
|---|---|
| Club Delirio | Activo hasta 07-2026; dirección en conflicto: Blanco 504-508 frente a Chacabuco 2124. |
| Klanu Rock Bar | Activo; dirección sin fuente, choca con Bar Industrial. |
| MaliZioso | Relevancia para salir. |
| Lo Devi | Su Facebook declara Ecuador 50; sin fecha. |
| Club M | Sin dirección ni fecha. |
| Nuevo Errázuriz | Solo directorio. |
| Café República | Activo; se presenta como café de barrio. |
| Maleza | Restaurante; horario. |
| Hotzenplotz | Activo; sin dirección publicada. |
| Hotel Verso Bar & Resto | Sin dirección. |

**No se agregaron:**
- Giardino Malandrino: restaurante (OUT_OF_SCOPE).
- Psircus: marca de fiestas, no un local.
- La Joya: hostal.
- La Azotea (Gran Bretaña 21): figura cerrado temporalmente.
- San Juan del Puerto: figura cerrado permanentemente.
- Polideportivo Tranque Seco: recinto deportivo.

**Ya existían y no se duplicaron:**
- Bar Victoria;
- Bar La Playa;
- Espantapájaros;
- El Irlandés (cerrado);
- Altamira;
- Terraza Mimi;
- Barmacia (rechazado);
- Sixty Nine (rechazado);
- Casa de la Cultura;
- Bar La Mamba (pendiente).

## Conflictos clave

- **Los dos informes fallan.**
  - Gemini dio por "CONFIRMED_ACTIVE" locales cerrados (La Azotea, San Juan del
    Puerto) e inventó Instagram: `@corazoncontinto`, `@malezavalpo`,
    `@madameclaudebar` y `@hotzenplotzbar` no son los oficiales.
  - Sonnet dio como "omitidos" locales que ya estaban (Bar Victoria, Bar La Playa).
- **Corredor Subida Ecuador:**
  - 144 es Coyote Quemado (IG oficial), no Club M;
  - Lo Devi declara Ecuador 50;
  - Espantapájaros está en 257;
  - Proa tiene 302/308 sin resolver;
  - Matiz figura en 155 y en 156.
  - Quedan anotados como inciertos; no se adivinó ninguno.
- **Mismo número, locales distintos:**
  - Almirante Montt 24: Bar Industrial / Klanu.
  - Dimalow 167: Flora / Rosmarino.
  - Serrano 567: Casa de la Cultura (PortalTickets) / Bar La Playa (directorio).
  - Blanco 1279: el ex Irlandés aparece hoy como "Bar token" en el directorio de
    PortalTickets, sin eventos.
- **Pagano:** la base tenía Blanco 236 (dirección antigua). La actual es
  Errázuriz 1852. Se corrigió y se borraron las coordenadas viejas.

## Ticketeras

- **PortalTickets** (ya automático): su directorio lista 69 espacios de
  Valparaíso.
  - Los **20 con eventos futuros** están todos cubiertos: publicados o
    promovidos en esta pasada.
  - Los otros 49 (Kynky Clvb, Bar token, Salón Bizarre, Club Central, Subterráneo
    Sonoro…) tienen **cero eventos vigentes**. Son historial del directorio, no un
    grupo activo desconocido.
- **TicketPlus:** Valparaíso muestra Parque Cultural y Barbones Curauma; ambos ya
  están publicados.
- **Passline** (bloquea con Cloudflare; no se forzó) queda como **MANUAL**. Páginas
  de local útiles: `passline.com/venue/bar-victoria` y
  `passline.com/venue/pagano-valpo`.
- **Evently y GoldenPass:** se encontraron eventos de Blanco Centro de Eventos,
  Pagano y Delirio; quedan como **MANUAL**.
- **Toliv:** no se pudo leer en esta pasada.

## Monitoreo por Instagram (sin scraping pagado; `APIFY_PAUSED` sigue en true)

Son los locales cuya programación vive en Instagram y que no tienen alternativa
estructurada.

| Nivel | Cuentas |
|---|---|
| **HIGH_VALUE_WEEKLY** | `club_tendedero.oficial`, `mascara_valparaiso`, `studiovalparaiso`, `barelhuevo`, `terrazabellavista.cl`, `terrazamiaw`, `barproa`, `bargatoenlaventana`, `lamorada.bar`, `cervezocracia`, `barelcanario`, `blancovalparaiso`, `elrincondelasguitarrasvalpo`, `delbarriovalpo`, `corazoncontinto.cl` |
| **LOW_VALUE_MONTHLY** | `bardeltio_`, `ukbarvalpo`, `baronrooftop`, `bardepisco`, `anfiteatrobar`, `ouioui_valpo`, `bar_pajarito16`, `magura_curauma`, `pimentonvalpo`, `rosmarinovalpo`, `escuelateatrouv`, `bar_madame_claude`, `cerveza_runrun` |
| **MANUAL_ONLY** | `paganocl` (+18), `club.delirio.valparaiso`, `klanurockbar` (ambos pendientes) |

## Calidad de datos de los 56 publicados

| Campo | Cobertura |
|---|---|
| Evidencia de operación vigente registrada | 56 / 56 |
| Dirección con fuente (oficial, ticketera u OSM POI) | 46 / 56 |
| Instagram verificado en esta pasada | 28 (38 con IG en total) |
| Horario con fuente | 10 |
| Dato de precio de local (muestra de carta) | 4 |
| Coordenadas | 36 / 56 |

- **Precio:** el precio de un evento no se usó como nivel de precio del local, y no
  se inventó ningún $–$$$$.
- **Coordenadas:** las tres altas sin coordenada verificable a nivel de número
  quedaron sin coordenada (UNKNOWN), en vez de ubicarse a nivel de calle.

## Cobertura por zona (confianza real, no "HIGH" por defecto)

| Zona | Publicados | Pendientes | Confianza |
|---|---|---|---|
| Plan de Valparaíso | 16 | 3 | MEDIUM: ticketeras barridas, bares con cuentas verificadas |
| El Almendral | 9 | 2 | MEDIUM |
| Barrio Puerto | 7 | 4 | MEDIUM |
| Barrio Cumming | 7 | 4 | MEDIUM |
| Subida Ecuador | 3 | 6 | **LOW**: corredor con más bares sin evidencia vigente y direcciones en conflicto |
| Cerro Alegre / Concepción | 7 | 4 | LOW–MEDIUM: verificados los bares más citados; los restobares "para la tarde" de los informes siguen sin pasada |
| Otros cerros, Playa Ancha, Curauma | 7 | 3 | LOW |
| Sin zona asignada | 0 | 4 | (pendientes sin dirección confirmada) |

**Saturación de esta pasada:**
- 56 locales canónicos publicados;
- 9 nuevos de alta confianza;
- 30 sin resolver, en cola con lo que falta y fecha de recheque a 30 días.

No se declara cobertura exhaustiva.

## Puerta de cierre de Valparaíso

| Criterio | Estado |
|---|---|
| A. Ningún falso positivo conocido publicado | Sí |
| B. Todo publicado tiene base actual de operación | Sí (56/56) |
| C. Conflictos de dirección resueltos o marcados | Sí |
| D. Las ticketeras no muestran un grupo activo desconocido | Sí |
| E. Sin hueco sistemático en zonas densas | Parcial: Subida Ecuador queda en LOW por evidencia, no por falta de búsqueda |
| F. Lo no resuelto queda en cola, no adivinado | Sí (30) |
| G. Descubrimiento futuro vía `search_misses`, aportes e ingesta | Sí (ya existe) |

**Veredicto:** la investigación intensiva de Valparaíso se puede cerrar.

Lo que sigue es mantenimiento:
- recheque de la cola a 30 días;
- prioridades: Pagano, Coyote Quemado, Delirio, Klanu y Lo Devi.

Siguiente ciudad: Viña del Mar / Reñaca.
