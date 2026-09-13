# Operación, moderación y recuperación

## Entornos y secretos

Vercel usa Neuroxel/carreteando main. `SUPABASE_SECRET_KEY` debe ser una clave `sb_secret_...` nueva y sólo server-side. El JWT service_role publicado históricamente se considera comprometido permanentemente. La ausencia de ese JWT en HEAD no prueba su revocación: comprobar el estado de la clave legacy en el dashboard y deshabilitarla mediante el flujo de seguridad autorizado antes de apertura pública.

Los secretos nunca se copian a respuestas, logs o Git. Para desarrollo basta clave pública Supabase; sin credenciales administrativas los formularios devuelven 503, sin fingir éxito. El conector de inventario puede devolver vacío aunque get_project por ID funcione. Proyecto Supabase observado: hgwljbtqdserkdhulbts.

## Revisar eventos detectados

Usar el dashboard Supabase con una sesión administrativa. Consultar `ingestion_runs`, `ingestion_posts` y `events` pendientes. No hay panel público de administración.

1. Abrir la publicación original, contrastar fecha del evento (no fecha del post), lugar, ciudad y pertinencia nocturna. Revisar flyer y caption cuando sea posible. Registrar ambigüedad y mantener pendiente si falta evidencia.
2. Comparar otros posts del mismo recinto/noche: `event_key` agrupa estos candidatos conservadoramente. Dos eventos legítimos en una misma noche requieren separación explícita del revisor; nunca suponer que cada anuncio de artista es un evento nuevo.
3. Completar los campos conocidos: `venue`, `city`, `address`, `event_time`, `price_clp`, `price_text`, `category`. No copiar una dirección supuesta ni un precio de bebida. Conservar los posts crudos como evidencia y usar un nombre de evento claro.
4. En una transacción, actualizar la fila exacta a `moderation_status='approved'`, `is_active=true`, `reviewed_at=now()`, `last_verified_at=now()` únicamente si la fecha sigue vigente. Mantener `organizer_verified=false` salvo evidencia directa del organizador. La revisión humana es una acción real; no registrar `last_verified_at` en un mero fetch.
5. Para rechazar: `moderation_status='rejected'`, `is_active=false`. Para retirar/cancelar: `is_active=false`, conservar la evidencia. No borrar históricos.
6. Verificar `/api/eventos`, la URL exacta del evento, fuente, esquema y sitemap después de aprobar. Las lecturas usan no-store: no hay que regenerar una caché de eventos.

## Revisar envíos y reportes

`community_inbox` es privada, sólo servidor/administración. Consultar pendientes por `created_at`. El payload conserva la propuesta original; `status`, `reviewed_at`, `review_note` y `event_id` permiten registrar resolución.

- **Submission:** contrastar fuente, fecha, scope y duplicados; insertar el evento canónico aprobado y enlazar `event_id` a la propuesta en una transacción. `instagram_id` puede ser `community-<uuid de la propuesta>` (estable). `source='manual'`. No reutilizar un `client_id` externo. Completar los campos estructurados y dejar precio null si es desconocido.
- **Report:** abrir evento y fuente; corregir/retirar sólo con evidencia, resolver el reporte y guardar nota. Un reporte no altera por sí solo la cartelera.
- No hay SLA ni notificación automática. Asignar un responsable diario de la bandeja antes de abrir la beta.

## Antiabuso y privacidad

Servidor valida tipos, longitudes, URLs http/https sin credenciales, fecha hasta 180 días, zonas, categoría y precio entero. Body máximo 16 KiB leído por streaming. Honeypot, comprobación de Origin si está presente y límites persistentes: 3 envíos por identificador diario/IP por hora y 100 envíos globales/día. Dedupe durante 7 días. RPC sólo service_role; usa advisory lock para atomicidad entre instancias.

Se usa x-vercel-forwarded-for, sobrescrito por Vercel, con HMAC diario. No hay IP cruda en inbox. La cuota global limita inserciones, no ataques de tráfico contra la función; poner reglas WAF y Turnstile con validación server-side antes de una campaña pública. No se instaló CAPTCHA sin las claves/sitio correspondientes. El hash rota a medianoche UTC: el límite por persona puede reiniciarse en ese borde. IP compartida/NAT puede afectar usuarios legítimos.

Definir y ejecutar retención para reportes cerrados, hashes y posts crudos antes de escala. No existe aún un trabajo de purga automática. No se envían eventos a proveedores de analítica. Al abrir fuentes, mapas o cargar flyers, se contactan servicios externos.

## Ingesta controlada

El cron diario está en `vercel.json` (18:00 UTC; su hora local cambia con DST). Autenticación Bearer con CRON_SECRET, incluso en desarrollo. Vercel dashboard → Settings → Cron Jobs → Run permite ejecutarlo sin exponer la credencial. Nunca llamar a una URL que lleve el token como query string.

- Siete cuentas en `lib/ingestion.ts`. Sin parentData ni expansión por colaboradores/hashtags. `APIFY_NEWER_THAN` se ignora intencionalmente; ventana fija de 3 días y rechazo local de posts de más de 7 días. Límite por cuenta 3 por defecto, techo 5.
- El proveedor recibe timeout 180 s, maxItems 40 y maxTotalChargeUsd=1. La facturación final depende del actor/proveedor; revisar `cost_usd`, no asumir que el tope solicitado garantiza toda la factura.
- Reserva persistente de 6 horas desde cualquier intento, incluidos errores. Evita duplicación accidental de cobro. Para recuperar una ejecución fallida, revisar su run/dataset de Apify y el error antes de decidir un nuevo intento; no resetear el cooldown a ciegas.
- `events_saved` cuenta candidatos insertados, **no eventos aprobados**. `public_events_added` es siempre 0 durante ingesta. Duplicados y posts ya procesados quedan contabilizados; no se reactivan filas históricas por upsert.
- `ingestion_posts` guarda caption, autor real, fecha de publicación, fuente y outcome; no guarda seguidores, asistentes ni el objeto completo de Apify.
- Revisar muestras con etiquetas TRUE EVENT / FALSE POSITIVE / DUPLICATE / WRONG DATE / WRONG LOCATION / AMBIGUOUS. Precisión = verdaderos / candidatos revisados; informar ambiguos y tamaño muestral. Coste por evento válido único público = coste facturado / nuevos eventos revisados y publicados. Con denominador 0 no hay coste unitario finito estimable.

## Despliegue y rollback

Ejecutar `npm run verify`, revisar diff y publicar commits normales en el fork autorizado. Esperar CI y Vercel Ready; comprobar SHA en dashboard y API pública. Git push no implica despliegue aceptado.

Un revert del código mantiene las tablas y evidencia. No revertir a la implementación anterior de publicaciones o a RLS que sólo comprobara is_active. En emergencia, mantener la política estricta y cerrar temporalmente escrituras desde Vercel. Las migraciones son aditivas; no desmontar el esquema ni borrar históricos para deshacer diseño visual.

## Fuentes técnicas usadas

- [Supabase: RLS y vistas](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel: headers de IP](https://vercel.com/docs/headers/request-headers)
- [Apify: ejecución de actores y límites](https://docs.apify.com/api/v2/actors-runs-post)
- [Next.js: metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
