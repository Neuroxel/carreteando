# Lanzamiento: verificación del 17 de octubre de 2026

## Decisión

**No declarar release cerrado.** Hay lectura pública funcional, pero no acceso
administrativo verificado, la importación editorial sigue pendiente y falta
confirmar migración, cola privada y auditoría. No se importó ninguna fila nueva.

## Estado canónico recuperado

- Repo: `Neuroxel/carreteando`, `origin/main` en
  `14727418c72af30f02e324a4259dcfb0ff45757e` al iniciar esta pasada.
- Se leyeron los chats «Aplicación regional de eventos» y «Continuar lanzamiento
  app», su adjunto `Texto pegado.txt` y `sources/Trabajo-de-Gemini.txt` del
  proyecto Donde Salgo. Las fuentes sincronizadas permanecieron intactas.
- Los cambios de Carlos e Instagram v2 ya están integrados en main; no se
  volvieron a fusionar ramas antiguas.
- Vercel `get_project` devuelve producción READY,
  `carreteando-9nbwu8rmq-neuroxel.vercel.app`. El listado detallado de despliegues
  devuelve 403 para el equipo Neuroxel. GitHub confirma éxito de Vercel para
  `1472741`; eso no sustituye el CI, que fallaba en auditoría de dependencias.
- Supabase: consulta SQL directa a `hgwljbtqdserkdhulbts` denegada por permisos.
  REST público sí responde. La configuración local contiene clave pública,
  no clave administrativa. `review_audit` responde 401/42501;
  `instagram_accounts` responde 404/PGRST205 en la caché REST. Esto no prueba
  por sí solo la ausencia física de la tabla: hay que inspeccionar esquema y
  migraciones con acceso administrativo.

## Observado en producción

Snapshot público guardado en `docs/qa/production-snapshot-2026-10-17.json`,
generado a las 03:31:58 UTC (00:31:58 Chile): 93 eventos, 147 lugares.

| Fecha Chile | Eventos públicos |
|---|---:|
| 17 octubre | 8 |
| 18 octubre | 1 |
| 19 octubre | 0 |

El benchmark editorial de hoy encuentra 8 de 18 eventos públicos; sólo 1 de
los 8 tiene precio conocido. De 10 eventos hasta $5.000, aparecen 3 y sólo 1
tiene precio conocido. Ver `docs/qa/coverage-2026-10-17.txt`.
No interpretar el precio numérico 0 como gratis si `precio_conocido=false`.
Los 11 eventos preparados en el feed editorial no están todavía en este
snapshot. El cron esperado a las 15:00 Chile es una dependencia pendiente,
no una importación observada.

## Implementado en esta rama

- Next.js y su configuración ESLint 15.5.28; lockfile con sharp 0.35.5 y
  source-map-js 1.2.2. Se conserva la arquitectura existente.
- La procedencia `adapter` se expone como `web`, en vez de atribuirla a
  Instagram. Se conserva URL y etiqueta de confianza existentes.
- El piloto comprueba lectura del registro privado antes de consumir el
  armado o iniciar Apify. Un fallo del registro devuelve 503 sin gasto.
- Sin cambios de datos, reglas de publicación, esquema ni cron pagado.

## Probado

- `npm run verify`: 167/167 pruebas, lint, tipos, build y auditoría de
  dependencias de producción aprobados; 0 vulnerabilidades de producción.
- La auditoría completa conserva 5 hallazgos altos encadenados a `braces`
  en herramientas de desarrollo. No se aplicó la propuesta automática de
  degradar ESLint a otra versión mayor. No afirmar auditoría total limpia.
- Build local iniciado y `/api/snapshot` responde 200 con 93 eventos y 147
  lugares; una fila PortalDisc ahora devuelve `fuente=web`.
- Regresión con petición autenticada simulada: registro inaccesible implica
  exactamente una lectura, ningún armado consumido y ninguna llamada Apify.
- Navegador real en producción: Radar abre en Carretes hoy, muestra estrellas
  y 7 lugares geolocalizados de 8 eventos; Boliches cambia a 86 de 147 lugares.
  El mapa queda por encima del menú inferior en viewport 390×844.
- Carretes vuelve a lista desde Radar; Mañana muestra 1 plan. Mapa cargado sin
  errores de consola observados. GPS no disponible en este navegador: se
  verificó el fallback, no una lectura GPS real ni un teléfono físico.

## Checklist pendiente, en orden

- [ ] Restablecer acceso administrativo al mismo proyecto Supabase, sin
  compartir claves en chat ni cambiar permisos públicos.
- [ ] Consultar estado real de eventos/editoriales, cola, auditoría,
  `automation_config`, historial de migraciones y cron. Guardar conteos antes.
- [ ] Ejecutar el importador existente de forma insert-only para los 11
  editoriales, verificando no duplicar ni reactivar retiros. Comprobar después
  snapshot, ficha y enlace de fuente; resolver precios de filas existentes
  sólo mediante moderación auditada.
- [ ] Barrer vencidos con el mecanismo existente y verificar cero vencidos
  en cola vigente. Probar una transición administrativa reversible y su
  `review_audit` antes de declarar admin funcional.
- [ ] Revisar y aplicar `20261016120000_instagram_ingestion_v2.sql` si falta;
  verificar columnas, RLS, permisos privados y cron de purga. Reconciliar
  maestro contra IDs canónicos; las filas dudosas siguen candidatas.
- [ ] Ejecutar benchmark y piloto acotados sólo tras comprobar esquema,
  armado y topes existentes. Nada se publica desde Instagram automáticamente.
- [ ] Completar incremental por cuenta: hoy se guarda `last_post_at`, pero
  el actor aún pide una ventana fija de 7 días. No llamarlo incremental listo.
- [ ] Confirmar preview y CI de esta PR; revisar antes de fusionar main.
- [ ] QA final del despliegue aprobado: móvil físico, GPS permitido/denegado,
  atrás/adelante, aporte privado, detalle/fuente y medición de cero peticiones
  de datos adicionales en filtros/lista/mapa. No se volvió a medir la red
  completa en esta pasada.
- [ ] Publicar sólo después de comprobar importación y recuperación de admin.

La ausencia de eventos el 19 no demuestra ausencia de oferta. La investigación
de cuentas de Gemini sigue con 96 recintos pendientes; no sustituye evidencia
actual ni justifica crear lugares automáticamente.
