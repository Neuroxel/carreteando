# Carretes · Boliches · Radar

Cambios funcionales pedidos por Carlos sobre el diseño que aprobó. El diseño no cambia.

## Navegación

| Antes | Ahora | Qué hace |
|---|---|---|
| Inicio | **Carretes** | Lista de eventos de **hoy**. Vuelve arriba y nunca deja el mapa en pantalla |
| Explorar | **Boliches** | Todos los lugares, tengan o no evento hoy. Mantiene búsqueda, comuna, escena, el carrusel y "Cómo llegar" |
| Mapa | **Radar** | Mapa en modo "Carretes hoy", con un selector a "Boliches" |
| Aportar | Aportar | Sin cambios |

- Los mismos cuatro destinos están en la cabecera de escritorio.
- En la portada y en Explorar, la barra cambia el estado en el teléfono, sin pedir nada al servidor, y escribe la URL. Así atrás y adelante funcionan.
- Se mantiene la comuna elegida.

**Bug corregido:** desde el mapa, tocar Inicio subía la página pero dejaba el mapa. La causa: un `Link` a la misma ruta no reiniciaba el estado. Ahora cada destino fija vista, modo y fecha.

## Radar

- **Abre en "✦ Carretes hoy":** solo lugares con un evento confirmado para hoy. "Boliches" muestra todos.
- **Es independiente de las pestañas de fecha**, que se ocultan en el mapa. Respeta comuna, búsqueda, escena y precio.
- **Marcadores:**
  - Carrete hoy: estrella coral de serigrafía.
  - Boliche: punto apagado.
  - Un grupo de marcadores que contiene un carrete de hoy lleva la misma ✦.
  - La nota dice que ✦ es "un evento confirmado para hoy, no cuánta gente hay".

### Ubicación

- **Cuándo se pide:** nunca al cargar la página. Solo al tocar Radar en la barra, o el botón "Ver qué hay cerca de mí".
- **Un enlace directo al mapa** solo usa la ubicación si el permiso ya estaba concedido.
- **Una sola lectura de precisión gruesa:** `getCurrentPosition`, `enableHighAccuracy: false`, cache de 5 min. Sin seguimiento continuo.
- **Privacidad:** la posición queda en el teléfono. No se manda, no se guarda en el servidor y no se loguea. La distancia en línea recta se calcula localmente.
- **Si la persona dice que no:** el mapa funciona igual y se guarda en `localStorage` que no se vuelva a preguntar solo. Queda un botón "Volver a intentar".
- **Con ubicación:** aparece un punto crema y azul ("Tú") y la lista "Más cerca de ti", ordenada por distancia.

## Verificación

**Pruebas locales (build de producción, `next start`):**

| Tamaño | Resultado |
|---|---|
| 360 × 780 | La barra queda sobre el mapa (`elementFromPoint` dentro de la barra) y no hay desborde horizontal |
| 375 / 390 | Flujos completos |
| 430 × 900 | Boliches sin desborde ni pestañas de fecha |
| Escritorio 1024 | Cabecera con los cuatro destinos y el activo marcado |

**Flujos probados:**

| Flujo | Resultado |
|---|---|
| Carretes → Radar → Carretes | Vuelve a la lista de hoy (9 tarjetas, sin mapa, arriba) |
| Boliches → Radar → Boliches | Correcto |
| Atrás / adelante | Recorre los tres estados |
| Ubicación denegada | Una línea, sin insistir |
| Ubicación concedida (posición simulada en Plaza Sotomayor) | Punto "Tú" y lista por cercanía |

**Red:** cambiar de destino, de modo del Radar o de filtro no hace pedidos al servidor. Solo cargan teselas, imágenes de tarjetas y texturas.

**Calidad:** tests (164), lint, tipos y build en verde.
