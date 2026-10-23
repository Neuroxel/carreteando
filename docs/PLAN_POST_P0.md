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

---

# Brief complementario · feedback de Carlos (23-oct-2026)

Solo planificación. La implementación grande empieza después del cierre del P0. Lo que sigue amplía las secciones 2 y 3 sin duplicar el código existente: se reutilizan `FiltrosEvento`, `fechaDeLaNoche` y `lib/metrics.ts`.

## A · Selector de fecha táctil (amplía §2)

**Atajos y selector**
- Atajos de un toque: **Hoy · Mañana · Fin de semana**. Ya existen como `fecha` (`hoy`, `manana`, `finde`) y se reutilizan.
- Calendario táctil para un día o un rango Desde/Hasta: primer toque en Desde, segundo en Hasta, y un toque repetido en el mismo día lo deja como día único.
- **Nunca abre el teclado**, así que no se usa `<input type="date">` con teclado. Accesible con lector de pantalla y foco visible.

**Criterios**
- Fechas pasadas deshabilitadas, contando desde la noche actual.
- Atajo y rango son mutuamente excluyentes: elegir uno limpia el otro.
- Todo queda reflejado en la URL.
- El rango que se muestra se rotula en lenguaje de noche, por ejemplo "Vie 24 → Sáb 25 (hasta las 05:00)".

## B · Jerarquía de filtros (amplía §3)

- **Siempre visibles:** fecha, categoría y comuna.
- **Secundarios**, bajo un botón **"Más filtros"** rotulado con un contador de los activos: precio, escena, zona, plan y cerca. No se esconden en un menú hamburguesa.
- **Criterio:** con filtros secundarios activos se muestran como chips removibles sobre los resultados.

## C · El wizard aplica la fecha a los resultados

**Brecha a verificar**
- Hay que confirmar que la fecha elegida en el wizard llega a los resultados.
- `intent_selected` está declarado en `lib/metrics.ts`, pero hoy no lo emite ningún componente.

**Criterios**
- Al terminar el wizard, la vista de resultados abre con la misma fecha (o rango), categoría y comuna, reflejadas en la URL.
- Atrás vuelve al wizard sin perder lo elegido.
- Test end-to-end de estado: wizard → resultados → atrás.
- La semántica de noche es la de §2. Un evento a las 00:30 del sábado aparece al elegir "viernes", rotulado como "madrugada del sábado".

## D · Validación con amigos antes de un rediseño global

**Protocolo:** 5 a 8 personas, en su propio teléfono, sin guía. Tareas concretas:
1. "Conciertos en Valparaíso entre el 7 y el 9 de noviembre."
2. "Algo gratis esta noche en Viña."
3. "¿A qué hora empieza [evento] y dónde compro?"

**Qué se mide por tarea:** acierto (sí/no), tiempo hasta el resultado y número de toques. Se anotan las dudas en voz alta. Se hace antes y después de A–C.

**Umbral para considerar un rediseño global:** acierto por debajo del 80 % o una mediana de más de 6 toques en una tarea. Si no se cruza, solo ajustes focalizados.

## E · SEO y analítica: auditar antes de agregar

**Lo que ya existe** (no duplicar):
- `app/sitemap.ts`, `app/robots.ts` y `app/opengraph-image.tsx`.
- `generateMetadata` en las fichas de evento, lugar y zona.
- `lib/metrics.ts`: métricas agregadas propias con envío diferido por lotes, que ya incluyen `zero_result_search`, `search`, `filter` y `source`.

**Auditoría previa**
- Revisar los datos estructurados (JSON-LD `Event`) de `/evento/[id]`.
- Revisar los canónicos con filtros en la URL. Las combinaciones de filtros no deben indexarse como páginas duplicadas.

**Métricas**
- Búsqueda sin resultados: ya existe, `zero_result_search`.
- Selección de fecha: una sola métrica nueva `date_selected`, sin la fecha concreta. Como mucho un bucket: `atajo`, `dia` o `rango`.
- Clic a la fuente: ya existe, `source`.
- **Reglas:** sin PII ni texto buscado, sin scripts de terceros nuevos y sin duplicar eventos que ya se cuentan.

## F · Orden y límites

**Promoción en Instagram comunitario:** solo cuando D muestre utilidad validada.

**Equidad**
- El ranking orgánico **no depende de pagar**. Un local no se penaliza por su capacidad de pago.
- Los destacados pagados, si existen, son **aditivos**: un espacio aparte, rotulado "Destacado", que no desplaza el orden orgánico.
- Criterio verificable: un test que confirme que el orden orgánico es idéntico con y sin `destacado`.

**Delegación:** el dueño autoriza a Claude y Nexo. Antigravity no se usa (sin saldo). La identidad de Nexo está por confirmar, y no se toca ningún proyecto ajeno.
