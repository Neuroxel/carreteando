# Censo de locales V2

Fecha: 4 de octubre de 2026. Separado de la ingesta de eventos: un lugar existe
aunque hoy no tenga fiesta.

## Método

Cada fuente crea **candidatos privados** (`moderation_status = pending`,
`disposition = needs_evidence`). Un candidato pasa a público solo con:

- **una** fuente actual fuerte (cuenta o sitio propio del local, agrupación
  local de comerciantes, registro formal), **o**
- **dos** fuentes independientes más débiles y actuales,

y además una dirección creíble. Si una fuente dice que cerró, se marca cerrado.
Cada campo guarda su procedencia en `venues.field_sources` (fuente, fecha,
nota). Horario y precio tienen columnas propias que **exigen** fuente y fecha
(restricciones en la base).

| Fuente | Rol | Estado |
|---|---|---|
| Agrupación local (familia `LOCAL_ASSOCIATION`), p. ej. directorio de Barrio Cumming | fuerte: identidad, dirección, horario publicado | usada (15 fichas del directorio) |
| OpenStreetMap, extracto regional offline | pista masiva: nombre, punto, a veces horario | usada: 172 puntos → 142 candidatos |
| Google Places API (oficial) | detector de huecos, nunca fuente pública | **no activada** (ver costo abajo) |
| Registro SERNATUR | identidad formal de restaurantes/bares turísticos | pendiente |
| Patentes de alcohol municipales | pista; si es vieja, solo histórica | pendiente |
| Búsqueda web por zona | confirmación de vigencia | manual, por zona |
| Instagram | solo piloto acotado | pausado (Apify) |

## OpenStreetMap

- Extracto `valparaiso.osm.pbf` de openstreetmap.fr (03-10-2026), procesado
  **offline** con `pyosmium`. No se usó la API pública de Overpass en volumen.
- Etiquetas: `amenity=bar|pub|nightclub|biergarten`, `craft=brewery` con nombre.
- Comuna inferida por coordenada y corregida a mano en el interior (puntos que
  la heurística ponía en Concón eran de Quillota; los de "Limache" al este, de
  Olmué). Zapallar y Papudo quedaron fuera de cobertura.
- Deduplicación contra la base: nombre normalizado dentro de la misma comuna,
  alias, o mismo punto (< ~40 m) con la misma primera palabra. 29 coincidieron
  con lugares existentes (se les anotó el id de OSM); 4 coincidencias falsas se
  corrigieron a mano (Barbones ≠ Barbones Curauma, Hollywood ≠ Hollywood
  Reñaca, Del Puerto ≠ Los Alquinta del Puerto, Cervecera ≠ Altamira). 2 nodos
  repetidos de Juglar (Viña) quedaron rechazados como duplicados. Se descartaron
  una licorería y un sushi.
- **Licencia ODbL.** Los datos de OSM se usan como pista interna. Si alguna vez
  se publica una coordenada o un dato tomado de OSM, la página debe decir
  "© colaboradores de OpenStreetMap" y la base derivada queda bajo ODbL
  (compartir igual). Hoy ninguna ficha pública muestra datos de OSM: el mapa
  usa coordenadas geocodificadas propias.
- Advertencia: muchos nodos de OSM son antiguos (los pubs de calles Norte en
  Viña se cargaron hace más de 15 años). Por eso no se publican sin evidencia
  actual.

## Barrio Cumming (validación del dueño)

| Local | Resultado |
|---|---|
| El Canario, La Morada, El Gato en la Ventana, Bar Cinzano, Bar Oui Oui | **YA ESTABAN**, pero con la zona equivocada: por eso no se veían en el barrio. Zona corregida y horario del directorio cargado |
| Cervecería Anfiteatro | estaba oculta; **publicada** (directorio + visita del dueño). Conflicto de dirección: OSM dice Blanco 618, la base Subida Cumming 107; anotado |
| Espacio Social Violeta | **NUEVO VERIFICADO** |
| La Mamba | NECESITA EVIDENCIA |
| Bar Industrial | NECESITA EVIDENCIA (conflicto de dirección: Blanco 1345 vs Almirante Montt 24) |
| Causa Nostra, La Boca del Oso, Restobar Mi Casa | NECESITA EVIDENCIA (candidatos) |
| Sushi Dream, Kabala | NO ES VIDA NOCTURNA |
| El Dominó La Rosita del Puerto, Ilícito, Bar Terraza Miaw, Cerveza del Cerro, Toulat, Bar de Pisco, beerHOUSE, Ritual, Cervecera | solo en OSM: candidatos, falta fuente actual |

## Inventario por comuna (04-10-2026)

| Comuna | Publicados | Candidatos | de ellos OSM | Cerrados | Con Instagram | Con horario |
|---|---|---|---|---|---|---|
| Valparaíso | 51 | 65 | 45 | 2 | 28 | 4 |
| Viña del Mar | 17 | 71 | 56 | 0 | 7 | 0 |
| Quilpué | 7 | 17 | 11 | 0 | 3 | 0 |
| Quillota | 5 | 8 | 2 | 0 | 2 | 0 |
| Quintero | 5 | 7 | 1 | 1 | 2 | 0 |
| Concón | 4 | 11 | 2 | 0 | 2 | 0 |
| La Calera | 3 | 7 | 0 | 0 | 1 | 0 |
| Villa Alemana | 3 | 15 | 11 | 0 | 0 | 0 |
| Limache | 2 | 9 | 4 | 0 | 0 | 0 |
| Reñaca | 2 | 13 | 7 | 0 | 2 | 0 |
| Olmué | 2 | 11 | 3 | 0 | 1 | 0 |
| Maitencillo, Puchuncaví | 0 | 7 | 0 | 0 | 0 | 0 |
| **Total** | **101** | **241** | **142** | **3** | **48** | **4** |

## Zonas y saturación

Modelo de zonas en Valparaíso: Barrio Cumming / Aníbal Pinto, Subida Ecuador,
Cerro Alegre / Concepción, Barrio Puerto, Plan, El Almendral, Playa Ancha,
Curauma / Placilla y otros cerros. En Viña: calles Norte / Poniente, Centro
(Av. Valparaíso), Reñaca. El resto, por comuna.

"Saturación" = publicados / (publicados + candidatos plausibles). No es
cobertura total: es cuánto de lo que **sabemos que existe** ya está confirmado.

| Zona | Publicados | Candidatos OSM | Saturación aprox. | Lectura |
|---|---|---|---|---|
| Barrio Cumming / Aníbal Pinto | 6 | 9 | ~40 % | prioridad 1: densa y el dueño la conoce |
| Subida Ecuador | 6 | 5 | ~55 % | buena |
| Cerro Alegre / Concepción | 9 | 5 | ~65 % | buena |
| Barrio Puerto | 5 | 9 | ~35 % | prioridad 2 |
| Plan de Valparaíso | 13 | 11 | ~55 % | discotecas de Errázuriz por confirmar |
| El Almendral | 6 | 3 | ~65 % | |
| Viña calles Norte / Poniente | 6 | 33 | ~15 % | **el hueco más grande**; muchos nodos viejos |
| Viña Centro (Av. Valparaíso) | 7 | 17 | ~30 % | prioridad 3 |
| Reñaca | 3 | 7 | ~30 % | estacional |
| Quilpué | 7 | 11 | ~40 % | |
| Villa Alemana | 3 | 11 | ~20 % | |

Nota: la columna de Instagram y la de horario se cuentan sobre publicados.

## Google Places (no activado)

- Uso permitido: detector de huecos ("¿hay bares en esta manzana que no
  tenemos?") vía la API oficial, nunca raspando Google Maps.
- Restricciones de los términos: no se puede guardar el contenido de Places
  (nombre, horario, fotos) como base propia más allá del `place_id` y de cachés
  temporales; no se puede mostrar junto a un mapa que no sea de Google. Por
  eso serviría solo para encontrar el nombre y luego confirmarlo en una fuente
  propia del local.
- Costo de referencia (consultado el 04-10-2026): Text Search Pro 32 USD por 1.000
  llamadas tras 5.000 gratis al mes por SKU; Essentials (solo ids) 10.000
  gratis. Con `FieldMask` en `places.id,places.displayName,places.formattedAddress`
  y una búsqueda por cuadrícula:

| Lugares a revisar | Llamadas (estimado: 1,5 por lugar, celdas de 20 resultados con solapamiento) | Costo |
|---|---|---|
| 100 | ~150 | 0 USD (dentro del tramo gratis) |
| 500 | ~700 | 0 USD |
| 1.000 | ~1.500 | 0 USD |

- Antes de activar: cuota diaria dura en Google Cloud (p. ej. 300
  llamadas/día), alerta de facturación en 5 USD y prueba de 20 llamadas
  midiendo la factura real. **No se activó en esta pasada.**

## Precio

- Escala: `$` a `$$$$` a partir de la canasta de una salida (una cerveza o
  schop, un trago simple, entrada si la hay), siempre de la carta o publicación
  del local.
- Calibración: muestra de 30–50 locales por zona y tipo antes de fijar
  umbrales. **No se hizo en esta pasada**: hoy hay 0 niveles publicados y la
  tarjeta no muestra nada si no hay dato.
- Cada nivel lleva `price_source` y `price_verified_at`; a los 6 meses se
  muestra como antiguo.

## Horario

4 de 101 lugares publicados tienen horario con fuente (directorio de Barrio
Cumming). Se muestra como "Según horario publicado", con fuente y fecha.

## Instagram

53 lugares publicados no tienen su Instagram confirmado. Piloto propuesto en
`docs/COBERTURA.md`: 2–3 USD, tope 10 USD, solo cuentas propias de los locales,
nunca publica solo.

## Rendimiento

El snapshot público viaja con la página. Medido con 101 lugares y 77 eventos:
149 KB sin comprimir, 20 KB con gzip. Estimado:

| Lugares | Sin comprimir | gzip |
|---|---|---|
| 100 | 148 KB | 20 KB |
| 250 | 262 KB | 35 KB |
| 500 | 451 KB | 61 KB |
| 1.000 | 830 KB | 111 KB |

Hasta ~500 lugares no hace falta virtualizar ni paginar. Sobre eso, el primer
paso es un snapshot de lista más liviano (sin descripción ni fuentes), no
virtualización.

## Siguientes pasos

1. Barrio Cumming y Barrio Puerto: confirmar los candidatos de OSM caminando o
   con la cuenta del local.
2. Viña calles Norte: barrido web por cuadra, cerrar los nodos viejos.
3. SERNATUR y patentes: cruzar por comuna.
4. Calibración de precio con 30–50 locales.
