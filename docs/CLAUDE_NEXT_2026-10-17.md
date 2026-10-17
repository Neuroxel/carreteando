# Claude — siguiente ejecución canónica (17-oct-2026)

Este archivo es una **cola de ejecución**, no un informe histórico. Partir siempre desde el `main` más reciente. No reconstruir el proyecto y **no mergear PR #2 completo**.

## 1. Instagram incremental

PR #2 conserva una implementación útil pero quedó sobre un `main` antiguo.

Crear un PR nuevo y portar sólo lo que siga vigente:
- `lib/instagram-pilot.ts`: inicio incremental, watermark seguro y solape;
- endpoint del piloto;
- tests de preflight/incremental.

Conservar sin regresiones:
- redirects canónicos;
- Radar/GPS;
- cobertura y dedupe de #6;
- provenance de #9.

Hechos a comprobar:
- `supabase/migrations/20261016120000_instagram_ingestion_v2.sql` ya está versionada en `main`.
- PR #2 registra históricamente migración v2 + 90 cuentas aplicadas y benchmark Apify por US$0,0594. **Revalidar en DB antes de asumirlo vigente.**
- Next 15.5.28 ya está en `main`; no repetir actualización.

No activar Apify recurrente sin un presupuesto mensual explícito.

## 2. Fuentes gratuitas siguientes

Prioridad:
1. ComedyPass, con host exacto y fixtures.
2. ComediaTicket, con host exacto y fixtures.
3. rutas oficiales directas que PortalDisc/Vesti/Evently no cubran.

Las fuentes nuevas entran por cola/revisión según política; no publicar automáticamente por descubrir una URL. Google sólo sugiere rutas.

No crear scraping directo de Instagram: Instagram sigue por Apify.

## 3. Datos ya reconciliados

### Debe comprobarse primero contra DB/ingesta automática

El lector regional de PortalDisc ya debería detectar:
- Emily Wittbrodt / Balmaceda Arte Joven — 23-oct 18:30 — ticket gratuito.
- Lucas Espinoza / Barbones Curauma — 23-oct 20:00 — $10.000 + cargo.
- Lanzamiento Testetenebris / Poseidón — 24-oct 21:00 — $5.000 + cargo — +18.

No agregar editorial duplicado si ya entraron por #6.

### Fuentes fuera de los adaptadores actuales

- Paola Molina / Barbones Curauma — 17-oct 20:00 — General $10.000; preventa $8.000 agotada. ComedyPass primario.
- Burlesque / Club Tendedero — 17-oct — anuncio oficial activo; hora y precio no confirmados.
- Tocata Brígida / Cervezocracia — 23-oct — DJ 19:00 vs tocata 20:00; precio numérico no confirmado.
- Don Carter / Barbones Curauma — 24-oct 20:00 — desde $10.000. ComediaTicket primario.
- Nu Metal Halloween Previa / Los Alquinta — 24-oct — General $4.000. **Hora en conflicto:** Passline header 20:30, cuerpo 21:00 y otro listado regional 19:00; usar `time:null` si no se resuelve.
- Woo/Sabawoo 17-oct ya está versionado: no duplicar.

### Evidencia válida, alcance por decidir

No publicar automáticamente como “carrete”:
- Muestras BAJ 20/21: gratuitas y confirmadas, pero son muestras de talleres.
- Pandoo Fest 24: evento familiar.
- OSNJ USM 24: sitio oficial confirma 19:00 y Campus Casa Central; no asumir Aula Magna hasta que el detalle lo confirme.

## 4. Reglas de evidencia

- Fuente primaria > índice/agregador.
- `NO_ANNOUNCEMENT_FOUND` no equivale a “no hay evento”.
- Ruta vacía no equivale a cierre.
- Ausencia de cartel “agotado” no equivale a `AVAILABLE`.
- Si dos campos primarios se contradicen, conservar conflicto y no escoger uno por intuición.
- Reconciliar siempre contra catálogo y DB antes de crear venue/evento.

## 5. Definition of done

Antes de merge:
- `npm run verify`;
- CI GitHub verde;
- preview Vercel verde;
- dedupe probado contra filas existentes en cualquier estado;
- ninguna ruta dudosa publica directo.

Después de merge y con DB accesible:
1. observar una corrida real de `/api/cron/scrape`;
2. comprobar snapshot + páginas visibles;
3. inspeccionar admin stale queue;
4. verificar que no hubo duplicados ni reactivaciones;
5. registrar métricas como mediciones parciales, nunca “cobertura total”.

## Bloqueo actual

En el chat coordinador del 17-oct, Supabase MCP reconoce el ID `hgwljbtqdserkdhulbts` pero responde **sin permiso**. No tocar DB desde un agente que no demuestre acceso efectivo.
