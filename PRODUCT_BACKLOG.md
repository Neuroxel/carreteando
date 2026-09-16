# Carreteando — backlog de producto

Estado al **15 de septiembre de 2026**, revisado en fase 9. Este archivo es la lista canónica: toda idea del encargo
aparece aquí con su estado. Nada se descarta en silencio.

Estados: **HECHO** · **EN CURSO** · **PENDIENTE** · **BLOQUEADO** · **NO AHORA**

Leyenda de fase: **P0 AHORA** (esta fase) · **P1 SIGUIENTE** · **P2 MÁS ADELANTE** · **KILL**

---

## P0 — AHORA

| # | Ítem | Estado | Criterio de aceptación | Dependencia / riesgo |
|---|---|---|---|---|
| 1 | Acceso del propietario a `/admin` | **EN CURSO** | El propietario inicia sesión y `review_audit` deja de estar en 0 | **Clave rotada en fase 6**: valor nuevo generado y escrito a la vez en el archivo 0600 y en el secreto de Vercel, así que ambos lados coinciden por construcción. Falta un login humano |
| 2 | QA de mutaciones del panel | **BLOQUEADO** | Rechazar 3 QA, retirar/reaprobar, conflicto de versión, reimportación que no reactiva, 1 fila de auditoría por decisión | Depende de (1) |
| 3 | Cobertura del 18 de septiembre | **HECHO** | Fondas verificadas con fuente 2026 en varias comunas, visibles del 17 al 20 | 5 fondas, 17 filas, 4 comunas |
| 4 | Tipo de evento (fonda/pre/after/live/club) | **HECHO** | Una fonda se lee como fonda, no como género musical | Filtro `?tipo=` operativo |
| 5 | Superficie estacional Dieciocho | **HECHO** | Aparece y desaparece sola por fecha, sin fijarla a mano | Ventana 14–21 de septiembre |
| 6 | Redes sociales oficiales por lugar | **EN CURSO** | Cada lugar publicado expone su cuenta oficial cuando existe | 18 de 60. **Bajó en porcentaje al crecer el censo**: es ahora el mayor hueco de calidad |
| 7 | Reportes en vivo de la comunidad | **HECHO** | Ambiente, gente, fila y estado, con caducidad y tamaño de muestra | Mínimo 2 reportes coincidentes; sin datos observados aún |
| 8 | Estado del lugar (abierto/cerrado/revisar) | **HECHO** | Un lugar cerrado deja de servirse aunque quede marcado activo | Falta UI de reporte de cierre por el usuario |
| 9 | Censo profundo de lugares | **HECHO (primer objetivo)** | Registro de alta confianza mucho mayor que 23 | **60 publicados** en 10 comunas + 20 candidatos + 1 cerrado, tras la cartografía del propietario. Dentro del rango 50–100 |
| 10 | Cobertura regional | **EN CURSO** | Lugares o eventos reales con fuente propia | Quilpué 7, Quintero 5, Quillota 4, Limache 2, Olmué 2, Reñaca 1, Concón 1, Villa Alemana 2. La Calera y Maitencillo sólo candidatos |
| 11 | Matriz de cobertura | **HECHO** | El propietario puede responder «por qué está vacía tal comuna» con evidencia | En el informe final |
| 12 | Arquitectura de frescura por capas | **HECHO (diseño)** | Base de lugar / agenda / estado en vivo con TTL distintos | Ver §Scheduler |
| 13 | Salud de fuentes | **PARCIAL** | last_success, items, coste y error por fuente, con desactivación sugerida | Documentado en `SOURCE_REGISTRY.md`; falta el tablero en `/admin` |
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

## Añadido en fase 6

| # | Ítem | Fase | Estado | Criterio de aceptación | Nota |
|---|---|---|---|---|---|
| 34 | Arte de tarjeta por tipo de noche | P0 | **HECHO** | Ninguna tarjeta muestra «OTRO»; dos vecinas no se ven iguales | Paleta por tipo + variación por hash dentro del tipo |
| 35 | El 18 domina la portada en su semana | P0 | **HECHO** | Bloque con cuenta regresiva arriba del tablero, desaparece solo el 22 | Derivado de la fecha |
| 36 | Rotación de la clave de administración | P0 | **HECHO** | Valor nuevo en Vercel y en el archivo 0600, coincidentes | Hecho por el agente, sin exponer el valor |
| 37 | Estudio de productos de referencia | P0 | **HECHO** | Patrón por patrón con USAR / ADAPTAR / IGNORAR | `COMPETITIVE_PRODUCT_PATTERNS.md` |
| 38 | Matriz de cobertura con el porqué | P0 | **HECHO** | Cada comuna vacía explica su causa | `REGIONAL_COVERAGE.md` |
| 39 | Registro de fuentes con rendimiento | P0 | **HECHO** | Eventos vigentes y coste por fuente | `SOURCE_REGISTRY.md` |
| 40 | Ficha de organizador | P1 | **PENDIENTE** | Un organizador tiene página propia con su programación | Patrón tomado de Shotgun |
| 41 | Geocodificación con procedencia | P1 | **PENDIENTE** | Coordenadas obtenidas de proveedor con términos compatibles | Prerrequisito del mapa; **no** se scrapea Maps |
| 42 | Búsqueda unificada | P1 | **PENDIENTE** | «bar cerro alegre» devuelve lugar, zona y evento | Hoy sólo busca eventos |
| 43 | Superficie «Ahora» | P1 | **PENDIENTE** | Combina eventos en curso, horarios conocidos y reportes frescos | Bloqueada por horarios de apertura, que casi nadie publica |
| 44 | Lugares temporales con vigencia | P1 | **PENDIENTE** | `active_from` / `active_until` y retiro automático | Hoy las fondas son eventos con dirección, que ya caducan solos |
| 45 | Reporte de cierre por el usuario | P1 | **PENDIENTE** | «Este lugar cerró» entra a la cola privada | La columna `status` ya existe |
| 46 | Tablero de salud de fuentes en `/admin` | P1 | **PENDIENTE** | Responder «por qué está vacía Reñaca» sin SQL | Datos ya disponibles |
| 47 | Fonda multi-día como entidad | P2 | **NO AHORA** | Una ficha explica el programa y conserva la búsqueda por día | Hoy son filas por día, que es lo que hace funcionar «hoy» y «mañana» |

---

## Añadido en fase 7

| # | Ítem | Fase | Estado | Criterio de aceptación | Nota |
|---|---|---|---|---|---|
| 48 | Cartografía regional del propietario | P0 | **HECHO** | Registro > 50 lugares con procedencia explícita | 35 fichas nuevas, 30 publicadas |
| 49 | Región ampliada a 13 comunas | P0 | **HECHO** | Limache, Olmué, Quillota, La Calera, Quintero, Puchuncaví y Maitencillo son direcciones válidas | Los chips de portada siguen en el corredor |
| 50 | Sistema de color por ciudad | P0 | **HECHO** | Acento sólo en filete y chip, nunca en fondo; sin chocar con colores semánticos | 13 acentos documentados |
| 51 | Especificación maestra | P0 | **HECHO** | Un agente nuevo entiende el producto con un archivo | `PRODUCT_MASTER_SPEC.md` |
| 52 | Exploración de nombre | P0 | **HECHO — espera decisión** | 30 candidatos, 5 finalistas, recomendación razonada | Recomendado **Prendido**. No se migra sin tu palabra |
| 53 | Sistema de diseño | P0 | **HECHO** | Tokens, componentes y reglas en un solo lugar | `DESIGN_SYSTEM.md` |
| 54 | Estudio de Vesti | P0 | **HECHO** | Qué hace mejor, qué adaptamos, qué no copiamos nunca | En `COMPETITIVE_PRODUCT_PATTERNS.md` |
| 55 | Identidad visual definitiva | P1 | **BLOQUEADO** | Tres direcciones y una elegida | Depende de (52): el logotipo no se cierra antes que el nombre |
| 56 | Redes oficiales de los 42 lugares nuevos | P1 | **PENDIENTE** | Cada lugar publicado con cuenta oficial o con «no confirmada» | El censo creció más rápido que la verificación de cuentas |
| 57 | Jerarquía de imagen del lugar | P1 | **PENDIENTE** | flyer → imagen del lugar → logo → arte generativo | Patrón tomado de Vesti; hoy sólo existen los extremos |
| 58 | Reclamar lugar | P1 | **PENDIENTE** | Un local pide su ficha y aporta logo y programación | Base del modelo de socios |
| 59 | Barra inferior móvil | P1 | **PENDIENTE** | Prototipar y medir antes de adoptar | No se añade sólo porque otras apps la tengan |
| 60 | Contenido destacado rotulado | P2 | **NO AHORA** | Todo destacado pagado se rotula y **nunca** altera el estado en vivo | Documentado en la especificación maestra |

---

## Añadido en fase 9

| # | Ítem | Fase | Estado | Criterio de aceptación | Evidencia / riesgo |
|---|---|---|---|---|---|
| 61 | Verdad de automatización | P0 | **HECHO** | Tabla por dato: qué corre solo, con qué frecuencia y qué exige humanos | `AUTOMATION_TRUTH.md`. Verificado contra `vercel.json`, código del cron, env de producción e `ingestion_runs` |
| 62 | Límites reales del plan Vercel | P0 | **HECHO** | Confirmado en documentación oficial | Hobby: 100 crons, **mínimo diario**, precisión ±59 min. Expresiones más frecuentes fallan al desplegar |
| 63 | Caducidad sin depender del cron | P0 | **HECHO+VERIFICADO** | Eventos y reportes caducan en tiempo de consulta | RLS y lecturas filtran por fecha de Chile y por `expires_at` |
| 64 | Tres direcciones visuales reales | P0 | **HECHO** | Tres prototipos comparables con el mismo contenido | `/prototipos/a-pulso`, `b-rutas`, `c-afiche`. Estáticos y `noindex`: no tocan el bundle |
| 65 | Umbral de publicación relajado | P0 | **HECHO** | Existencia + identidad geográfica + procedencia, dirección opcional y mostrada como desconocida | 78 publicados, 11 comunas |
| 66 | Adaptadores de agenda por fuente | **P1** | **PENDIENTE** | El cron diario refresca carteleras por recinto y registra rendimiento | Es el hueco que impide decir «se actualiza sola» |
| 67 | Cola de revalidación de lugares | **P1** | **PENDIENTE** | `needs_recheck` automático al superar umbral de antigüedad | La columna `status` ya existe |
| 68 | Tablero de salud de fuentes en `/admin` | **P1** | **PENDIENTE** | Responder «¿por qué no hay eventos en Quillota?» sin SQL | Los datos ya se guardan en `ingestion_runs` |
| 69 | Mapa con geocodificación licenciada | **P1** | **PENDIENTE** | lat/lng con proveedor de términos compatibles, procedencia y precisión | Sin esto no hay LISTA \| MAPA |
| 70 | Horarios de apertura | **P1** | **PENDIENTE** | Sólo cuando la fuente oficial los publique | Bloquea «Ahora» y la línea de tiempo |
| 71 | Barra inferior móvil | **P1** | **PENDIENTE** | Prototipar y medir antes de adoptar | — |
| 72 | Imagen e identidad del lugar | **P1** | **PENDIENTE** | flyer → imagen del lugar → logo → arte generativo | Hoy sólo existen los extremos |
| 73 | Migración a scheduler de mayor frecuencia | **P2** | **NO AHORA** | Sólo cuando una fuente demuestre eventos únicos varias veces al día durante dos semanas | Hoy Apify rinde 0 vigentes sobre 80 filas |

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

---

## Fase 11 — estado tras cerrar el lazo operativo

### Cerrados en esta fase

- **Descubrimiento automático de eventos.** Ocho adaptadores reales detrás del cron
  diario, que ahora despacha fuentes vencidas en vez de leer un JSON escrito a mano.
- **Registro y salud de fuentes.** `event_sources` + `ingestion_source_runs`, con panel
  en /admin: estado, última revisión, próxima, ítems, eventos, duplicados, errores y coste.
  El dueño no necesita SQL.
- **Mapa.** 62 lugares con coordenada verificada de un geocodificador con licencia,
  guardando proveedor, precisión y la consulta exacta. Vista LISTA | MAPA, agrupación,
  ficha por marcador y entrada propia en la navegación.
- **Acceso a /admin.** Causa raíz identificada y cerrada; deja de ser bloqueante.
- **Navegación móvil.** Barra inferior Ahora / Explorar / Mapa / Lugares.
- **Barra de zonas.** La idea del prototipo B llevada a producción.

### P0 — bloquean la beta cerrada

1. **Primera corrida de adaptadores en producción.** El despachador está desplegado y
   probado contra las fuentes reales, pero ninguna corrida productiva se ha ejecutado.
   Se cierra con un clic en «Revisar fuentes ahora» o con el cron de las 18:00 UTC.
2. **QA de moderación en producción.** `review_audit` sigue en 0 en producción. La
   semántica completa (aprobar, editar, conflicto por revisión obsoleta, retirar, que el
   import no reactive lo retirado, reaprobar, lugares, auditoría) está verificada contra
   Postgres real, pero no ejercitada contra la base de producción.

### P1 — bloquean el MVP público

3. **Auditoría sin actor.** `review_audit` responde qué, cuándo, desde qué, hacia qué y
   por qué, pero no **quién**, porque hay una sola credencial. Carlos necesita la suya.
4. **Tiles de mapa a escala.** OpenStreetMap sirve los tiles bajo una política que
   desaconseja el uso intensivo. Antes de abrir al público hay que pasar a un proveedor
   contratado o servir tiles propios.
5. **Reportes en vivo sin uso real.** La capa funciona y no tiene datos orgánicos. Se
   resuelve con la beta, no con código.
6. **Recheck de lugares por antigüedad.** El estado existe; falta el disparador.
7. **Respaldos y recuperación.** Sin auditar en esta fase: qué respalda el plan actual,
   cuánto retiene y si hay recuperación a un punto en el tiempo.
8. **Los 10 px de desborde horizontal.** Contenidos en `main`; el elemento concreto no
   se aisló.

### P2

9. 95 candidatos de lugar sin resolver; 34 de 88 lugares publicados sin identidad digital
   confirmada.
10. Cobertura de fuentes fuera del eje Valparaíso–Viña: siete comunas con lugares
    publicados y ninguna fuente de agenda mapeada.
11. Simulacro de cron caído uno y tres días, y de fuente que devuelve datos malformados.

---

## Fase 12 — deuda de datos en cero, una sola forma de explorar

Investigado hasta: **2026-09-15**. No se afirma cobertura permanente.

### Cerrados

- **La corrida de fuentes del dueño falló y ya no falla.** El despachador leía su
  reloj antes de escribir el registro; la base estampaba las filas nuevas
  milisegundos después y ninguna fuente aparecía vencida. Primera corrida real:
  32 candidatos, 19 duplicados suprimidos, 13 escritos, coste cero.
- **Deuda de datos clasificada.** 0 lugares y 0 eventos sin disposición. Cada
  `needs_evidence` declara qué falta, dónde se buscó, cuándo y cuándo se revisa.
- **Una sola forma de explorar.** `/buscar`, `/lugares` y `/mapa` eran cuatro
  páginas para una pregunta. Ahora es `/explorar` con segmentos y vista mapa,
  compartiendo filtros. Las direcciones viejas siguen funcionando.
- **Dieciocho.** El 18 pasó de 8 eventos en 4 comunas a 17 en 11 comunas.
- **Los 10 px de desborde.** Eran las pestañas de fecha. Corregido en la causa;
  la contención en `main` se eliminó.
- **Analítica.** Se medía contra `/buscar`, que ya redirige. Corregido y ampliado
  con mapa, búsqueda, marcador y clic a redes.
- **Respaldos.** El plan Free no respalda. `scripts/respaldo.mjs` guarda una copia
  fechada sin necesitar la contraseña de la base.
- **pg_cron y pg_net habilitados y verificados** en el proyecto.

### P0 — bloquean la beta cerrada

1. **QA de moderación en producción.** `review_audit` sigue en 0. La semántica
   completa está verificada contra Postgres real, pero nunca se ha ejercitado
   contra la base de producción. Se cierra con una aprobación, una edición y un
   retiro hechos desde /admin.

### P1 — bloquean el MVP público

2. **Auditoría sin actor.** No hay columna de quién. Carlos necesita credencial
   propia antes de que dos personas moderen.
3. **Supabase Cron sin encender.** Falta guardar el secreto en Vault; el
   procedimiento exacto está en `docs/private/SUPABASE_CRON.md`.
4. **Imágenes propias: 0 de 91 lugares.** Ninguna imagen de local. No se copian
   activos de terceros sin derechos claros; hay que pedirlas o fotografiarlas.
5. **Tiles de mapa a escala.** OpenStreetMap desaconseja el uso intensivo.
6. **36 de 91 lugares sin fuente de programación** y 34 sin identidad digital.
7. **Reportes en vivo sin uso orgánico.** Se resuelve con la beta.
8. **Recheck automático.** `next_recheck_at` existe y está poblado; falta el
   disparador que lo consuma.

### P2

9. 92 candidatos en `needs_evidence`, todos explicados y con fecha de revisión.
10. Comunas del litoral sur (Algarrobo, El Quisco, Cartagena, San Antonio) sin
    investigar.
11. 153 eventos caducados conservados como evidencia: conviene archivarlos fuera
    de la tabla viva cuando crezcan.

---

## Fase 13 — cierre operativo

Investigado hasta: **2026-09-15**.

### Corregido

- **La moderación estaba rota, no sólo sin usar.** El dueño aprobó, editó y
  retiró en /admin y la base no registró nada: `review_audit` vacío y ningún
  evento llegó nunca a `revision 1`. El formulario validaba con el validador de
  **aportes públicos**, que exige organizador de 2+ caracteres y descripción de
  20+. La agenda propia de un local no tiene ninguno de los dos, y las filas de
  adaptador traen `username` nulo: aprobar era imposible, y el mensaje de error
  nombraba campos que no eran el problema. Corregido, con tests que fijan la
  nueva regla y protegen la estricta del público.
- **Programación sub-diaria encendida.** Cuatro trabajos `pg_cron` activos. La
  autenticación no usa secreto compartido: la base emite un pase de un solo uso
  desde una tabla del rol de servicio. Probado: 401 sin pase, 200 con pase.
- **De 8 a 24 fuentes automáticas.** Las 16 carteleras que esperaban adaptador,
  todas probadas antes de registrarse. Lugares con fuente automática: 5 → 21.
- **Un lugar cerrado que seguía publicado.** Bar El Irlandés cerró en 2025.
- **Respaldo honesto.** Copia el esquema junto a los datos y declara que la
  restauración no se ha ensayado.

### P0 — bloquean la beta cerrada

1. **`review_audit` sigue en 0 en producción.** El defecto que lo impedía está
   corregido y desplegado; falta que una aprobación, una edición y un retiro
   se completen contra la base real.

### P1 — bloquean el MVP público

2. Auditoría sin actor: Carlos necesita credencial propia.
3. 0 de 91 lugares con imagen propia.
4. Tiles de mapa a escala: OpenStreetMap desaconseja uso intensivo.
5. 36 lugares sin fuente de programación; 30 sin identidad digital.
6. Reportes en vivo sin uso orgánico.
7. Disparador de recheck: `next_recheck_at` poblado, sin consumidor.
8. Restauración de respaldo sin ensayar.

### P2

9. 92 candidatos en `needs_evidence`, todos explicados y con fecha de revisión.
10. Litoral sur (Algarrobo, El Quisco, Cartagena, San Antonio) sin investigar.
11. 153 eventos caducados conservados como evidencia.

---

## Sprint 16–18 septiembre 2026

### P0 cerrado

- **Admin.** `review_audit` = 3. Guardar (rev 0→1, sigue privado), aprobar
  (rev 1→2, `pending`→`approved`, publicado) y retirar (rev 0→1). Cada fila con
  nota, hora, estado anterior y posterior. **No volver a pedir estas acciones.**

### Corregido en el sprint

- La aprobación desde el panel dejaba el lugar visible pero contado como
  «esperando evidencia»: añadí `disposition` sin conectarla a la moderación.
  Ahora la mantiene coherente un *trigger*, no la memoria de quien escriba.
- `.season-hero .eyebrow` pintaba crema sobre crema el rótulo de cada tarjeta
  metida en el bloque del Dieciocho (contraste 1,24).
- La insignia de fecha tapaba la ciudad en el cartel generado.
- Pedir Mapa mostraba tarjetas con el mapa 600 px más abajo.

### P1

1. **0 de 92 lugares con imagen propia.** No se copian fotos de terceros sin
   derechos claros. Falta el flujo «Reclama este lugar».
2. Auditoría sin actor: Carlos necesita credencial propia.
3. Tiles de mapa a escala: OpenStreetMap desaconseja uso intensivo.
4. 36 lugares sin fuente de programación; 30 sin identidad digital.
5. 31 lugares sin coordenada fiable.
6. Reportes en vivo sin uso orgánico.
7. Disparador de recheck sin construir.
8. Restauración de respaldo sin ensayar.

### P2

9. 91 candidatos en `needs_evidence`, todos explicados y con fecha de revisión.
10. Litoral sur sin investigar.
11. Favoritos y perfil: en los mockups de Carlos, **no** en el producto. No se
    añade navegación que no funciona.

---

## Nota del 16-09-2026 · preguntas de Carlos

- **Corregido:** el tope global de aportes contaba todo lo recibido, revisado o
  no, así que un flood de basura dejaba fuera a la gente real el resto del día.
  Ahora sólo cuenta lo que está sin revisar; moderar libera cupo.
- **P2 (no bloqueante):** captcha en el formulario de aportes. El disparador es
  evidencia de basura real en la cola, no precaución. Opciones: Cloudflare
  Turnstile o la protección de bots de Vercel.
