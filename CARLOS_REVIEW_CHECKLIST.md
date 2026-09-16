# Guía de revisión — Carlos

Catorce pruebas, en orden. Hazlas **en el teléfono** primero: el producto es
móvil antes que nada.

Sitio: https://carreteando.vercel.app

## Antes de empezar: lo que ya sabemos que falta

Para que no pierdas tiempo reportando lo que ya está documentado:

- **Ningún lugar tiene foto propia.** Las tarjetas de lugar no llevan imagen y
  los eventos sin cartel usan un sistema gráfico generado. Es deliberado: no
  copiamos fotos de terceros sin derechos claros.
- **31 de 93 lugares no tienen pin en el mapa.** No publicamos una coordenada
  dudosa; preferimos no marcarlo.
- **Los reportes en vivo no tienen uso real todavía.** Funcionan, nadie los ha
  usado.
- **No hay favoritos ni perfil.** Aparecen en los mockups, no en el producto.
- **No hay moderadores con nombre.** Una sola credencial, la de David.

## Las pruebas

| # | Qué hacer | Qué debería pasar |
|---|---|---|
| 1 | Abre la portada en el teléfono | En menos de 10 s entiendes que es para salir esta noche. Buscador arriba, bloque del Dieciocho, eventos reales. Sin scroll horizontal. |
| 2 | Busca «Valparaíso» | Resultados de eventos y lugares, no una página vacía. |
| 3 | Busca «Subida Ecuador» | Encuentra la zona y los locales de esa subida. |
| 4 | Filtra «Esta noche» | Sólo lo de hoy. Si hoy hay poco, lo dice; no inventa. |
| 5 | Abre un evento | Flyer o cartel, fecha, hora, lugar, precio y **fuente original** en una pantalla. |
| 6 | Mira el cartel | Si es un flyer oficial, viene del sitio del local, del municipio o de la ticketera. Si es generado, se ve gráfico, nunca una foto falsa. |
| 7 | Abre la fuente original | Te lleva a la publicación real del organizador. |
| 8 | Abre un lugar | Tipo de local, zona, dirección, qué hay hoy, próximas fechas, última revisión. |
| 9 | Toca Instagram en una tarjeta de lugar | Abre la cuenta oficial **a un toque**, sin pasar por otra pantalla. |
| 10 | Toca «Cómo llegar» | Abre direcciones hacia la coordenada verificada. |
| 11 | Cambia Lista ↔ Mapa | **No pierdes** la comuna, el segmento ni la búsqueda. |
| 12 | Abre el Dieciocho | Cuántas fechas, cuántas comunas, carril de comunas y fondas reales. |
| 13 | Manda un aporte en «Aportar» | Entra a una cola privada; **no se publica solo**. |
| 14 | Revisa el rendimiento | Lighthouse móvil ≥ 95 en las cuatro categorías. |

## Qué mirar con ojo crítico

- **¿Hay demasiados carteles generados seguidos?** Si en la primera pantalla
  ves tres o cuatro iguales, dilo: el sistema debería variar por tipo, comuna
  y título.
- **¿Algún dato se ve inventado?** Un precio exacto sin fuente, un horario
  demasiado redondo, una dirección sospechosa. Repórtalo con el enlace.
- **¿Algún local cerrado sigue publicado?** Es el fallo más caro del producto.
- **¿Entiendes el sistema sin preguntarle a David?** Si no, el que falla es
  `CARLOS_HANDOFF.md`, no tú.

## Revisión técnica

```bash
git clone https://github.com/Neuroxel/carreteando && cd carreteando
npm install && npm test && npm run lint && npx tsc --noEmit && npm run build
```

Deberías ver **80 pruebas en verde** y ningún error de tipos ni de lint.

Después lee, en este orden: `CURRENT_STATE.md`, `CARLOS_HANDOFF.md` §2 (mapa del
repositorio) y `PRODUCT_BACKLOG.md`.

## Cómo reportar

Abre un *issue* en `Neuroxel/carreteando` con: qué hiciste, qué esperabas, qué
pasó, y el teléfono/ancho si es visual. Si es un dato equivocado, incluye el
enlace a la fuente correcta.
