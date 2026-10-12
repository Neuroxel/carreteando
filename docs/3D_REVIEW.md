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
6. **Si algo no responde**, abre https://dondesalgo3d.vercel.app/?3ddebug=1 y envía una captura del panel: muestra perfil, permiso y lecturas del sensor.

## Preguntas para Carlos

1. ¿Mantiene la simpleza?
2. ¿Se entiende igual de rápido?
3. ¿Tiene más personalidad?
4. ¿Se siente más under/culto?
5. ¿El efecto 3D aporta o distrae?
6. ¿Mover el teléfono se siente elegante o gimmicky?
7. ¿Los flyers siguen siendo protagonistas?
8. ¿Algún texto se volvió más difícil de leer?
9. ¿Lo dejarías activado normalmente?
10. ¿Prefieres esta versión o la V1 plana?
