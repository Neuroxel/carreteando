# Mapa sobre la barra inferior (móvil): causa y arreglo

**Reporte de Carlos:** en el teléfono, el mapa tapaba el menú inferior.

## Causa

- `.bottom-nav` es `position: fixed; z-index: 40`.
- Leaflet pone índices propios a sus capas: 400 a los paneles (teselas y marcadores), 700 a los popups y 1000 a los controles.
- `.mapa-lienzo` no creaba un contexto de apilamiento. Por eso esos índices competían directo con la barra en el contexto raíz, y cualquier capa del mapa que pasara por debajo de la barra se pintaba encima de ella.
- El toque seguía llegando a la barra, porque el problema era de pintado: se veía tapada, pero los botones funcionaban.
- Además, `body` reservaba `4.25rem` fijos y no sumaba la franja del sistema.

## Arreglo

En `app/globals.css`, solo dos reglas:

```css
.mapa-lienzo { position: relative; z-index: 0; isolation: isolate; height: min(72dvh, 620px); }
@media (max-width: 767px) { body { padding-bottom: calc(4.25rem + env(safe-area-inset-bottom)); } }
```

- Todo Leaflet queda encerrado en su propio contexto, por debajo de la barra.
- No se tocó ningún `z-index` interno de Leaflet ni se agregó un margen gigante.
- `72dvh` en vez de `72vh`: en Android y iOS la altura no cuenta la barra del navegador que aparece y desaparece. Se mantiene `vh` como respaldo.
- `env(safe-area-inset-bottom)` vale 0 mientras la página no pida `viewport-fit=cover`, y hoy no lo pide. La regla queda correcta para el día en que se active.
- No se agregó `viewport-fit=cover`: haría que todo el sitio se dibujara bajo la muesca, y eso es un cambio visual aparte.

## Prueba (dondesalgo3d, 7cd7c32)

| Ancho | Barra arriba del mapa | Barra pegada al borde inferior |
|---|---|---|
| 360 | sí (`despues-360-barra.png`) | top 698, bottom 760 = alto del viewport |
| 375 | sí (`despues-375-barra.png`) | 750 / 812 |
| 390 | sí (`despues-390.jpg`) | 782 / 844 |
| 412 | sí (`despues-412-barra.png`) | 853 / 915 |
| 430 | sí | 870 / 932 |
| 768 | barra inferior oculta por diseño; mapa de 620 px (`despues-768.jpg`) | — |

Antes: `antes-390-dondesalgo3d.jpg`, donde los números de los grupos ("3", "35") y un marcador se pintan sobre la barra.

**Interacción:**

- Funcionan zoom (+/−), clic en grupo (acerca) y popup de un lugar (`despues-390-popup.jpg`, completo entre y=244 y 464, sobre la barra en y=782).
- La atribución queda visible arriba de la barra.
- Inicio → Mapa → Inicio funciona, igual que atrás y adelante.

**Solicitudes:**

- El cambio a mapa dentro de la página no pide nada al servidor salvo las teselas.
- Los enlaces de la barra inferior son navegación de página (`/?vista=mapa` → `/`) y piden el payload RSC de Next: es el comportamiento que ya existía y este arreglo no lo cambia.

**No se pudo probar:**

- Un teléfono físico Android con barra de gestos, ni un iPhone real. El emulador del panel no simula la franja del sistema.
- Se cubre por diseño: sin `viewport-fit=cover`, el navegador deja la página por encima de esa franja, y la barra fija queda al borde del área visible.

**Ramas:**

- `fix/mobile-map-nav` (sale de main) y su cherry-pick en `experiment/dondesalgo-3d` (dondesalgo3d).
- **No está fusionado en main**: es un cambio de producción y espera tu autorización.
