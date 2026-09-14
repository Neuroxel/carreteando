# Carreteando — backlog de producto

Estado al **14 de septiembre de 2026**. Este archivo es la lista canónica: toda idea del encargo
aparece aquí con su estado. Nada se descarta en silencio.

Estados: **HECHO** · **EN CURSO** · **PENDIENTE** · **BLOQUEADO** · **NO AHORA**

Leyenda de fase: **P0 AHORA** (esta fase) · **P1 SIGUIENTE** · **P2 MÁS ADELANTE** · **KILL**

---

## P0 — AHORA

| # | Ítem | Estado | Criterio de aceptación | Dependencia / riesgo |
|---|---|---|---|---|
| 1 | Acceso del propietario a `/admin` | **BLOQUEADO** | El propietario inicia sesión y `review_audit` deja de estar en 0 | Sólo él puede pegar la clave. Se desplegó tolerancia a espacios tras su intento fallido |
| 2 | QA de mutaciones del panel | **BLOQUEADO** | Rechazar 3 QA, retirar/reaprobar, conflicto de versión, reimportación que no reactiva, 1 fila de auditoría por decisión | Depende de (1) |
| 3 | Cobertura del 18 de septiembre | **HECHO** | Fondas verificadas con fuente 2026 en varias comunas, visibles del 17 al 20 | 5 fondas, 17 filas, 4 comunas |
| 4 | Tipo de evento (fonda/pre/after/live/club) | **HECHO** | Una fonda se lee como fonda, no como género musical | Filtro `?tipo=` operativo |
| 5 | Superficie estacional Dieciocho | **HECHO** | Aparece y desaparece sola por fecha, sin fijarla a mano | Ventana 14–21 de septiembre |
| 6 | Redes sociales oficiales por lugar | **EN CURSO** | Cada lugar publicado expone su cuenta oficial cuando existe | 14 de 23 verificados; el resto sigue sin fuente confirmada |
| 7 | Reportes en vivo de la comunidad | **HECHO** | Ambiente, gente, fila y estado, con caducidad y tamaño de muestra | Mínimo 2 reportes coincidentes; sin datos observados aún |
| 8 | Estado del lugar (abierto/cerrado/revisar) | **HECHO** | Un lugar cerrado deja de servirse aunque quede marcado activo | Falta UI de reporte de cierre por el usuario |
| 9 | Censo profundo de lugares | **EN CURSO** | Registro de alta confianza mucho mayor que 23 | 24 publicados + 14 candidatos; muy por debajo de 50–100 |
| 10 | Cobertura Quilpué / Villa Alemana | **EN CURSO** | Lugares o eventos reales con fuente propia | Villa Alemana y Concón entran por fondas; Quilpué sigue débil |
| 11 | Matriz de cobertura | **HECHO** | El propietario puede responder «por qué está vacía tal comuna» con evidencia | En el informe final |
| 12 | Arquitectura de frescura por capas | **HECHO (diseño)** | Base de lugar / agenda / estado en vivo con TTL distintos | Ver §Scheduler |
| 13 | Salud de fuentes | **PENDIENTE** | last_success, items, coste y error por fuente, con desactivación sugerida | Existe `ingestion_runs`; falta vista por fuente |
| 14 | QA móvil y seguridad | **HECHO** | Lighthouse, rutas, RLS y CI verdes tras cada cambio | Se mantiene en cada despliegue |

## P1 — SIGUIENTE

| # | Ítem | Estado | Criterio de aceptación | Riesgo |
|---|---|---|---|---|
| 15 | Mapa + lista | **PENDIENTE** | Pines que distinguen lugar de evento, con proveedor abierto | Requiere coordenadas legítimas; hoy no las tenemos y no se scrapean de Maps |
| 16 | Coordenadas por lugar | **PENDIENTE** | lat/lng obtenidas de fuente propia o geocodificador permitido | Prerrequisito de (15) |
| 17 | Búsqueda potente | **PENDIENTE** | «techno valpo», «bar cerro alegre», «fonda viña» devuelven lugar, evento y zona | Hoy la búsqueda sólo cubre eventos |
| 18 | Descubrimiento por intención | **PENDIENTE** | Filtros por vibra respaldados por metadatos reales | Bloqueado por (19) |
| 19 | Género/vibra real por evento | **PENDIENTE** | Dejar de tener la mayoría en «Otro estilo» | Las carteleras de origen no publican género; necesita al recinto u organizador |
| 20 | Línea de tiempo de la noche | **PENDIENTE** | Ahora / 20–23 / 23–02 / 02+ / afters | Necesita horarios de apertura fiables, hoy no publicados |
| 21 | Cron por capas | **PENDIENTE** | Trabajos separados con frecuencia propia | Ver §Scheduler; vigilar límites del plan |
| 22 | Reporte de datos incorrectos del lugar | **PENDIENTE** | Cerrado, dirección mala, red equivocada, cambio de nombre | Reutiliza la bandeja privada existente |
| 23 | Comentarios | **NO AHORA** | Texto corto, con límite, denuncia y moderación | No abrir chat anónimo sin cuentas ni moderación |
| 24 | Cuentas ligeras | **PENDIENTE** | Guardar, seguir, contribuir; navegar nunca exige cuenta | Prerrequisito de 23, 25, 26 |
| 25 | Favoritos / seguir lugar | **PENDIENTE** | Guardar lugar y evento | Depende de (24) |
| 26 | Moderadores individuales | **PENDIENTE** | Cuentas con MFA y actor nombrado en la auditoría | La auditoría ya guarda estado previo y posterior; añadir actor es aditivo |
| 27 | Circuito del organizador | **PENDIENTE** | Reclamar lugar, enviar programación, corregir datos | Sin panel de comercio completo |
| 28 | Pre y afters | **PARCIAL** | El modelo ya los admite; falta captación real | No publicar direcciones privadas |

## P2 — MÁS ADELANTE

| # | Ítem | Estado | Nota |
|---|---|---|---|
| 29 | Fotos y videos de usuarios | **NO AHORA** | Exige antes: autenticación, moderación, denuncia, retención, consentimiento, menores, copyright, coste de almacenamiento y control de abuso. Arquitectura anotada, no implementada |
| 30 | Capa social opt-in («Voy», «Busco grupo») | **NO AHORA** | Requiere control de edad, bloqueo, denuncia, consentimiento y seguridad de ubicación |
| 31 | Citas / emparejamiento | **NO AHORA** | No se envía sin todas las salvaguardas de (30) y moderación real |
| 32 | Recomendador personalizado | **NO AHORA** | Primero filtros transparentes: hora, zona, vibra, precio, actividad |
| 33 | Recompensas por contribuir | **NO AHORA** | Si se hace, premiar utilidad y verificación, **nunca** sentimiento positivo |

## KILL / NO CONSTRUIR

| Ítem | Razón |
|---|---|
| Aforo inferido sin reportes | No hay forma ética de medirlo; inventarlo destruye la confianza |
| Rastreo de ubicación de dispositivos | Prohibido |
| Identidades de asistentes scrapeadas | Prohibido |
| Conteos de gente o popularidad falsos | Prohibido |
| Chat anónimo sin moderación | Riesgo de acoso |
| Scraping masivo de Google Maps | Contenido propietario |
| Ticketera propia | Fuera del foco |
| Guía de restaurantes, hoteles o turismo diurno | Rompe la cuña: salir de noche |
| Subir límites de scraping sin diagnóstico | Gasto sin rendimiento demostrado |

---

## Arquitectura de actualización por capas

Tres velocidades distintas, deliberadamente separadas:

| Capa | Qué cambia | Frecuencia | Caducidad | Estado |
|---|---|---|---|---|
| **A. Base del lugar** | Nombre, dirección, redes, tipo | Semanas | `last_verified_at` + `status` | Implementada |
| **B. Agenda de eventos** | Fechas, precios, horarios | Horas o días | Expiración automática por fecha Chile | Implementada |
| **C. Estado en vivo** | Ambiente, fila, gente, abierto | Minutos | 45–120 min por tipo, automática | Implementada |

Trabajos previstos (P1, aún no programados): `venue_reverify`, `event_source_refresh`,
`expire_events` (ya cubierto por RLS y cron existente), `expire_live_reports` (ya cubierto por TTL
en la propia consulta), `community_queue_cleanup`, `event_source_health`.

Nota de coste: el cron actual corre una vez al día y no gasta en Apify (`APIFY_PAUSED=true`).
Subir la frecuencia sólo tiene sentido para la capa C, que no llama a proveedores pagos.
No se aumentará la frecuencia de scraping pago sin diagnóstico de rendimiento por fuente.
