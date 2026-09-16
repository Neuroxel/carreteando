# Traspaso a Carlos

Hola Carlos. Este documento debería bastarte para revisar el proyecto completo
sin preguntarle nada a David ni leer los informes de fase.

Si algo aquí contradice un informe antiguo, **manda `CURRENT_STATE.md`**.

## 1. Qué es esto

Un producto de descubrimiento de vida nocturna para la Región de Valparaíso.
Una pregunta: «Estoy acá, ¿dónde salgo?». No vende entradas.

La idea que lo distingue de una ticketera: **los lugares son entidades de
primera clase**. Un bar existe aunque esta noche no tenga evento, y eso es
justamente lo que un usuario necesita a las 23:30 un martes.

- Producción: https://carreteando.vercel.app
- Repositorio: `Neuroxel/carreteando`, rama por defecto `main`
- Estado: **beta cerrada**

## 2. Mapa del repositorio

Lo que vas a querer encontrar primero:

| Qué | Dónde |
|---|---|
| Ingesta de eventos (despachador) | `lib/sources/dispatcher.ts` |
| Adaptadores de fuentes | `lib/sources/adapters/` |
| Registro de fuentes | `lib/sources/registry.ts` |
| Endpoint que dispara la ingesta | `app/api/cron/scrape/route.ts` |
| Cron de Vercel | `vercel.json` |
| Cron de Postgres | `cron.job` en la base (ver §5) |
| Migraciones de esquema | `supabase/migrations/` |
| Moderación (acciones) | `app/admin/actions.ts` |
| Moderación (pantalla) | `app/admin/page.tsx` |
| Validación de moderación | `lib/review-input.ts` |
| Modelo de lugares | `lib/venues.ts`, `lib/server-venues.ts` |
| Modelo de eventos | `lib/events.ts`, `lib/server-events.ts` |
| Mapa | `components/VenueMap.tsx`, `lib/map.ts` |
| Sistema visual | `app/globals.css`, `DESIGN_SYSTEM.md` |
| Carteles generados | `components/EventImage.tsx` |
| Analítica | `lib/metrics.ts`, `components/Metrics.tsx`, `app/api/medir/` |
| Respaldo | `scripts/respaldo.mjs` |
| Tests | `tests/` |

## 3. Arquitectura

Next.js 15 (App Router, React Server Components) sobre Vercel, con Supabase
(Postgres 17) como base. No hay backend aparte: las lecturas públicas van por
PostgREST con la clave publicable, y todo lo privado pasa por Server Actions
con el rol de servicio.

La seguridad se apoya en Postgres, no en la aplicación:

- **RLS activa** en todas las tablas. Lo que el público puede ver está definido
  por políticas, no por un `if` en el código.
- Las funciones de moderación son `SECURITY INVOKER` y sólo `service_role`
  puede ejecutarlas.
- La caducidad de eventos se resuelve **al leer**, comparando la fecha de
  Chile. No depende de que un cron corra: si la ingesta se cae tres días, la
  cartelera no muestra nada viejo.

## 4. Datos y modelo de confianza

Ver `CURRENT_STATE.md` para las cifras. Lo importante conceptualmente:

Cada lugar tiene una **disposición** obligatoria: `published`,
`needs_evidence`, `closed`, `duplicate` o `rejected`. Un `needs_evidence` debe
declarar qué falta, dónde se buscó, cuándo y cuándo se revisa otra vez. Un
*trigger* lo garantiza; no depende de que quien escriba se acuerde.

Los eventos tienen lo mismo (`public`, `review`, `expired`, `duplicate`,
`rejected`, `cancelled`).

**No se inventa nada.** Si no sabemos el precio, la tarjeta dice «Precio por
confirmar», no «Gratis».

## 5. Automatización

Un despachador, no un scraper. Cada fuente tiene su cadencia (24 o 48 h); el
despachador toma sólo las vencidas, como mucho 8 por pasada, normaliza,
deduplica contra lo publicado, aplica la política de confianza y escribe la
salud de cada fuente.

Se dispara desde cuatro trabajos de `pg_cron` en la propia base (11:00, 17:00 y
21:00 de Chile, más limpieza), porque **Vercel Hobby no acepta cron más de una
vez al día**. El cron diario de Vercel se mantiene como red de seguridad.

Autenticación sin secreto compartido: la base emite un pase de un solo uso en
`public.cron_tickets` (tabla del rol de servicio) y el endpoint lo canjea una
vez dentro de dos minutos.

Para inspeccionarlo:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select * from public.ingestion_source_runs order by started_at desc limit 20;
select id, last_success_at, next_check_at, consecutive_failures from public.event_sources;
```

**Publicar sin revisión** exige las cuatro condiciones juntas: fuente oficial de
un solo lugar conocido, fecha de un campo estructurado (no leída de una frase),
hora de noche, y que no exista ya la misma noche en el mismo lugar.

## 6. Cómo correrlo

```bash
npm install
npm run dev
```

Variables de entorno, **sólo por nombre** (los valores están en Vercel y no se
comparten por chat ni por correo):

| Nombre | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | lecturas públicas |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lecturas públicas |
| `SUPABASE_SECRET_KEY` | escrituras privadas (moderación, ingesta) |
| `ADMIN_ACCESS_TOKEN` | acceso a `/admin` |
| `CRON_SECRET` | cabecera del cron de Vercel |
| `APIFY_*` | proveedor pago, **pausado a propósito** (`APIFY_PAUSED=true`) |

Sin las claves de Supabase el sitio arranca pero no muestra datos.

```bash
npm test        # 80 pruebas
npm run lint
npx tsc --noEmit
npm run build
```

## 7. Qué acceso necesitas

| Recurso | Estado | Cómo |
|---|---|---|
| Repositorio | **invitación enviada a `tpotp` con permiso de escritura** | acéptala en GitHub → Notifications |
| Producción | nada que pedir: el sitio es público | https://carreteando.vercel.app |
| `/admin` | **tienes credencial propia a tu nombre** | David te la pasa por un canal privado (ver abajo) |
| Vercel | sólo si vas a desplegar | David te agrega al proyecto |
| Supabase | sólo si vas a tocar el esquema | David te invita al proyecto |

**No recibes la contraseña de David, y eso es a propósito.** Tienes la tuya:
entras como «Carlos» y cada cambio que hagas queda firmado con tu nombre en
`review_audit`. Si compartiéramos una sola clave, el registro no podría decir
quién hizo qué, que es justo para lo que existe.

David recupera tu credencial así (nunca por chat ni por correo):

```bash
security find-generic-password -s "Carreteando Moderador Carlos" -a carlos -w | tr -d '\n' | pbcopy
```

Si alguna vez hay que revocarla, es una línea y no afecta a nadie más:

```sql
update public.moderators set active = false where name = 'Carlos';
```

## 8. Cómo revisarlo

Ver `CARLOS_REVIEW_CHECKLIST.md`: catorce pruebas concretas, con las
limitaciones ya conocidas listadas para que no pierdas tiempo redescubriéndolas.

## 9. Moderadores con nombre — implementado

`review_audit` ya registra **quién**. Cada moderador tiene su propia credencial
en `public.moderators`, guardada sólo como resumen SHA-256: el token vive en el
Llavero del Mac de David y en un archivo 0600 fuera de Git, nunca en la base ni
en el repositorio.

La sesión lleva el nombre firmado con HMAC. Cambiarlo en la cookie invalida la
firma, así que nadie modera bajo el nombre de otro. El panel dice en pantalla
como quién estás moderando.

Lo que falta (P1, después del 18): **MFA**. Hoy es un token largo y aleatorio,
suficiente para dos personas de confianza, insuficiente para un equipo.

## 9b. Qué se publica solo (la pregunta de Carlos)

De 24 fuentes, **sólo 2 publican sin revisión**, y ninguna es Instagram:
Instagram no es fuente activa (el proveedor pago está pausado). Las dos son el
calendario oficial del propio local, y necesitan las cuatro condiciones de §5
juntas.

**Todo lo que manda la gente lo aprobamos nosotros.** Nunca se publica solo.

Contra flood, sin captcha: 3 envíos por hora por IP, 150 sin revisar por día,
duplicados por huella durante 7 días, cuerpo cortado a 16 KB, campo trampa y
RLS. Lo peor que puede pasar es una cola privada con basura. El detalle está en
`docs/private/MODERACION.md`.

## 10. Respaldos

El plan Free de Supabase **no hace respaldos automáticos de ningún tipo**.

```bash
node scripts/respaldo.mjs                          # copia pública
SUPABASE_SECRET_KEY=... node scripts/respaldo.mjs  # copia completa
```

Guarda los datos en JSON **y copia el esquema** (`supabase/migrations/`), porque
sin él los datos no se pueden restaurar. Para un volcado lógico completo hace
falta la contraseña de la base:

```bash
npx supabase db dump --db-url "postgresql://postgres:<clave>@db.<ref>.supabase.co:5432/postgres" -f respaldo.sql
```

**La restauración no se ha ensayado nunca contra un proyecto vacío.** Hasta que
se ensaye, considérala sin verificar. Es un P1.

## 11. Lo que falta (sin maquillar)

Está en `CURRENT_STATE.md` §Limitaciones y en `PRODUCT_BACKLOG.md` con
prioridades. Los tres que más pesan:

1. Ningún lugar tiene imagen propia. Es el mayor límite visual del producto.
2. No hay moderadores con nombre.
3. Los tiles del mapa no aguantan escala pública.

## 12. Dónde está cada documento

`docs/README.md` tiene el índice completo y dice cuál está vigente.
