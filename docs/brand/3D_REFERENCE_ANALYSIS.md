# Análisis de referencia — afiche “LALA Fest” (gramática visual, no copia)

Referencia entregada por el dueño el 11-10-2026 (640 × 800, afiche de un evento
real en Cassot Bar). Se estudia para extraer **cómo funciona**, no para
reproducirlo. Quedan prohibidos para Dónde Salgo?: su logotipo, el ojo, el
portal, las figuras, su composición y su información.

## Lo que se ve

| Rasgo | Observación |
|---|---|
| Paleta (muestreo) | Base de tinta gris-azul muy oscura (~#272934, #2C2F3C), un azul ultramar empolvado en el cielo y el suelo (~#55668C, #5C6580), violetas apagados (~#797299, #958CB8) y un halo lila (~#AC92C2). El acento es un coral frambuesa impreso en bloque (~#C7556B / #B55A67). La tinta clara no es blanca: crema rosada (~#E3CED5). Un toque mínimo de menta en el centro. |
| Textura | Grano de papel fuerte en toda la superficie, ruido de fotocopia en las nubes, moteado de tinta en las rocas. Nada es liso. |
| Impresión | Lenguaje de serigrafía o risografía: pocas tintas planas superpuestas, bloques de color con bordes limpios y fotos tramadas debajo. Hay **fuera de registro** visible (la tinta coral corre unos píxeles respecto del negro en las figuras). |
| Trama (halftone) | Las nubes y el halo se leen como trama de puntos o grano grueso, no como degradé digital. |
| Tipografía | Tres registros: (1) un título display recortado a mano, irregular, casi collage; (2) una grotesca condensada en mayúsculas para fecha y line-up, muy pesada; (3) una monoespaciada chica para la dirección y los créditos. El contraste de tamaño es extremo: dos palabras gigantes y todo lo demás pequeño y ordenado. |
| Jerarquía | Arriba, título + dato práctico (fecha); al centro, el mundo y la atmósfera; abajo, el lugar y el line-up en bloques; al pie, los créditos. La información vive en **bloques planos**; el mundo vive **detrás**. |
| Simetría | Frontal y casi simétrica, con un punto de fuga central. |
| Profundidad | Perspectiva de un punto (suelo que fuga), objetos repetidos que disminuyen de tamaño, un halo luminoso detrás del foco, nubes como capas de fondo. |
| Collage | Recortes fotográficos (nubes, rocas, figuras) pegados sobre un cielo tramado; las uniones no se disimulan. |
| Surrealismo | Objetos fuera de escala, un elemento flotando en el cielo, un pasaje imposible. |
| Separación de capas | Tres niveles nítidos: fondo tramado → mundo fotográfico → bloques de texto planos e impresos encima. Esa separación es la clave del encargo: **la interfaz es la capa de bloques planos; el 3D es el mundo de atrás.** |

## Lo que se extrae (gramática)

1. **Tinta oscura azulada, no negro neutro**, con un acento coral frambuesa y una
   tinta clara crema rosada.
2. **Pocas tintas planas** y **fuera de registro** leve en los elementos de marca.
3. **Grano y trama** en todo lo decorativo, nunca sobre el texto funcional.
4. **Bloques planos para la información**, mundo con profundidad detrás.
5. **Contraste de escala** en la tipografía: la marca muy grande, todo lo demás
   chico y ordenado.
6. **Un motivo repetido que construye profundidad.**

## Lo que NO se toma

Ni el ojo, ni el portal, ni las figuras, ni la fila de objetos que converge al
centro, ni el bloque de título + bloque de fecha lado a lado, ni la tipografía
recortada del título, ni los valores exactos de color.

## Traducción a Dónde Salgo?

- **Motivo propio:** el “?” de la marca, repetido en contornos impresos que se
  alejan en profundidad, como capas de tinta corridas: un “?” que es a la vez
  pasaje, señal y marca de registro. Va **descentrado**, no en un eje simétrico.
- **Paleta propia** (verificada con WCAG):

| Rol | Nombre | Color |
|---|---|---|
| Fondo | Tinta | `#13131D` (negro azulado cálido) |
| Superficie | Noche índigo | `#1E2034` (elevada `#2A2C45`) |
| Papel | Papel rosado | `#F1E6DE` |
| Acento | Coral impreso | `#F0607A` |
| Secundario | Ultramar polvo | `#8C98D6` (solo marca, trama y fuera de registro) |
| Atmósfera | Lila apagado | `#B9A3DA` (solo decorativo, opacidad baja) |
| Línea / texto suave | — | `#373A55` · `#ABA9C7` |

- **Logo:** la misma firma “Afiche”; el “?” pasa a coral con el fuera de registro
  en ultramar. La palabra sigue siendo SVG legible.
- **Profundidad:** fondo tramado (Z0) → nubes de trama y halo (Z1) → túnel de “?”
  (Z2) → interfaz plana (Z3) → sombras de impresión y bordes (Z4).
