# Sistema de diseño

Estado: **vigente en producción**, salvo lo marcado como propuesto. Existe para dejar de decidir
cada componente por separado.

## Principio

La aplicación se mira de noche, en la calle, con una mano y con prisa. Cada decisión responde a:
**¿esto ayuda a decidir dónde ir en diez segundos?** Lo que no ayuda, sobra.

## Color

### Base

| Token | Valor | Uso |
|---|---|---|
| ground | `#101114` | fondo de página |
| surface | `#17191d` | tarjetas y bloques |
| surface-2 | `#1e2126` | superficies elevadas |
| line | `#2b2f36` | bordes |
| text | `#e9e7e2` | texto principal |
| text-dim | `#9a9893` | texto secundario |
| accent | `#f0785a` | acción primaria, marca |
| lime | `#b9d94f` | énfasis positivo del titular |

### Acento por ciudad

Una base de marca, identidad geográfica por acento. **Nunca pinta el fondo de la página**: sólo el
filete izquierdo de una tarjeta de lugar, un chip, o el encabezado de una zona.

| Comuna | Acento | | Comuna | Acento |
|---|---|---|---|---|
| Valparaíso | `#f0785a` | | Limache | `#bccf5e` |
| Viña del Mar | `#54c7c0` | | Olmué | `#6fbf8e` |
| Reñaca | `#e8b25c` | | Quillota | `#e08f6a` |
| Concón | `#6f9ae0` | | La Calera | `#9aa8bd` |
| Quilpué | `#8fc26a` | | Quintero | `#5cc0d8` |
| Villa Alemana | `#b48ae0` | | Puchuncaví | `#e08aa4` |
| | | | Maitencillo | `#5fd0b0` |

Regla dura: el acento de ciudad **nunca** se usa para significado semántico. Error, éxito, en vivo
y advertencia tienen sus propios colores y no se confunden con geografía.

## Arte generativo de tarjeta

Cuando no hay flyer oficial, la tarjeta **no** muestra un bloque vacío. Se genera arte en CSS a
partir de datos reales, sin llamar a ninguna API de imágenes.

Jerarquía de imagen, en orden:

1. flyer oficial del evento
2. imagen oficial del lugar *(propuesto)*
3. logo o recurso de marca del lugar *(propuesto)*
4. arte generativo de Carreteando

El arte se compone de: **tipo de noche** (paleta) + **hash del título y recinto** (geometría de la
banda diagonal, alineación del titular). El tipo manda sobre el estilo musical, porque una fonda no
es un género. Si el género no se conoce, **no se dice nada**: nunca «Otro».

| Tipo | Paleta |
|---|---|
| fonda | `#7a2318` sobre `#ffd9a8` |
| after | `#1b2340` sobre `#a9c2ff` |
| pre | `#234038` sobre `#a9f0cf` |
| en vivo | `#3c2148` sobre `#eccfff` |
| club | `#10303a` sobre `#9fe6ef` |
| sin tipo ni género | una de cinco variantes por hash |

## Tipografía

Titulares en escala fluida con `clamp()`, interlínea comprimida y `text-wrap: balance`.
Los rótulos van en versalitas con `letter-spacing` amplio. Los números que se comparan en columna
usan `tabular-nums`.

## Espacio y forma

Rejilla por `gap`, nunca por márgenes que colapsen. Radio pequeño y sobrio: el radio y la sombra
son señales de «objeto separado» y se gastan por jerarquía, no por decoración. Gutter lateral
mínimo de 16 px a cualquier ancho.

## Componentes

| Componente | Regla |
|---|---|
| Tarjeta de evento | flyer o arte generativo · insignia de día · tipo o género (nunca «Otro») · hora · nombre · recinto · comuna · precio · procedencia · compartir |
| Tarjeta de lugar | **no imita** a la de evento: sin flyer grande, se lee como ficha. Filete de ciudad, tipo, zona, dirección, fechas anunciadas, Instagram |
| Tarjeta de zona | nombre, comuna, lugares que contiene, conteo de fechas |
| Estado en vivo | valor dominante + tamaño de muestra + antigüedad. Nunca se muestra con menos de dos reportes coincidentes |
| Estado vacío | dice qué falta y ofrece la siguiente acción concreta; nunca termina la experiencia |
| Error | dice que no se pudo confirmar y no inventa contenido de reemplazo |

## Movimiento

El movimiento comunica **vivo**, **cambio** y **noche**; nunca decora. Transiciones cortas en
estados de foco y hover. Se respeta `prefers-reduced-motion`.

## Accesibilidad

Objetivo permanente: 100 de accesibilidad en Lighthouse. Foco visible siempre, objetivos táctiles
de al menos 44 px, contraste comprobado en cada combinación de acento, y nombres accesibles en todo
control que sólo muestre un icono.

## Confianza como elemento de diseño

Cuatro estados que **no se aplanan en «verificado»**:

| Estado | Significado |
|---|---|
| Fuente oficial | la publica el propio lugar u organizador |
| Curaduría · fuente revisada | la revisamos contra una fuente pública |
| Enviado por la comunidad | lo mandó alguien y fue aprobado |
| Reporte de la comunidad | opinión de quien está ahí, con muestra y antigüedad |

«Organizador verificado» sólo se usa si el organizador lo verificó de verdad.
