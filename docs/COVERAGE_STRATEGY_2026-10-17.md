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
