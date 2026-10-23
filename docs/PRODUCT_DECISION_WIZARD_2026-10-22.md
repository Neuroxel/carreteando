# Dónde Salgo — decisión de producto: wizard de bienvenida

Fecha: 23-oct-2026  
Base funcional actual: `main@edd1268` (PR #26–#28 integrados)  
Estado: especificación canónica corregida tras feedback directo de Carlos.

## Decisión de rama

**NO revertir #26–#28 completos.**

La implementación actual contiene infraestructura útil que debe conservarse:

- `lib/intenciones.ts`;
- clasificación de comedia;
- ranking determinista;
- shortlist/recomendaciones;
- precio visible y semántica de precio;
- `Filtros (N)`;
- espaciado de badges de comuna;
- tests de intenciones;
- fix de overflow horizontal;
- métricas del asistente.

El error fue de **presentación**, no de arquitectura de datos.

El asistente fue incrustado dentro de la home, generando repetición visual con:
- selector de comuna de la home;
- pregunta `¿Dónde?` del asistente;
- filtros normales;
- buscador.

Carlos aclaró que quería un **wizard de bienvenida**, separado de la página.

## Norte del producto

La experiencia correcta es:

1. entrar a Dónde Salgo;
2. ver una bienvenida limpia, con sólo el fondo/identidad;
3. responder una pregunta central;
4. esa pregunta desaparece;
5. aparece la siguiente;
6. al terminar, se entra a la home/cartelera normal de siempre con los filtros ya aplicados.

La home NO debe contener el wizard embebido.

## Wizard V1

### Cuándo aparece

Mostrar sólo en una entrada limpia a la portada:
- pathname `/`;
- sin filtros/plan/query que ya expresen una intención;
- cuando no se haya completado/omitido ya en la sesión actual.

Usar `sessionStorage` o equivalente client-only para evitar mostrarlo una y otra vez dentro de la misma sesión.

NO usar una cuenta.
NO guardar coordenadas.
NO persistir preferencias personales a largo plazo.

Si el usuario llega desde:
- URL compartida con filtros;
- detalle de evento;
- resultado ya filtrado;

no interrumpir con la bienvenida.

### Reabrir

En la home normal debe existir un CTA discreto:

**Ayúdame a elegir**

que permita abrir el wizard voluntariamente.

No volver a incrustar todas sus preguntas dentro de la home.

## Presentación visual

Pantalla completa / overlay de bienvenida.

Usar el mismo fondo visual de Dónde Salgo.

No mostrar simultáneamente:
- buscador;
- chips de comuna;
- cartelera;
- filtros;
- shortlist;
- selector Lista/Mapa.

Sólo:
- marca;
- progreso mínimo;
- pregunta;
- opciones;
- botón `Saltar / Ver todo`.

Transición breve entre pasos.
Respetar `prefers-reduced-motion`.

No hacer un modal pequeño sobre la home: debe sentirse como una pantalla de entrada.

## Secuencia

### Paso 1 — ¿Qué quieres hacer?

Opciones canónicas ya implementadas:

- Bailar
- Tomar algo
- Música en vivo
- Karaoke
- Comedia
- Algo tranqui
- Sorpréndeme

Si una intención no tiene soporte suficiente, ocultarla.

Al elegir:
- guardar selección temporalmente;
- animar salida de la pregunta;
- pasar al siguiente paso.

### Paso 2 — ¿Dónde?

Opciones:

- Cerca de mí
- Toda la región
- Valparaíso
- Viña del Mar
- Quilpué
- Villa Alemana
- Concón
- otras comunas con oferta real.

`Cerca de mí` reutiliza el GPS canónico de Radar.

Reglas:
- client-only;
- no lat/lng al backend;
- precisión >500 m no afirma barrio;
- comuna manual manda sobre GPS.

### Paso 3 — ¿Cuándo?

Mantener este paso, pero hacerlo rápido.

Opciones:
- Esta noche
- Mañana
- Este finde
- Más adelante

`Esta noche` puede ir preseleccionado visualmente como default, pero no ejecutar hasta que la persona confirme o use `Saltar`.

Entre 00:00–04:59 conserva la fecha nocturna canónica hasta las 05:00.

### Final

Al terminar:

1. cerrar completamente el wizard;
2. marcarlo como visto/completado en la sesión;
3. ir a la home normal;
4. aplicar filtros resultantes;
5. scroll a cartelera/recomendaciones;
6. URL final reproducible.

Ejemplos:

`/?plan=bailar&fecha=hoy&ciudad=Quilpué`

`/?plan=tomar-algo&fecha=finde&cerca=1`

La home que aparece después es la UI normal, no una home con el wizard todavía visible.

## Saltar

En TODOS los pasos:

**Ver todos / Saltar**

Debe:
- cerrar bienvenida;
- marcarla como vista en la sesión;
- entrar a home limpia;
- no aplicar filtros inventados.

Escape, gesto atrás y accesibilidad deben tener comportamiento claro.

## Back / navegación

No crear tres entradas de history por las tres preguntas.

Los pasos son estado UI local.

Al finalizar:
- escribir una sola URL final;
- navegar al estado filtrado.

Si el usuario pulsa Back desde la home filtrada, no debe recorrer artificialmente tres pantallas del wizard.

## Qué conservar de #26–#28

### Conservar completamente

- intenciones;
- comedia;
- ranking/recomendar;
- semántica de precios;
- badge de precio;
- `Filtros (N)`;
- badge comuna con separación;
- búsqueda/intention suggestion cuando sea útil;
- tests semánticos;
- overflow fixes;
- URL final de filtros;
- GPS y Radar anteriores.

### Mover fuera de la home

- bloque `¿Qué quieres hacer?`;
- bloque `¿Cuándo?`;
- bloque `¿Dónde?`;
- shortlist `Te recomendamos` generada automáticamente por tener el asistente visible.

La shortlist puede aparecer DESPUÉS de completar el wizard como sección inicial de resultados, pero sólo como consecuencia del flujo de bienvenida.

Si el usuario entra normalmente a la home después de haber omitido/completado el wizard, la página no debe volver a parecer el screenshot rechazado por Carlos.

## Home normal después del wizard

Debe parecer esencialmente a la versión aprobada tras #23/#24:

- buscador;
- selección territorial;
- fecha;
- Lista | Mapa;
- CTA mapa/cerca;
- filtros;
- Carretes;
- Lugares.

Mantener mejoras válidas:
- precio más visible;
- `Filtros (N)`;
- badges separados;
- Radar corregido;
- home reset;
- territorios;
- madrugada.

## Shortlist

La infraestructura de shortlist se conserva.

Después de completar el wizard:
- puede mostrarse `Te recomendamos`;
- 3–6 resultados;
- luego `Ver todas las N opciones`.

Si el usuario saltó el wizard:
- no forzar shortlist personalizada;
- mostrar cartelera normal.

Razones permitidas:
- distancia;
- hora;
- precio;
- comuna/zona;
- gratis;
- ya empezó;
- fuente oficial.

No inventar popularidad/ambiente/seguridad.

## Precio

Conservar #26/#27:

- precio visible en card;
- `Gratis`;
- `Gratis con condiciones`;
- `Desde $X` sólo si comprable;
- `Agotado`;
- `Precio por confirmar`.

No revertir.

## Métricas

Conservar migración:
`20261023090000_metrics_asistente.sql`

Work/Supabase debe aplicarla cuando corresponda.

Métricas útiles:
- wizard_started
- wizard_completed
- wizard_skipped
- intent_selected
- location_mode
- date_selected
- view_all
- map_open

No coordenadas.

## QA obligatorio

### Welcome

360 / 375 / 390 / 430 / desktop.

Verificar:
- sólo una pregunta a la vez;
- no se ve home detrás/abajo;
- no overflow;
- opciones completas;
- foco de teclado;
- lectura accesible;
- escape/saltar;
- reduced motion.

### Flujo

- Qué → Dónde → Cuándo → home filtrada.
- Saltar en paso 1.
- Saltar en paso 2.
- Saltar en paso 3.
- Cerca de mí con prompt/granted/denied.
- comuna manual.
- reload de URL final.
- back/forward.
- home logo.
- reabrir con `Ayúdame a elegir`.

### No repetición

Después de completar:
- navegar a Lugares;
- Radar;
- evento;
- volver home;

el wizard no reaparece en la misma sesión sin acción explícita.

Nueva sesión limpia:
- bienvenida vuelve a estar disponible.

## PR recomendado

Crear PR nuevo desde el main actual `edd1268`.

NO resetear main a `be0d050`.
NO revertir #27/#28.
NO cherry-pick parcial desde una rama vieja.

El PR debe ser principalmente:
- extracción/recomposición del UI del asistente;
- estado de bienvenida;
- session gating;
- transición a filtros normales.

Evitar tocar ingestión/DB.

## División

### Claude
Implementación del wizard de bienvenida y regresión.

### Antigravity
QA adversarial de:
- first impression;
- claridad de cada paso;
- abandono/saltar;
- transición a home;
- semántica de resultados.

### Gemini
Sólo microcopy/benchmark:
- comparar `¿Qué quieres hacer?` vs alternativas;
- no cambiar arquitectura.

### Work/Supabase
Aplicar migración de métricas; no participa en el layout.

## Criterio PASS

- la home ya no contiene preguntas duplicadas;
- wizard es una bienvenida separada;
- una pregunta por pantalla;
- final desemboca en home normal filtrada;
- saltar siempre disponible;
- no reaparece durante la sesión;
- se puede reabrir voluntariamente;
- #26–#28 mantienen sus mejoras válidas;
- 259 tests existentes no disminuyen;
- CI verde;
- Vercel verde;
- móvil físico pendiente se mantiene explícito.
