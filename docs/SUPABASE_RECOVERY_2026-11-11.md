# Donde Salgo — Supabase: base histórica recuperada (11-nov-2026)

## Estado canónico verificado con conectores

**Hallazgo decisivo:** el usuario conectó un tercer espacio de Supabase llamado **Tpotp**, que contiene la base original de Donde Salgo. **No está perdida ni requiere reconstrucción**.

| Elemento | Valor / estado |
|---|---|
| Base histórica | `carretes`, project ref `hgwljbtqdserkdhulbts` |
| Organización original | `tpotp's Org` (ID `ltbtwuswszvmjxztayle`) |
| Conexión ChatGPT con acceso | `Tpotp` |
| Región, motor | `sa-east-1`, PostgreSQL 17.6 |
| Estado | `ACTIVE_HEALTHY`; acceso SQL de lectura CONFIRMADO |
| Base nueva auxiliar | `dondesalgo`, `iwyvvopyivycsvktuinh`, organización `Neuroxel` (`tlzusgrpufisdbaptgvr`) |
| Costo nueva base | `US$0/mes` confirmado al crear, Free; `ACTIVE_HEALTHY` y **0 tablas de app** |
| Cutover | **NO realizado ni necesario**; no tocar secretos, variables, cron, DNS ni dominios |

La confusión anterior fue **de organización y conexión**, no pérdida de datos. Las conexiones `Supabase` y `Neuroxel` ven solo la organización Neuroxel; `Tpotp` ve la organización distinta `tpotp's Org` y su proyecto `carretes`.

### Inventario SQL de la base original, 11-nov-2026 (hora Chile)

Consultas de solo lectura en `carretes`; cifras reales SQL salvo donde se indique expresamente:

- **25 tablas públicas** con RLS activado.
- **416 recintos totales**: 148 `is_active=true` y `moderation_status='approved'`; 103 con latitud y longitud (incluye filas no publicadas).
- **712 eventos totales**: 82 activos, aprobados y con `date_text` ISO desde el 11-nov-2026 inclusive. **34** `pending` con `disposition='review'` (no publicados), además de históricos expirados.
- Distribución de 148 recintos públicos: Valparaíso 68; Viña del Mar 35 + Reñaca 4; Quilpué 9; Concón 8; Quillota 6; Quintero 5; Limache 4; La Calera 3; Villa Alemana 3; Olmué 2; Puchuncaví 1.
- Distribución de 82 eventos públicos futuros: Valparaíso 51; Viña del Mar 22; Quillota 4; Villa Alemana 4; Concón 1.
- **56 fuentes registradas, 46 activas**; las 46 tienen `last_success_at` dentro de las últimas 48 h, pero esto solo certifica ejecución, no eventos nuevos.
- **1.930 registros de ejecuciones**, 458 en los últimos siete días y 53 en las últimas 24 h. Agregados de los últimos 7 días: **0 `new_events`** y **44 `queued`** (sumas de runs; no asumir 44 eventos únicos). La fuente `portaldisc-region` tuvo 13 colas; `evently-region` 8; `comediaticket-region` 8; `ticketplus-region` 6.
- Respaldos de reconciliación (entre otros): `backup_venues_valparaiso_20261012`, `backup_venues_valparaiso_queue_20261012b`, `backup_venues_vina_renaca_20261012`, `backup_events_review_20261012`, `backup_venues_ops_20261012`. También `review_audit`, `event_evidence`, `instagram_accounts`, `automation_decisions`.
- `pg_cron` existe. No se han ejecutado DDL/DML ni migraciones desde esta revisión.

### Diagnóstico y próximos pasos (en orden)

1. **No migrar ni cambiar el sitio**. Mantener `carretes` como estado canónico y `dondesalgo` de Neuroxel como entorno auxiliar vacío. Decidir el destino del segundo proyecto más adelante para evitar cuotas innecesarias o costes de oportunidad.
2. Verificar la conexión real del dominio `dondesalgo.cl` y los proyectos Vercel: Vercel `Neuroxel/carreteando` sí accesible, pero el proyecto `dondesalgo` de otro scope no lo era al revisar; no asumir que el primero administra `.cl`. Confirmar mediante configuración/DNS antes de cualquier cambio.
3. Auditar por qué las fuentes informan éxito y candidatos pero `new_events_7d=0`; inspeccionar errores de parseo/deduplicación/moderación/cola sin cambiar reglas a ciegas. Diferenciar `queued` agregado de filas únicas.
4. Reconciliar los hallazgos Gemini/Claude con 148 recintos públicos y 82 eventos próximos existentes; colisiones por comuna, venue y URL; incorporar solo fuentes individuales verificadas; revisar PR #60 antes de importar.
5. Revisar la cola de 34 `pending/review`, las fechas de verificación y la salud de frescura. No publicar masivamente ni activar Apify sin presupuesto autorizado.
6. Crear respaldo lógico (schema + data) autorizado y verificado **antes de** operaciones con riesgo. No copiar claves, tokens ni datos personales a Git.

## Gates

- **H0 ORIGINAL SUPABASE FOUND = PASS**; **H1 READ-ONLY SQL ACCESS = PASS**; **H2 INVENTORY = PASS**.
- **H3 INGESTION GAP EXPLAINED = OPEN**.
- **H4 EDITORIAL RECONCILED = OPEN**.
- **H5 PRODUCTION UPDATE = BLOCKED** hasta corroborar rutas y previsualización.
- **NEW EMPTY PROJECT**: existe, aislado y **no es la fuente canónica**. Cualquier propuesta anterior de sustituir automáticamente la base queda revocada.

## Vercel, última verificación

Vercel equipo `Neuroxel`, proyecto `carreteando`, dominio `dondesalgo.vercel.app`, production deployment `dpl_5dCb18y4Tum7N6w1nUjp3ThhzmMM` (READY, commit `02dc445d`). El dominio personalizado `dondesalgo.cl` no figuró en los dominios consultados de ese proyecto, aunque GitHub informó checks del proyecto externo `dondesalgo`. No modificar configuración hasta aclarar el dueño del dominio.
