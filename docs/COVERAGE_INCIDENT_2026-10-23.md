# Incidente P0 de cobertura — 23-oct-2026

Fecha: 23-oct-2026  
Contexto: piloto público de Dónde Salgo  
Prioridad: **P0 — cobertura/integridad antes de polish visual**

## Síntoma

En producción, la portada muestra alrededor de **5 eventos en Valparaíso para hoy viernes 23-oct**, muy por debajo de lo que se observó la semana anterior y, más importante, por debajo de la oferta pública verificable hoy.

Esto NO debe interpretarse automáticamente como “hoy hay menos eventos”.

## Evidencia externa del 23-oct

### PortalTickets — fuente primaria regional

La cartelera regional pública muestra hoy en Valparaíso, como mínimo:

- KAZUAKI — Panic House — 17:00
- EMILY WITTBRODT — Balmaceda Arte Joven — 18:30
- JULIO PIÑA TOCATAS ÍNTIMAS — Café Teatro VP — 19:00
- LUCAS ESPINOZA — Barbones Curauma — 20:00
- FULL Y LA MÚSICA DE FULANO — Teatro Mauri SCD — 20:00
- DE ROMPER SUS PÉTALOS + ROMPEOLA + DUERME Y CAE + LACTOSA INTOLERANTE — Club Segundo Piso — 21:00

Fuente:
https://portaldisc.com/tickets/R05

### Passline — fuentes primarias públicas

Trotamundos Valparaíso lista para hoy:

- Las Vidas de Charly — 20:00
- Camionero — 22:00
- La Rosa + Llaneras del amor — 23:00

Fuente:
https://www.passline.com/venue/trotamundos-valparaiso

Además:

- Fiesta de Halloween - Averno — Bar La Playa — 19:00

Fuente:
https://www.passline.com/eventos/fiesta-de-halloween-averno

### Vesti — fuente primaria pública

Studio Valparaíso publica:

- STUDIO VALPARAISO presenta VIERNES UNIVERSITARIOS | VIERNES 23 OCTUBRE 2026

La página visible lo representa con instante sábado 24 a la 01:00, pero el título y la conversión a Chile corresponden a la noche del viernes 23.

Fuente:
https://vesti.cl/company/studio-valparaiso

### Cinzano — fuente oficial

Cinzano publica:

- Orquesta Cinzano - Viernes 23 de octubre

Fuente:
https://cinzanooficial.cl/eventos

## Conclusión

Antes de Instagram y locales menores, existen ya del orden de **12+ eventos verificables** para la noche del viernes en Valparaíso.

Por tanto, una portada con ~5 eventos es **déficit de cobertura/ingestión**, no evidencia de baja actividad.

## Causa estructural probable

### 1. Passline no forma parte de la ingesta automática

En `lib/sources/registry.ts`:

`passline-region` está marcado como:

- accessMode: blocked

La razón histórica es Cloudflare 403 a clientes automatizados.

No se debe evadir esa protección.

Consecuencia:
muchos eventos vendidos exclusivamente por Passline nunca llegan por el cron automático.

### 2. Vesti regional figura como manual

`vesti-region` está registrado como manual.

Existe un adaptador `vesti-company` que sí puede leer perfiles concretos y ya se usa para rutas específicas, pero la cobertura por local es mínima.

### 3. Cobertura por local extremadamente pequeña

`data/venue-routes.json` contiene rutas específicas para sólo unos pocos locales, mientras el catálogo tiene 147.

El catálogo completo NO equivale a cobertura automática completa.

### 4. Muchas fuentes son review-only

TicketPlus, ComedyPass, ComediaTicket, Cinzano y otras fuentes de nivel C no publican solas.

Esto es correcto para integridad, pero si la cola humana no se procesa diariamente, el producto parece vacío aunque los eventos hayan sido descubiertos.

### 5. Cinzano sigue contenido/pausado

Tras conflictos previos de disponibilidad/precio, Cinzano quedó en revisión.

La contención fue correcta, pero requiere una política de recuperación para no perder programación válida indefinidamente.

### 6. Instagram/Apify está pausado

La mayor parte de los locales independientes anuncia primero en Instagram.

Con Apify pausado, ese universo no participa en la actualización.

El presupuesto autorizado sigue siendo:

- target mensual: US$2,50
- hard cap: US$3,00

No hay razón presupuestaria para tenerlo indefinidamente inutilizado; sí debe completarse el incremental/watermark antes de reactivarlo.

### 7. Frecuencia de fuentes

El endpoint cron corre cuatro veces al día, pero muchas fuentes tienen `refreshHours: 24`.

Por lo tanto, “4 crons diarios” NO significa “cada fuente se revisa cuatro veces al día”.

Una cartelera puede anunciar un viernes por la tarde algo que el sistema no vuelva a leer hasta el día siguiente.

### 8. El mecanismo de urgencia actual depende de eventos ya conocidos

`sourcesWithEventsSoon()` acelera una fuente cuando ya existe un evento suyo en los próximos 3 días.

No ayuda con eventos NUEVOS que todavía no están en la DB.

Esto crea un punto ciego precisamente para anuncios de última hora.

## Decisión de producto/operación

Cobertura pública es P0.

Mientras exista un déficit evidente de eventos:

1. congelar cambios visuales no críticos;
2. reparar ingestión/cobertura;
3. limpiar cola review;
4. actualizar snapshot;
5. recién después continuar polish.

## Trabajo para Claude — ingeniería

### A. Observabilidad de cobertura

Crear un reporte/endpoint interno que entregue por fecha/comuna:

- public_events;
- review_events;
- fuentes leídas en últimas 6/12/24 h;
- fuentes con error;
- fuentes postergadas;
- lugares conocidos sin ruta;
- candidatos descubiertos pero no publicados;
- última actualización por source_id.

Debe ser usable por Work/operación y tests.

No exponer secretos.

### B. Health gate

Implementar una señal de cobertura degradada.

No usar un número fijo como “si <10 está mal” sin contexto.

Comparar:

- cantidad pública;
- cantidad en review;
- fuentes críticas exitosas;
- fuente regional PortalTickets;
- edad del snapshot;
- número de fuentes core leídas.

Si PortalTickets no fue leído con éxito en las últimas 12 h durante jueves/viernes/sábado:
estado degraded.

Si hay candidatos actuales en review y la portada está baja:
estado review_backlog.

### C. PortalTickets

Verificar inmediatamente:

- última corrida de `portaldisc-region`;
- candidates;
- queued;
- promoted;
- venue matching.

Los seis eventos listados arriba deben reconciliarse uno por uno.

Si alguno no se publica:
devolver razón exacta:
- venue desconocido;
- date_verified false;
- time;
- relevance;
- stale evidence;
- conflict;
- duplicate;
- parser.

Añadir fixture/regresión para cada causa real encontrada.

### D. Passline

NO saltar Cloudflare.

Implementar una estrategia legítima de cobertura:

1. mantener Passline como fuente primaria manual/bloqueada;
2. permitir que fuentes públicas de discovery aporten LEADS privados hacia URLs Passline;
3. jamás auto-publicar sólo desde un agregador;
4. si una URL primaria Passline ya está verificada por una persona, conservarla y permitir importación editorial trazable;
5. diseñar una cola “Passline hoy” para revisión humana rápida.

Añadir al menos los eventos de Trotamundos + Averno del 23-oct como casos de reconciliación, no como hardcode permanente.

### E. Vesti por local

Expandir `vesti-company` a todos los locales del catálogo que tengan perfil público verificado en Vesti.

No usar API privada.

Usar HTML/RSC público como el adaptador actual.

Prioridad:
- Studio Valparaíso;
- locales de Valparaíso/Viña que hoy estén en Vesti;
- después resto del corredor.

Añadir rutas versionadas con provenance.

### F. Evently por local

Hoy el host allowlist es demasiado estrecho.

Descubrir y verificar subdominios reales de locales del catálogo.

Agregar únicamente hosts exactos revisados.

No permitir wildcard `*.evently.cl`.

### G. Instagram incremental

Terminar el trabajo pendiente:

- leer watermark por cuenta;
- overlap seguro;
- no avanzar watermark en fallo;
- budget guard vigente;
- máximo US$0,05/run;
- hard cap mensual US$3.

Después habilitar una corrida piloto controlada.

Instagram sigue en review; nunca autopublica solo.

### H. Frecuencia adaptativa

Para fuentes regionales/ticketeras que sí soportan automatización:

- jueves/viernes/sábado: refresco objetivo 6 h;
- resto: 12–24 h según costo/estabilidad.

No golpear páginas innecesariamente.

La frecuencia debe basarse en tipo de fuente, no sólo en eventos ya conocidos.

### I. Night-date en fuentes

Crear regresiones explícitas:

eventos titulados “viernes 23” pero con timestamp UTC/local después de medianoche deben pertenecer a la noche correcta si la fuente lo expresa inequívocamente.

Ejemplo:
Studio viernes 23, inicio real ~22:00 Chile.

No cambiar fechas sólo por título si contradice un timestamp local inequívoco: registrar conflicto.

## Trabajo para Work/Supabase — operación

Leer la base REAL y devolver:

### Estado del día

Para 23-oct:

- públicos región;
- públicos Valparaíso;
- review región;
- review Valparaíso;
- rejected/cancelled;
- por source_id;
- por venue;
- sin venue_id;
- sin hora;
- sin source evidence.

### Ingestión últimas 48 h

`ingestion_runs`
`ingestion_source_runs`
`event_sources`

Por cada fuente:

- last_checked_at;
- last_success_at;
- next_check_at;
- consecutive_failures;
- items_found;
- candidate_count;
- unique_event_count;
- parse_failure_count.

### Reconciliar candidatos primarios del 23-oct

Comprobar uno por uno los eventos enumerados en este documento.

Clasificar:

- PUBLIC_OK
- REVIEW_READY
- MISSING
- CONFLICT
- DUPLICATE
- CANCELLED

Para REVIEW_READY con fuente primaria suficiente:
aprobar con auditoría humana.

Para MISSING:
insertar sólo mediante flujo trazable (editorial/import), no SQL improvisado sin provenance.

### Ejecutar cron final

Después de correcciones:

- corrida autenticada;
- engine reevaluate;
- refresh snapshot;
- comprobar DB → /api/snapshot → web.

## Trabajo para Antigravity

Ventana:
23-oct a 30-oct.

Prioridad:
Valparaíso, Viña, Quilpué, Villa Alemana.

Buscar programación faltante en:

- sitios oficiales;
- ticketera primaria;
- Instagram oficial accesible públicamente;
- páginas oficiales de productoras.

Entregar:
- primary URL;
- fecha;
- hora;
- venue;
- comuna;
- precio;
- status;
- evidence type;
- si ya aparece o no en Dónde Salgo.

No publicar.

## Trabajo para Gemini

Sólo discovery amplio.

No usar snippet como verificación.

Estados:
- PRIMARY_VERIFIED
- PRIMARY_FOUND_NOT_VERIFIED
- DISCOVERY_ONLY

## Criterio de recuperación

Para hoy no hay un “número mágico”, pero el sistema NO puede declararse sano si:

- PortalTickets regional no fue leído exitosamente;
- una mayoría de sus eventos de hoy no está pública ni en review;
- existen fuentes primarias de alto valor con múltiples eventos ausentes;
- la cola review contiene eventos de hoy sin revisar;
- snapshot >6 h;
- ningún mecanismo recoge Passline/Vesti/Instagram.

## Criterio de salida del incidente

PASS cuando:

- PortalTickets 23-oct reconciliado 100%;
- DB/snapshot/web coinciden;
- review de hoy procesada;
- Passline de hoy cubierto mediante flujo humano verificable;
- Vesti Studio correcto;
- Cinzano resuelto;
- source health observable;
- Apify incremental listo o explícitamente no necesario;
- la portada refleja razonablemente la oferta verificable del día.

La meta NO es inflar números.

La meta es evitar que eventos reales y verificables desaparezcan por huecos de infraestructura.
