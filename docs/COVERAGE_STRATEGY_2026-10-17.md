# Cobertura comprobable por local y fecha

Corte público 17/10/2026, snapshot generado 13:39:02 UTC: 104 eventos vigentes en la región, 18 para hoy, 11 en la comuna de Valparaíso. El catálogo contiene 67 locales de esa comuna. Esos 11 eventos usan diez nombres de recinto; no representan un censo ni prueban que los demás locales no tengan programación. Cinco fichas carecen de imagen; cinco no tienen precio numérico conocido, incluida una función agotada que no debe presentarse como entrada disponible pendiente de precio.

## Diagnóstico del recorrido actual

- La ingesta recorre URLs registradas. No existe descubrimiento automático en Google. IndexNow anuncia nuestras páginas a buscadores; no incorpora sus resultados.
- Instagram está pausado. El piloto guarda pistas privadas y extracción de texto; registrar cuentas no equivale a leer sus flyers ni publicar eventos.
- El cron configurado corre una vez al día, a las 18:00 UTC, y limita el número de fuentes. Los intervalos de prioridad del dispatcher no crean corridas adicionales.
- Las carteleras de intermediarios tienen límites de detalles/productoras. No haber encontrado algo en una ticketera no agota las fuentes de un local.
- Al reencontrar una ficha, el dispatcher puede completar el precio vacío de su misma URL; no repara una imagen ausente. El importador editorial es insert-only: editar después un flyer en el JSON no actualiza una fila existente.
- El benchmark de eventos baratos sólo comprueba las filas de su muestra. Que todas estén publicadas no demuestra cobertura de la ciudad. Hace falta una muestra independiente y un registro de locales realmente revisados.

## Corrección incluida

Portaldisc visita primero las fechas próximas, conserva su presupuesto de **24 solicitudes de detalle por fuente, incluidos reintentos**, y puede recuperar una ficha inaccesible mediante el alias oficial HTTPS sin `www`. Se conserva la URL original del evento. Los fallos ya no quedan silenciosos: `PRICE_NETWORK`, `PRICE_HTTP_*`, `PRICE_NOT_FOUND` y `PRICE_BUDGET` se resumen en el historial de la corrida y en las razones del candidato. Una agenda legible puede seguir siendo una corrida válida aunque falten precios; no se inventan datos ni se modifica la regla de publicación.

Esto no completa retrospectivamente las fichas existentes hasta ejecutar y verificar una nueva ingesta autorizada. Tampoco añade búsqueda automática ni lectura visual de Instagram.

## División de trabajo y evidencia

Codex conserva la integración, las fichas actuales, precios/afiches y verificación pública. Claude, Gemini y Antigravity reciben lotes disjuntos de locales y el mismo contrato de evidencia. Primera tanda: ocho locales por agente. El resto de los 67 está asignado en tandas pendientes; asignado no significa enviado, revisado ni verificado. Las entregas sin aprobar se guardan fuera del repositorio público y nunca se importan automáticamente.

Para esta misión las herramientas imprescindibles son búsqueda web, apertura de fuentes públicas y lectura visual cuando un flyer contiene el único dato. Tener instalado un conector no prueba acceso. Antes de aceptar un lote debe existir una búsqueda real y una fuente primaria abierta, o un bloqueo declarado. No hace falta conceder a los investigadores acceso administrativo a la base o al hosting.

## Bucle y cierre

1. Buscar por local y fecha en web, agenda oficial, Instagram indexado y ticketeras.
2. Abrir la fuente primaria y comprobar año, fecha, recinto/comuna y condiciones. Conservar URL, extracto, método y momento observado; usar null donde falte evidencia.
3. Cambiar de ruta ante un fallo concreto. Registrar consultas y bloqueos; la ausencia de resultados no significa ausencia de evento. Limitar los intentos de cada lote para no ejecutar un bucle infinito.
4. Codex deduplica por identidad y URL exacta, resuelve discrepancias y separa candidato, enriquecimiento y ficha ya pública.
5. Integrar sólo cambios aceptados mediante el flujo editorial con auditoría; leer después el snapshot y la ficha pública.
6. Repetir únicamente los pendientes, verificando que el cambio aceptado se vea realmente. Una respuesta del agente o una fila escrita no cierran la operación.

**Métricas separadas:** locales asignados/enviados/revisados/bloqueados; candidatos con fuente primaria; cambios aceptados/publicados/verificados; campos pendientes por motivo. Cierre de tanda: todos los locales contabilizados, cada hallazgo clasificado y cada cambio aceptado comprobado públicamente. Un bloqueo, límite de tiempo o presupuesto cierra el intento con pendientes explícitos, nunca con una declaración de cobertura completa.

No fijar una cuota de eventos basada en el número de locales: abierto no equivale a tener evento anunciado. Tampoco declarar saturación con una lista generada por los mismos agentes que la validan.

## Límites reales observados en la tanda del 17/10

Medido sobre el lote de Claude (ocho locales de Valparaíso, ventana 17–24 oct):

- **Buscar en la web no fue el descubrimiento.** Las seis búsquedas generales devolvieron cero fichas útiles: lo nicho no está indexado, Instagram no aparece en el índice y `site:` sobre ticketeras volvió vacío. Los seis hallazgos salieron de abrir rutas primarias del propio local: perfil de Vesti, subdominio de Evently y cartelera de PortalTickets. Google sirve para encontrar una ruta nueva, no como evidencia ni como prueba de ausencia.
- **Una ruta vacía no es un local sin agenda.** Ejemplos:
  - Vesti mostraba "SIN FECHAS PUBLICADAS" para Woo Club mientras su Evently propio vendía el sábado.
  - La página de Passline de Pagano solo muestra la dirección.
  - La cartelera de PortalTickets de Espantapájaros está vacía.

  Cada local necesita más de una ruta registrada.
- **Bloqueos duros:** Ecopass pide la verificación de Cloudflare (Máscara); no se intenta saltar. Instagram no se lee sin sesión: solo vía Apify, pausado.
- **Agregadores:**
  - El buscador de Vamoh ignora la consulta.
  - Sus enlaces genéricos produjeron atribuciones falsas: tres eventos distintos de Gemini apuntaban a la misma ficha.
  - Sirven para descubrir, nunca como fuente.
- **Datos de la ficha que mienten:**
  - Passline puso 09:00 en el encabezado mientras el texto decía 21:00.
  - Gemini infirió horas y precios distintos de la ficha en siete de once casos.
  - El mismo afiche se sirve en dos hosts.

  Hay que guardar el extracto que respalda cada campo.
- **Costo de integración:**
  - Cada host nuevo exige cambiar la allowlist del editorial (hoy, `wooclub.evently.cl`).
  - Un local fuera del catálogo publica sin pin (Atril Azul, Alto San Andrés, The House, Brisamar).
  - El editorial solo inserta, depende del cron y vence a los 7 días de `reviewed_at`.
  - El navegador integrado a veces niega la navegación a portaldisc.com mientras `curl` sí la lee: hay que registrar el método.

## Plan mínimo del siguiente PR (no implementado)

Objetivo: cobertura comprobable por local y día, sin rediseñar la app ni cambiar la regla de publicación.

1. **Rutas por local** (`data/venue-routes.json`, público porque solo lleva URLs públicas).
   - Por `slug` del catálogo: rutas primarias tipadas (`vesti_company`, `evently_subdomain`, `portaldisc_cartelera`, `passline_venue`, `passline_productora`, `sitio_oficial`, `instagram_handle`) y la última observación.
   - Semilla: las rutas confirmadas en esta tanda.
   - Una prueba exige que cada slug exista en el catálogo.
2. **Dos adaptadores primarios** sobre el `Fetcher` existente, con allowlist exacta por subdominio:
   - perfil de empresa de Vesti: próximas fechas y su ficha;
   - agenda de Evently por subdominio: listado "este mes" y su ficha, incluida la página de tickets para leer las condiciones de acceso.

   Igual que PortalTickets: tope de detalles por corrida, motivos `PRICE_*` y salida a la cola, nunca publicación directa.
3. **Registro de chequeos** venue × día.
   - **Campos:** `{slug, fecha, ruta, método: live|index|api, estado: FOUND|ROUTE_EMPTY|NO_ANNOUNCEMENT_FOUND|BLOCKED, motivo, observado_en}`.
   - **Dónde vive:** primero un JSON privado fuera del repo; tabla privada solo en un PR de migración aparte, autorizado.
   - **Cuándo se escribe:** cada corrida de adaptador y cada lote de agente.
   - **Regla:** `NO_ANNOUNCEMENT_FOUND` solo si todas las rutas del local fueron `ROUTE_EMPTY`; un `BLOCKED` mantiene el local pendiente.
4. **Descubrimiento acotado** (script, sin cron).
   - **Consultas:** plantillas `"<local>" <comuna> <fecha>` contra una API de búsqueda con tope de consultas y de costo.
   - **Uso del resultado:** se queda solo con URLs de hosts de ticketeras u oficiales, que pasan a "ruta candidata" para revisión humana.
   - **Límite:** nunca crea eventos ni cuenta como evidencia.
5. **Campos faltantes.**
   - Completar el afiche vacío con la misma regla que el precio: misma URL de origen, solo si el campo está nulo y el host está permitido.
   - Un reporte por motivo (`PRICE_*`, `IMAGE_MISSING`, `VENUE_NOT_IN_CATALOG`) para la revisión de Codex.
6. **Métrica de cierre:**
   - por comuna: locales con al menos una ruta, chequeados hoy y bloqueados;
   - eventos FOUND → aceptados → visibles en el snapshot.

   Ninguna cifra se presenta como "cobertura total".

**Fuera de alcance:** Instagram (sigue con Apify en pausa), migraciones, cambios de UI y la regla de 7 condiciones.

**Validación del PR:** pruebas con fichas reales recortadas (Vesti y Evently del 17/10), tope de solicitudes con reintentos, allowlist exacta y slug del catálogo; `npm run verify`.

## Implementado en `feat/venue-coverage-automation`

Se hicieron los puntos 1, 2, 3 (sobre `metrics` de la corrida, sin tabla nueva) y 5 del plan, más dos correcciones encontradas en el camino. El 4 (descubrimiento por búsqueda) y el 6 (métrica de cierre) quedan para después.

- **Rutas por local** (`data/venue-routes.json`, `lib/venue-routes.ts`):
  - Siembra: rutas verificadas el 17/10 para Woo Club (Evently y Vesti), Studio (Vesti), Pagano (Passline, bloqueada), Máscara (Ecopass, bloqueada) y El Huevo (Instagram, bloqueada).
  - Las carteleras de PortalTickets ya registradas cuentan como rutas de su local.
  - Las pruebas exigen tipo y host exacto, motivo en cada ruta manual o bloqueada, y slug presente en `data/catalogo-publico-slugs.json`, sacado del snapshot público.
- **Adaptadores con host exacto** (`lib/sources/hosts.ts`):
  - Vesti (`vesti-company`): una solicitud por perfil. Lee `dateIni` en UTC y lo pasa a hora de Chile; el texto del servidor dice "Dom 18 oct, 01:00" para un sábado a las 22:00.
  - Evently (`evently-agenda`, solo `wooclub.evently.cl`): agenda más hasta 4 fichas con sus tickets. Como máximo 9 solicitudes.
  - Las rutas nuevas entran con confianza `review`: cola privada, nunca publicación directa.
- **Afiche vacío:** se completa como el precio. Solo si falta, solo en la ficha de la misma URL, con host permitido y con `image_source_url`, `image_kind` y `image_verified_at`.
- **Cobertura local × día** (`lib/coverage.ts`):
  - Cada corrida del cron guarda `metrics.coverage`, con estado por ruta (`FOUND`, `ROUTE_EMPTY`, `BLOCKED`, `ERROR`, `PENDING`) y por local (`FOUND`, `NO_ANNOUNCEMENT_FOUND`, `BLOCKED`, `PENDING`), para una ventana de 7 días.
  - Una revisión de más de 48 h no cuenta.
  - **Límite:** para las fuentes que no corrieron hoy, las fechas salen de `events.source_id`. Un evento que llegó primero por otra fuente no aparece en la ruta que solo le sumó evidencia.
- **Rotación comprobable:**
  - Una prueba simula días con el presupuesto real de 16 fuentes por corrida y verifica que toda fuente activa se lee dentro de su ciclo.
  - El despacho deja de empezar fuentes a los 180 s (`PLAZO_DESPACHO_MS`), para no chocar con los 300 s de Vercel. Lo que no alcanza queda vencido (`metrics.sources_postponed`) y encabeza la corrida siguiente. Sin corridas extra ni gastos.
- **Deduplicación editorial en todos los estados** (`lib/editorial-dedupe.ts`):
  - Antes de insertar se compara URL de origen + fecha contra la base completa: pública, cola, inactiva, rechazada o duplicada. Caso real: Cómpeta ya estaba en cola desde el listado regional.
  - Nada se reactiva. Si la consulta falla, no se inserta.
  - Activo en `/api/cron/scrape` y en la importación del admin.
  - **Pendiente para Codex:** llamar a `sinDuplicadosDeFuente` en `app/api/cron/automatizacion/route.ts` cuando cierre su hotfix (ese archivo no se tocó a propósito).
- **Cinzano:** el sitio dejó el tipo de WordPress `cinzano_event` por su API (`/cinzano-api/cinzano/v1/events`), y la fuente `cinzano-agenda` ahora la lee. El precio va con su cargo. La disponibilidad no se inventa: si la API dice `few-tickets` con stock 0 y sin venta habilitada, el texto dice "sin venta en línea habilitada al revisar" y el candidato lleva `AVAILABILITY_CONFLICT`.

**Fuera de este PR:** base de datos, migraciones, UI, Instagram/Apify, secretos y despliegue.
