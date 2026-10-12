# Dónde Salgo 3D — revisión A/B

Edición experimental de la interfaz. **Solo cambia la GUI**: mismos datos, mismos
filtros, mismas rutas. La versión estable sigue siendo la referencia.

| | Estable (V1) | 3D (experimento) |
|---|---|---|
| URL | https://dondesalgo.vercel.app | https://dondesalgo3d.vercel.app |
| Rama | `main` | `experiment/dondesalgo-3d` |
| Proyecto Vercel | `carreteando` | `carreteando3d` |
| Indexación | sí | no (noindex, robots `Disallow: /`, sitemap vacío) |

## Cómo está hecho

- **Afiche estático primero.** `components/poster/PosterDecor.tsx` dibuja en SVG,
  en el servidor, el fondo del hero: trama (Z0), halo y nube de trama (Z1) y un
  túnel de "?" impresos y corridos de registro (Z2). Sin JavaScript ni WebGL el
  sitio se ve así y funciona completo.
- **Three.js como mejora progresiva.** `DepthScene.tsx` carga `scene.ts` con
  `import()` dinámico, solo cuando la página está quieta (`requestIdleCallback`),
  y solo si el perfil no es STATIC. Las mismas capas SVG se rasterizan a texturas
  y se ponen en planos a distinta profundidad. Sin React Three Fiber, sin sombras
  ni posproceso.
- **La interfaz nunca es canvas.** Búsqueda, filtros, tarjetas y navegación son
  DOM (Z3). El lienzo es `aria-hidden` y `pointer-events: none`. Las tarjetas solo
  llevan una sombra plana de impresión (Z4). El mapa Leaflet no cambia. Los flyers
  no se recolorean.
- **Paleta propia** (tinta índigo, papel rosado, coral impreso, ultramar), toda
  bajo `html[data-edicion="3d"]`. Sin `NEXT_PUBLIC_EXPERIMENT=1` el mismo código
  rinde la V1. Análisis de la referencia: `docs/brand/3D_REFERENCE_ANALYSIS.md`.

## Perfiles (`components/poster/profile.ts`)

| Perfil | Cuándo | Lienzo |
|---|---|---|
| STATIC | profundidad "Apagada", `prefers-reduced-motion`, `saveData`, sin WebGL, ≤2 GB o ≤2 núcleos | ninguno: afiche SVG |
| LITE | ≤4 GB, ≤4 núcleos o pantalla muy grande; o FULL que no rinde | DPR 1, máx. 0,8 MP |
| FULL | el resto | DPR ≤1,5, máx. 1,6 MP |

- **Autodegradación:** los primeros 45 cuadros se miden. Si la mediana del tiempo por
  cuadro supera **22 ms**, FULL pasa a LITE y se vuelve a medir. Si LITE supera
  **40 ms**, el lienzo se destruye y queda STATIC.
- **Render a pedido:** solo se dibuja cuando algo se movió. Se pausa con la pestaña
  oculta o con el hero fuera de pantalla. Si se pierde el contexto WebGL, se cierra
  y queda el SVG.
- **Desplazamiento máximo:** trama 3 px, halo 7 px, anillos del "?" 9–14 px y giro
  del grupo ≤1,2° (0,8° en LITE). La interfaz se mueve 0 px.
- **QA:** `?perfil=static|lite|full` fija el perfil para medir. Nunca salta las
  comprobaciones de movimiento reducido, ahorro de datos, falta de WebGL ni
  "Apagada". La URL normal es automática.
- **Control:** al pie, "Profundidad: Auto · Apagada" (se recuerda en este navegador).

## Movimiento y sensor

- **Escritorio:** puntero (solo mouse) más una profundidad muy leve con el scroll.
- **Teléfono:** `deviceorientation`, solo beta/gamma. Zona muerta de 1,5°, tope
  de ±18°, pasa-bajos, interpolación, y una postura neutra que se desliza
  lentamente (sostener el teléfono inclinado no deja el afiche corrido).
- **Permiso:** nunca se pide al cargar. Donde el navegador lo exige, aparece el botón
  "Activar profundidad" y el permiso se pide solo al tocarlo. Si se niega, se guarda
  y no se vuelve a preguntar.
- **Movimiento reducido:** sin paralaje de puntero ni de sensor, sin flotación, sin
  grano animado (perfil STATIC).
- **Sin prueba en teléfono físico.** Todo lo de arriba se verificó en emulación y
  en Chrome; falta que alguien lo mueva en la mano (iOS y Android).

## Mediciones (11-10-2026)

**JS inicial (home):**
- Estable: 125 kB.
- 3D: 128 kB (+3 kB).

**Three.js (diferido, solo FULL/LITE):** 2 chunks, 84 + 50 kB gzip = **134 kB gzip** (548 kB sin comprimir).

**Texturas:** generadas en el cliente (0 bytes descargados). Unos ~11 MB de GPU en FULL y ~5 MB en LITE para un hero de 943×396.

**CSS añadido:** 5,3 kB (1,9 kB gzip).

**PageSpeed Insights, móvil:**

| | Rend. | Acces. | Buenas pr. | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Estable | 99 | 100 | 100 | 100 | 2,0 s | 20 ms | 0 |
| 3D STATIC | 99 | 100 | 100 | 66* | 2,0 s | 20 ms | 0 |
| 3D LITE | 100 | 100 | 100 | 66* | 1,9 s | 30 ms | 0 |
| 3D FULL | 99 | 100 | 100 | 66* | 2,0 s | 40 ms | 0 |

\* El SEO baja **solo** por el noindex intencional ("se bloqueó la indexación").
Es lo pedido para el experimento; con indexación, la página es la misma que la estable.

La primera medición encontró dos problemas, ya corregidos (`aa17ba9`):
- un botón enfocable dentro de un contenedor `aria-hidden` (Accesibilidad 96);
- un salto de diseño de 0,037 al aparecer el botón del sensor.

**Paridad funcional:** el mismo guion corrió sobre las dos URLs en vivo:
Valpo → Hoy → ≤ $10.000 → Más barato → buscar → Lugares → Mapa → Lista → Atrás → Adelante.
Dio las mismas URLs, conteos y títulos en los 10 pasos, con **0 peticiones de datos/RSC** en ambas.

**Seguridad del experimento:**
- `/api/cron/*` responde **503**.
- `/admin` responde **404** y toda sesión de administración falla cerrada.
- No hay crons, ni claves privadas, ni Apify.
- "Publicar / Reportar / Proponer lugar" se reenvían a la API de producción.
- Las métricas del experimento no se mezclan con las de producción.

## Capturas (`docs/review-3d/`)

- `estable-390.jpg`, `3d-static-390.jpg`, `3d-auto-390.jpg` (con "Activar profundidad").
- `estable-1440.jpg`, `3d-auto-1440.jpg`, `3d-control-profundidad-1440.jpg`.
- `3d-full-webgl-hero-1440.jpg`: lienzo WebGL vivo (Chrome local, sin datos de cartelera).
- `3d-sin-webgl-1440.jpg`: WebGL deshabilitado; mismo afiche en SVG.

En reposo, el lienzo FULL calza píxel a píxel con el afiche SVG. Por eso las
capturas móviles se ven iguales en STATIC y en FULL; la diferencia es el movimiento.

## Pasada tras la prueba de Carlos (12-10-2026)

Carlos lo probó en su teléfono y no vio ningún efecto 3D: "debería parecer un
papel y no un sitio tan digital". Tenía razón. Esta sección reemplaza los
valores de movimiento descritos más arriba.

**Por qué no se veía nada:**

1. **Desplazamientos mínimos.**
   - Con 10° de inclinación, la zona muerta (1,5°) y la escala (18°) dejaban un factor de 0,47.
   - El "?" se movía ~6,6 px y el fondo ~1,4 px. En el teléfono, además, el decorado estaba al 70 % de opacidad.
2. **La postura neutra perseguía al teléfono.**
   - Se recentraba un 0,4 % por evento (~60 Hz), con una vida media de ~3 s.
   - Al sostener una inclinación, el afiche volvía solo al centro y únicamente se notaban sacudidas.
3. **Sin separación de profundidad.** Los anillos iban de 9 a 14 px, así que todo se movía casi junto.
4. **Sin señal de estado.**
   - Tras tocar "Activar profundidad", el botón desaparecía sin confirmar nada.
   - Una negativa de permiso guardada lo ocultaba para siempre.
   - Con "Reducir movimiento" o ahorro de datos el perfil era STATIC, sin aviso.
5. **Textura de papel invisible** (grano al 6–9 %).

**Qué cambió:**

| | Antes | Ahora |
|---|---|---|
| Zona muerta / escala | 1,5° / 18° | 0,8° / 12° |
| Recentrado | ~3 s, siempre | ~15 s y solo con el teléfono quieto |
| Papel tramado (Z0) | 3 px | **6 px**, con desplazamiento "líquido" (shader mínimo, solo mientras hay movimiento) |
| Nubes de tinta (Z1) | 7 px | **12 px** |
| Túnel de "?" (Z2) | 9–14 px | **13–19 px**, un plano por anillo |
| "?" focal en tres tintas (Z3) | (no existía) | **24 / 26 / 28 px**: índigo, coral y contorno papel, con fuera de registro creciente |
| Imprenta al frente (Z4) | (no existía) | **32 px**: marcas de registro, cinta, trama |
| Interfaz | 0 px | 0 px |
| Giro del conjunto | ≤1,2° | ≤1,5° |

- **Inercia "líquida":** cada capa tiene su propio resorte, y las del fondo llegan un poco tarde.
- **Render a pedido:** cuando todo se asienta, no se dibuja más.
- **Medición** con 10° de inclinación (simulada, a 390 px de ancho), del fondo al frente: 4,6 · 9,2 · 10–14,6 · 18,4 · 19,9 · 21,5 · 24,5 px.

**Papel (también en STATIC):**
- fibra y manchas de tinta en todo el fondo;
- motas, fibra y manchas sobre el hero;
- borde gastado del afiche (máscara);
- trama de semitono en una esquina;
- fuera de registro en logo y títulos;
- filetes impresos bajo cada sección;
- grano de papel en las tarjetas (nunca sobre el flyer).

Todo es procedural (SVG feTurbulence); no se usa ninguna imagen de LALA.

**Sensor:**
- **iOS:** "Activar profundidad" llama a `DeviceOrientationEvent.requestPermission()` dentro del mismo toque. Con la primera lectura real pasa a "Profundidad activa". Una negativa de una visita anterior ya no oculta el botón.
- **Android:** escucha sin pedir permiso y muestra "Profundidad activa" en cuanto llega la primera lectura.
- **Sin sensor o con permiso negado:** el decorado responde al puntero en escritorio y, muy levemente, al scroll.

**Perfiles:**
- STATIC solo con:
  - "Apagada";
  - movimiento reducido;
  - ahorro de datos;
  - o sin WebGL.
- Las señales de hardware ya no apagan la profundidad: solo eligen entre FULL y LITE.
- El tiempo por cuadro medido decide la degradación (22 ms → LITE, 40 ms → STATIC).

**QA:** `https://dondesalgo3d.vercel.app/?3ddebug=1` muestra perfil, sensor, permiso,
beta/gamma, fps y desplazamiento por capa, además de deslizadores para simular la
inclinación. En consola, `__ds3d.simular(beta, gamma)` hace lo mismo. Sin `?3ddebug=1`
no aparece nada de esto.

**Evidencia** (`docs/review-3d/v2-*`):
- `v2-static-390.jpg`;
- `v2-full-centro-390.png`, `v2-full-izquierda-390.png` y `v2-full-derecha-390.png` (±10°);
- `v2-debug-390.jpg`.

El camino real del sensor se probó con eventos `deviceorientation` sintéticos: el estado
pasa a "activo", aparece el aviso, y una inclinación sostenida de 10° sigue aplicada
tras 120 eventos. **No se probó en un teléfono físico.**

**Rendimiento** (PageSpeed móvil, en vivo, `613dacf`):

| Perfil | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| FULL | 99 | 100 | 100 | 66* | 2,0 s | 20 ms | 0 |
| LITE | 99 | 100 | 100 | 66* | 2,0 s | 30 ms | 0 |
| STATIC (`da6c3ba`) | 97 | 100 | 100 | 66* | 2,0 s | 30 ms | 0 |

\* Por el noindex intencional.

- La primera versión con papel medía 82: filtros SVG sobre capas completas y la escena compitiendo con el flyer del LCP.
- Correcciones:
  - sin filtros en las capas grandes;
  - se cede el hilo entre planos;
  - la escena se arma 3 s después de `load`; hasta entonces se ve el afiche estático, idéntico en reposo.
- Three.js sigue en 134 kB gzip, diferido.
- La carga inicial de la home pasa de 128 a 129 kB.

## Fondo de escritorio: mosaico corregido (12-10-2026)

**Causa.**
- La textura de página (`--tx-manchas`) era un tile de 600 × 600 px, con la repetición por defecto del navegador.
- La fibra era un tile de 240 × 240 px y el hero repetía tiles de 300, 240 y 600 px.
- En 1440 y 1920 las manchas grandes caían en una grilla regular: se veía dónde "empieza de nuevo el mismo cuadrado" (`review-3d/v3-antes-1440-mosaico.jpg`).

**Regla aplicada:** la micro-textura puede repetirse; la macro-textura nunca. Cada capa declara `background-repeat` de forma explícita.

**Micro (se repite, no se nota).**
- `fibra.webp` y `grano-papel.webp` son tiles de 256 px que se muestran a 128 CSS px.
- Son ruido filtrado en frecuencia (FFT): periódicos por construcción, sin costura.
- Todo el detalle mide 1–4 px y es isótropo, sin rasgos de mayor escala que el ojo pueda agrupar. Por eso la repetición no se percibe.

**Macro (no se repite).**
- Página:
  - siete degradados radiales grandes, en `vw`/`vh`, que dan el ritmo tonal de arriba a abajo;
  - tres parches de tinta únicos (`tinta-a/b/c.webp`, 256 px, semillas distintas, caída radial) en tamaños y posiciones irregulares, con `no-repeat`.
- Hero: una sola textura de manchas y motas (`hero.webp`, 768 px) en `cover` y `no-repeat`.
- El borde gastado del hero es una máscara (`borde.webp`).

**Rendimiento.**
- La primera versión del arreglo usaba filtros SVG `feTurbulence` en data URI. El navegador los rasterizaba en el hilo principal: PageSpeed móvil 68, TBT 2.790 ms.
- Ahora son WebP generados una vez por `tools/texturas.py` (192 kB en total, no bloquean).

| URL (móvil / escritorio) | Rendimiento | TBT | LCP | Accesibilidad | Recomendaciones |
|---|---|---|---|---|---|
| AUTO, filtros SVG (b966cc2) | 68 / — | 2.790 ms | 2,0 s | 100 | 100 |
| AUTO, WebP (8ad6506) | 92 / 94 | 170 / 200 ms | 2,0 / 0,7 s | 100 | 100 |
| STATIC, WebP (3b1b313) | 98 / 98 | 30 / 110 ms | 2,3 / 0,6 s | 100 | 100 |

El SEO de 66 en dondesalgo3d se debe al `noindex` deliberado del experimento; producción no lo lleva.

**Fila impar.** Desde 641 px, el último evento de una cantidad impar ocupa las dos columnas en formato horizontal (flyer + ficha). El flyer no se altera. Antes: `v4-webp-1920-impar-antes.jpg`; después: `v4-webp-1440-impar-despues.jpg`.

**Capturas.**
- Después del arreglo: `v3-despues-{390,1440,1920}-*.jpg`.
- Versión WebP final: `v4-webp-{375,1440,1920}-*.jpg`.

### Cómo probarlo (Carlos)

1. Abre https://dondesalgo3d.vercel.app en el teléfono, en Safari (iPhone) o Chrome (Android).
2. **iPhone:** toca **Activar profundidad** (arriba a la derecha del hero) y acepta "Movimiento y orientación". **Android:** no hace falta tocar nada.
3. Arriba debe aparecer **"Profundidad activa"**.
4. Inclina el teléfono unos 10° a la izquierda, a la derecha, hacia adelante y hacia atrás:
   - el "?" grande y las marcas del borde se mueven más;
   - el túnel de "?" se mueve menos;
   - la trama del fondo se mueve muy poco y con un leve retraso;
   - el texto, la búsqueda y los botones **no** se mueven.
5. **Si no aparece el botón ni el aviso**, revisa que no esté activado *Ajustes → Accesibilidad → Movimiento → Reducir movimiento*. Con esa opción el sitio respeta la preferencia y queda estático.
6. **En el computador:** abre https://dondesalgo3d.vercel.app a pantalla completa y recorre la página de arriba a abajo. El fondo no debe mostrar ningún cuadrado que se repita.
7. **Si algo no responde**, abre https://dondesalgo3d.vercel.app/?3ddebug=1 y envía una captura del panel: muestra perfil, permiso y lecturas del sensor.

## Pasada de referencia de Carlos (12-10-2026)

### Sensor

**REFERENCE_SENSOR_METHOD** (calculadora-3d-game.vercel.app, bundle `assets/index-*.js`, leído directamente):
- Escucha **ambos** eventos en `window`, en modo pasivo.
- `devicemotion` → `e.acceleration || e.accelerationIncludingGravity`, x/10 e y/10. Tiene prioridad: en cuanto llega una muestra de movimiento, se ignora la orientación.
- `deviceorientation` → gamma/45 y (beta−45)/45, solo si nunca llegó una muestra de movimiento.
- En iOS pide `DeviceMotionEvent.requestPermission()` (o la de orientación) dentro de un toque. En Android empieza a escuchar sin pedir nada.
- La física usa el *cambio* entre lecturas como impulso angular del objeto.

**DÓNDE_SALGO_SENSOR_METHOD** (`components/poster/sensor.ts`):
- Un adaptador con fuente explícita: `ORIENTATION`, `MOTION_ACCELEROMETER`, `POINTER`, `DEBUG_SIMULATION` o `NONE`.
- Escucha los dos eventos desde el principio, igual que la referencia.
- Del movimiento usa `accelerationIncludingGravity`, el vector de gravedad. No usa `acceleration`, que solo cambia al sacudir: aquí la inclinación **sostenida** debe mantener la escena corrida.
- Inclinación derivada: beta = atan2(y, z) y gamma = atan2(−x, √(y² + z²)), con filtro de paso bajo. El signo invertido de iOS se detecta en la primera lectura.
- Gana la primera fuente que entrega números. Si ambas los entregan, se prefiere la orientación. Si la orientación se corta, el acelerómetro toma el control solo.
- Si en 1,5 s no llega ninguna muestra numérica, el estado pasa a `sin-datos` y reaparece **Activar profundidad**. En iOS el botón pide movimiento y orientación dentro del mismo toque.
- Calibración: el cero es el promedio de las primeras 5 muestras y ya no hay recentrado automático. **Recalibrar** (panel de depuración, o tocar "Profundidad activa") fija un cero nuevo.

**WHY CURRENT IMPLEMENTATION FAILED:**
- La escena escuchaba solo `deviceorientation` y descartaba en silencio todo evento con beta/gamma nulos.
- En Android, Chrome calcula esa orientación con el giroscopio. Sin ese sensor (o sin fusión disponible), entrega eventos con valores nulos. Por eso el panel de Carlos mostraba beta = — y gamma = —, mientras el panel decía "sensor disponible" y "permiso concedido": hablaba de la API, no de datos.
- `devicemotion` → `accelerationIncludingGravity` solo necesita el acelerómetro. Es lo que hace funcionar la calculadora en el mismo teléfono.
- No pude reproducirlo en un teléfono físico. El panel nuevo cuenta los eventos nulos, así que el video de Carlos lo confirmará (o lo refutará).

**Pruebas:** `tests/sensor.test.ts` cubre:
- Android sin giroscopio: orientación nula y acelerómetro válido toma el control;
- 10° sostenidos siguen desplazados después de 200 muestras;
- izquierda y derecha con signos opuestos;
- la recalibración;
- la preferencia por la orientación;
- la simulación nunca se informa como sensor real.

### Arte (maqueta de Carlos como referencia principal)

> La imagen de la maqueta no llegó adjunta en este pase. Se trabajó con su descripción escrita, que enumera lo que funciona en ella. Hay que compararla con la maqueta real antes de cerrar.

- **"?" gigante 3D: eliminado.** El "?" queda como puntuación del logo, plano y serigrafiado, en coral.
- **Logo** apilado "DÓNDE / SALGO?" (`LogoApilado`):
  - mismos trazos vectoriales, nombre accesible;
  - tinta crema con poros escasos, densidad desigual y borde comido (un filtro SVG chico, solo sobre el logo);
  - fuera de registro en violeta.
- **Tipos:**
  - Anton (OFL) para títulos de cartel, con máscara de poros;
  - Special Elite (Apache 2.0) para lo secundario: bajada, fechas, rubros, comunas;
  - el texto de lectura sigue en Arial y los títulos de evento en Georgia.
- **Papel**, con el mayor peso en el hero:
  - fibras blancas sueltas (`fibras.webp`, 384 px);
  - motas de fotocopia (`motas-*.webp`, 269 px, tamaño coprimo);
  - fibra fina y manchas.
  - En la página van las mismas fibras, más suaves.
  - Las fichas de evento son papel crema con grano y motas oscuras.
  - Los flyers no se tocan.

### Ciudad en capas (`components/poster/ciudad.ts`, vector original generado con semilla fija)

| Capa | Contenido | Desplazamiento máx. |
|---|---|---|
| Z0 | trama de semitono, luna en semitono (deriva "líquida" leve) | 4 px |
| Z1 | cerros lejanos, luces, torres bajas de la costa | 8 px |
| Z2 | cerro con casas apiladas, ascensor, iglesia | 17 px |
| Z3 | edificios cercanos **traslúcidos**: tinta plana al 13 % + semitono, ventanas **caladas** (evenodd) por donde se ve la ciudad de atrás | 30 px |
| Z4 | cables (catenarias), aves, poste, marcas de registro, cinta | 42 px |
| Interfaz | — | 0 px |

- Con 10° de inclinación se llega al máximo; la diferencia entre Z4 y Z1 es de 34 px.
- Todo el arte vive en `ciudadRegional()`. Para tener una ciudad por comuna (Valparaíso, Viña, Reñaca) bastaría con una función por comuna; en este pase no se construyó.

### Lugares: riel horizontal

- Selector de comunas ordenado por cantidad de lugares.
- Una sola fila (`overflow-x` + `scroll-snap`): swipe nativo en el teléfono; trackpad y flechas discretas en escritorio.
- No intercepta la rueda vertical.
- Muestra hasta 12 tarjetas y, al final, "Ver los N lugares de …".
- Con el sensor o el puntero activos, solo la sombra impresa detrás de cada tarjeta se corre (5 px como máximo). El texto y el área de toque no se mueven.
- **Los eventos siguen en el flujo vertical normal**, sin scroll interno.

### Rendimiento

| Prueba (PageSpeed, móvil / escritorio) | Rendimiento | TBT |
|---|---|---|
| 2b72a4a (primera versión, escena en WebGL por software) | 62 / 100 | 8.420 / 30 ms |
| d829674 (WebGL por software → STATIC; rescate temprano de la calibración) | 95 / 100 | 0 / 20 ms |

- Lighthouse dibuja WebGL por software (SwiftShader): ~250 ms por cuadro con los planos de ciudad a tamaño completo. Un equipo sin GPU ahora recibe el afiche estático. Con GPU, la escena sigue montándose en FULL (verificado en el navegador del panel).
- Sobre el 95 de PageSpeed: ahí la escena no corre. Mide la carga y el afiche estático, no el WebGL en un teléfono real.
- Accesibilidad 100 y Recomendaciones 100.

### Capturas (`docs/review-3d/v5-*`)

| Archivo | Qué muestra |
|---|---|
| `v5-390-static.jpg` | 390 px, sin movimiento |
| `v5-390-inclinado-izquierda.png` | 390 px, inclinación simulada −12° |
| `v5-390-inclinado-derecha.png` | 390 px, inclinación simulada +12° |
| `v5-390-debug-simulado.jpg` | panel: INPUT SOURCE: SIMULATED, sin muestras reales |
| `v5-768-static.jpg` | 768 px |
| `v5-1440-static.jpg` | 1440 px |
| `v5-1440-riel-lugares.jpg` | riel de lugares en escritorio |

No hay captura con sensor real: no había un teléfono físico disponible. Esa es la prueba que falta, y le toca a Carlos.

### Cómo probarlo (Carlos, en el teléfono)

1. Abre https://dondesalgo3d.vercel.app/?3ddebug=1 en Chrome (Android) o Safari (iPhone).
2. **iPhone:** toca **Activar profundidad** y acepta "Movimiento y orientación". **Android:** espera unos 4 segundos. Si aparece el botón, tócalo.
3. En el panel, **INPUT SOURCE** debe decir **REAL ACCELEROMETER** o **REAL ORIENTATION**, con muestras > 0/s, y "crudo x/y/z" o beta/gamma cambiando al mover el teléfono.
4. Inclina unos 10° a cada lado **y mantén**. Los cables y edificios cercanos se corren más que los cerros, y la escena se queda corrida mientras sostienes la inclinación.
5. **Recalibrar** fija la postura actual como el cero.
6. Graba un video corto con el panel visible y mándalo.
7. Después abre https://dondesalgo3d.vercel.app sin el panel y baja hasta **Lugares para salir**: cambia de comuna y desliza el riel.

## Preguntas para Carlos

1. ¿Ahora el movimiento del celular se nota?
2. ¿Se siente parecido al mecanismo de tu calculadora?
3. ¿La profundidad aporta sin molestar?
4. ¿La textura ahora parece papel/impresión real?
5. ¿Te convence más el logo sin el gran ? tridimensional?
6. ¿Te gusta el fondo de ciudad por capas?
7. ¿Te gusta el carrusel horizontal de lugares?
