# Donde Salgo — recuperación de Supabase (11-nov-2026)

## Estado comprobado con conectores

- **Proyecto nuevo**: `dondesalgo`, ref `iwyvvopyivycsvktuinh`; organización **Neuroxel**, `tlzusgrpufisdbaptgvr`; `sa-east-1`, PostgreSQL 17.11, `ACTIVE_HEALTHY`.
- **Costo de creación**: Supabase confirmó **US$0/mes** en la organización Free antes de crear el proyecto. No se activaron servicios pagos.
- **Esquema nuevo**: **0 tablas de aplicación** en `public` al verificar el 11-nov; **NO conectado** a la web y **NO restaurado**.
- **Proyecto histórico identificado por la documentación**: `hgwljbtqdserkdhulbts`. La cuenta actualmente conectada a ChatGPT devuelve permiso denegado cuando se intenta leerlo, y lista 0 proyectos previos. **No implica eliminación**.
- **Vercel accesible**: equipo `Neuroxel` → proyecto `carreteando` con dominio `dondesalgo.vercel.app`; producción señalada en deployment `dpl_5dCb18y4Tum7N6w1nUjp3ThhzmMM` (commit `02dc445d`, READY). Las variables de entorno para Supabase siguen configuradas. No se tocaron sus valores.
- **Dominio personalizado**: `dondesalgo.cl` no aparece en los dominios consultados del proyecto `carreteando`. Hubo comprobaciones de GitHub para otro proyecto Vercel denominado `dondesalgo` bajo otra cuenta; **no asumir** que el Vercel accesible es el despliegue final del dominio .cl.

## Decisión de seguridad y continuidad

**Nueva base = recuperación aislada, NO reemplazo automático.** La instancia original puede seguir sirviendo la web. No cambiar variables de entorno, dominios, DNS, cron ni promover PR antes de conseguir:

1. Acceso de solo lectura a base histórica `hgwljbtqdserkdhulbts`, o un dump comprobable y autorizado; en su defecto, reconstrucción explícita y documentada con fuentes disponibles.
2. Inventario exacto de migraciones `supabase/migrations/` con su orden, extensiones y dependencias; aplicación a una base vacía en entorno aislado; registro de migration history.
3. Copia de **datos** (no solamente esquema): `venues`, `events`, `event_sources`, `ingestion_source_runs`, configuración de moderación/automatización, alias, fuentes, cuentas Instagram y decisiones históricas permitidas; excluir credenciales/sesiones privadas sin un plan de rotación.
4. Control de identidad por slug/alias/dirección/comuna, RLS, funciones, secuencias, índices, políticas de publicación, zonas, mapas, dedupe y conteos por estado, con comparación entre origen y destino.
5. Pruebas en preview con URL/anon key de nueva base SOLO para preview; secretos server-side en Vercel, nunca en Git ni chat. Quitar o redirigir cron hasta que haya validación para no crear eventos falsos ni notificaciones dobles.
6. Reconciliación editorial con Gemini/Claude del 10–11 nov: nunca importar los 36/34 ni los 115 registros sin revisión de colisiones y fuente individual de evento.
7. Swap controlado de variables de producción y rollback documentado, **solo después** de aprobar las pruebas y verificar el dominio que sirve la web real.

## Primer gate verificable

**G0 — PROVISIONED = PASS**: proyecto Free creado y consultable, PostgreSQL saludable, 0 tablas de app.

**G1 — SCHEMA RESTORED = PENDING**: no asumir que una migración aislada reconstruye el esquema completo. El repo contiene migraciones incrementales que esperan estado previo.

**G2 — DATA RECONCILED = PENDING**: no existe todavía un dump verificado de la base histórica accesible mediante la cuenta autorizada.

**G3 — PREVIEW VERIFIED = PENDING**; **G4 — PROD CUTOVER = BLOCKED**.

## Prioridad inmediata

Intentar recuperar acceso al proyecto histórico (cuenta/organización original o respaldo), preparar baseline reproducible desde repo y ejecutar pruebas contra la base aislada. Hasta G3, continuar la investigación y PR #60 con fuente fechada y sin afectar producción.
