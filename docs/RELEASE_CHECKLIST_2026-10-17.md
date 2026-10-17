# Lanzamiento: verificación del 17 de octubre de 2026

## Actualización tras acceso por navegador (prevalece sobre la línea base)

El dueño inició sesión en el panel Supabase del proyecto canónico. El conector
MCP sigue rechazando acceso, pero el SQL Editor autenticado sí funciona.

**Hecho y verificado en la base:**

- Tres respaldos tenían RLS desactivada y SELECT para anon/authenticated.
  Se habilitó RLS y se revocaron esos permisos sin borrar filas. La consulta
  final no encuentra tablas regulares de `public` sin RLS.
- Migración Instagram v2 aplicada y registrada como `20261016120000`; registro
  privado, cinco columnas v2 comprobadas y job diario de purga activo.
  Hardening registrado en `20261017034717_protect_private_backups.sql`.
- Siembra insert-only desde el maestro: 90 handles distintos (92 filas de
  entrada), reconciliados por slug con los IDs reales. Resultado inicial:
  61 activos vinculados a lugares publicados, 21 candidatos, 8 rechazados.
  El descubrimiento del benchmark agrega una candidata: quedan 22.
  No se inventaron handles ni se activaron hipótesis de Gemini.
- Barrido existente ejecutado: cero vencidos en cola; quedan **3 revisiones
  vigentes**, que se conservan privadas. No se aprobó la cola para vaciarla.
- Importador existente ejecutado mediante pase de un uso: HTTP 200,
  `editorialInsertados=11`. El mecanismo existente dejó la fila vieja de Mad
  Professor como duplicada y la ficha corregida pública.
- RPC `review_item` probado con guardado sin cambio de contenido y revisión
  obsoleta: una sola nueva auditoría (688), revisión final 1. Esto prueba la
  operación de base; el login y envío del formulario de `/admin` siguen sin
  probarse de extremo a extremo con una credencial de moderador.
- Precio de Camila Moreno completado tras reabrir la misma fuente: $12.000
  más cargo; auditoría 689. Se corrigió también la referencia anterior del
  benchmark ($6.000 y otro slug). Seis fichas adicionales no pudieron
  reabrirse por fallos de conexión: sus precios siguen sin inventarse.

**Observado públicamente después del import:** 104 eventos vigentes, **18 hoy
y 2 mañana**, 147 lugares. Se comprobó en navegador Mañana → Mad Professor:
18:00, general $23.000, dirección y enlace PortalTickets. Los 18 eventos del
benchmark están presentes; esto no implica cobertura exhaustiva de la región.

**Benchmark Apify ejecutado con autorización explícita de US$0,50 total:**

| Actor | Tiempo | Elementos | Posts retenidos | Cuentas leídas | Costo USD |
|---|---:|---:|---:|---:|---:|
| instagram-scraper | 38 s | 13 | 9 | 4/5 | 0,0270 |
| instagram-post-scraper | 28 s | 13 | 8 | 4/5 | 0,0324 |

Total **US$0,0594**. Ambos omitieron `manda.chile`; eso no demuestra cierre
ni inexistencia. La unión tiene 10 posts únicos privados, **0 candidatos
marcados como evento y 0 completos**; 2 requieren visión. No se publicó
ningún evento desde Instagram. El resultado no justifica activar una cadencia
pagada. Piloto A/B y benchmark de visión siguen pendientes; no se gastó en ellos.

**Implementado en PR, aún sin desplegar en producción:** incremental A/B por
marca `last_post_at`, ventana máxima de siete días y solape de un minuto;
solamente cuentas activas. BENCH conserva siete días para comparar actores.
Las marcas avanzan tras guardar la evidencia; no retroceden y no avanzan si
se alcanza el tope de tres posts, porque puede quedar historial sin leer.
La cuenta saturada se informa para una pasada manual más amplia. Sin cron
pagado nuevo. Verificación local: 170 pruebas más lint, tipos, build y auditoría
de producción. El CI remoto debe confirmar la revisión nueva de la PR.

**Bloqueo GPS encontrado en la verificación HTTP:** la política global de
producción/configuración original es `geolocation=()`, que deniega el permiso
incluso si la persona quiere concederlo. La PR la cambia a
`geolocation=(self)` y mantiene cámara/micrófono bloqueados. La solicitud
continúa limitada por el flujo de Radar existente. Incluye regresión de la
cabecera: 170 pruebas. GPS real sólo podrá cerrarse tras desplegar y probar
en un navegador/teléfono con permiso concedido.

**URL oficial pendiente de decisión/configuración:** las dos URLs responden
por HTTP, pero `dondesalgo.vercel.app` aún declara canónica a
`carreteando.vercel.app`. El navegador de esta sesión rechazó una conexión al
alias de la marca; no se declara resuelto. Mantener una sola dirección
canónica y redirigir la antigua al adoptar la URL oficial. No se compró dominio
ni se modificó DNS o configuración de producción en esta pasada.

Evidencia en `docs/qa/`: capturas de RLS, migración, auditoría, importación,
benchmark, cartelera móvil y ficha pública; snapshots antes/después y respuestas
del benchmark. Las secciones siguientes conservan la línea base previa al login.

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
- Tras la reconexión informada por el dueño se repitió una consulta de lectura:
  mismo rechazo de permisos; `list_projects` sigue vacío y `get_project`
  también deniega acceso. El navegador de esta sesión no tiene sesión abierta
  en el panel Supabase. No se modificó la base.

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
- CI remoto de la PR #2 aprobado para `7b14f2f`; preview Vercel compilado:
  `https://carreteando-git-fix-release-readiness-oct17-neuroxel.vercel.app`.
  La protección redirige a SSO; el token local no permite entrar y el conector
  devuelve 403 al solicitar acceso temporal. Se probó la app local y la
  producción pública, pero no se verificó el contenido del preview protegido.
- Durante la revisión local aparecieron dos errores `fetch failed / ECONNRESET`
  en el servidor, sin URL identificada en el mensaje. No se atribuyen a la
  base ni se declaran resueltos; snapshot y render principal respondieron.
- Regresión con petición autenticada simulada: registro inaccesible implica
  exactamente una lectura, ningún armado consumido y ninguna llamada Apify.
- Navegador real en producción: Radar abre en Carretes hoy, muestra estrellas
  y 7 lugares geolocalizados de 8 eventos; Boliches cambia a 86 de 147 lugares.
  El mapa queda por encima del menú inferior en viewport 390×844.
- Carretes vuelve a lista desde Radar; Mañana muestra 1 plan. Mapa cargado sin
  errores de consola observados. GPS no disponible en este navegador: se
  verificó el fallback, no una lectura GPS real ni un teléfono físico.

## Checklist pendiente, en orden

- [x] Restablecer acceso administrativo al mismo proyecto Supabase, sin
  compartir claves en chat ni cambiar permisos públicos.
- [x] Consultar estado real de eventos/editoriales, cola, auditoría,
  `automation_config`, historial de migraciones y cron. Guardar conteos antes.
- [x] Ejecutar el importador existente de forma insert-only para los 11
  editoriales, verificando no duplicar ni reactivar retiros. Comprobar después
  snapshot, ficha y enlace de fuente; resolver precios de filas existentes
  sólo mediante moderación auditada.
- [x] Barrer vencidos con el mecanismo existente y verificar cero vencidos
  en cola vigente. Probar una transición administrativa reversible y su
  `review_audit` antes de declarar admin funcional.
- [x] Revisar y aplicar `20261016120000_instagram_ingestion_v2.sql` si falta;
  verificar columnas, RLS, permisos privados y cron de purga. Reconciliar
  maestro contra IDs canónicos; las filas dudosas siguen candidatas.
- [x] Ejecutar benchmark acotado sólo tras comprobar esquema,
  armado y topes existentes. Nada se publica desde Instagram automáticamente.
- [x] Implementar y probar incremental por cuenta en la PR.
- [ ] Revisar/desplegar incremental y medirlo en una corrida autorizada.
- [ ] Evaluar piloto A/B y visión sólo si se justifica por utilidad editorial.
- [x] Confirmar compilación del preview y CI de esta PR.
- [ ] Revisar el contenido del preview protegido antes de fusionar main.
- [ ] QA final del despliegue aprobado: móvil físico, GPS permitido/denegado,
  atrás/adelante, aporte privado, detalle/fuente y medición de cero peticiones
  de datos adicionales en filtros/lista/mapa. No se volvió a medir la red
  completa en esta pasada.
- [ ] Publicar sólo después de comprobar importación y recuperación de admin.

La ausencia de eventos el 19 no demuestra ausencia de oferta. La investigación
de cuentas de Gemini sigue con 96 recintos pendientes; no sustituye evidencia
actual ni justifica crear lugares automáticamente.
