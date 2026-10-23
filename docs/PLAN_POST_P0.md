# Planificación posterior al P0 de cobertura

Origen: feedback que transmitió el dueño el 23-oct-2026 (registro de operación: `research/2026-10-23/data-operation/PRODUCT_FEEDBACK_2026-10-23.md`). Es **un** testimonio. No sirve como consenso de diseño ni como prueba de que los datos estén actualizados.

## Orden

1. Cerrar el P0 de cobertura: review, cron autenticado y salud de fuentes. Nada de lo que sigue empieza antes.
2. Filtro de rango de fechas combinado con categoría.
3. Revisión focalizada de carga visual, con evidencia de uso. **Sin rediseño general.**

## 2 · Rango Desde/Hasta + Conciertos + comuna

**Necesidad.** Una usuaria buscó conciertos para las fechas de un viaje y tuvo que recorrer octubre y noviembre.

**Alcance.**
- Agregar `desde` y `hasta` (`YYYY-MM-DD`, inclusivos) a `FiltrosEvento`, junto al `fecha` actual (`hoy`, `finde`, …).
- Si hay rango, manda sobre `fecha`.
- Se combina con `categoria` (`live` = "En vivo"; Conciertos y Música en vivo), `ciudad` y el resto de los filtros existentes.

**Semántica de noche (decidida).**
- El rango se compara contra `date_text`, que es la **fecha de la noche** (`fechaDeLaNoche`, corte a las 05:00 en Chile).
- Un show del sábado a la 01:00 pertenece a la noche del viernes. Por eso "hasta viernes" lo incluye y "desde sábado" no.
- Nunca se infiere una fecha desde el título. Un evento sin `date_text` estructurado no entra en un rango.
- "Desde" no puede ser anterior a la noche actual: lo vencido sigue oculto, igual que hoy.

**Criterios de aceptación.**
- Los resultados del intervalo aparecen directamente, sin paginar por meses.
- `desde == hasta` funciona como día único.
- Un rango invertido se corrige o se avisa; nunca deja una lista vacía en silencio.
- El rango y los filtros viven en la URL (`?desde=…&hasta=…&categoria=live&ciudad=…`). Atrás y adelante los restauran, y un enlace compartido abre lo mismo.
- Se filtra sobre el snapshot ya cargado (arquitectura actual), sin una consulta nueva a la DB por cada cambio.
- Tests con reloj fijo: noche que cruza medianoche, día único, rango invertido, rango + categoría + comuna, y estado restaurado desde la URL.
- El wizard y los filtros rápidos actuales no cambian de comportamiento.

**Fuera de alcance.** Calendario de varios meses, reservas, alertas por fechas.

## 3 · Carga visual (hipótesis, no requisito)

La misma persona encontró fácil buscar y organizar, pero sintió demasiada información visual.

**Hipótesis:**
- Priorizar fecha, artista, recinto y precio en los resultados.
- Divulgación progresiva del detalle.
- Menos actividad visual cuando la persona busca con intención, por ejemplo con un rango o filtros activos.

**Antes de tocar UI:**
- Validar con más usuarios y con un diseñador.
- Proponer cambios acotados y medibles.
