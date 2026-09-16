# Carreteando

Descubrimiento de vida nocturna para la Región de Valparaíso, Chile.
Responde una pregunta: **«Estoy acá, ¿dónde salgo?»**

Producción: **https://carreteando.vercel.app**

No es una ticketera. Modela **lugares** —que existen aunque esa noche no pase
nada— y **eventos**, y los conecta con zonas y un mapa. Nada se publica sin
fuente, y lo que no se sabe se declara desconocido en vez de rellenarse.

## Estado

**Beta cerrada.** El estado vigente, con cifras verificadas y limitaciones
conocidas, está en [`CURRENT_STATE.md`](CURRENT_STATE.md).

## Cómo correrlo

```bash
npm install
npm run dev
```

Variables de entorno necesarias, **por nombre** (los valores viven en Vercel y
no se comparten por chat ni por correo):

| Nombre | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | lecturas públicas |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lecturas públicas |
| `SUPABASE_SECRET_KEY` | escrituras privadas: moderación e ingesta |
| `ADMIN_ACCESS_TOKEN` | acceso a `/admin` |
| `CRON_SECRET` | cabecera del cron de Vercel |
| `APIFY_API_TOKEN`, `APIFY_PAUSED` | proveedor pago, pausado a propósito |

Sin las claves de Supabase el sitio arranca, pero no muestra datos.

## Verificación

```bash
npm test          # 80 pruebas
npm run lint
npx tsc --noEmit
npm run build
```

## Arquitectura

Next.js 15 (App Router, React Server Components) sobre Vercel, con Supabase
(Postgres 17). No hay backend aparte: lo público se lee por PostgREST con la
clave publicable y lo privado pasa por Server Actions con el rol de servicio.

La seguridad se apoya en Postgres: RLS en todas las tablas, funciones de
moderación restringidas al rol de servicio, y caducidad de eventos resuelta al
leer, de modo que si la ingesta se cae varios días la cartelera no muestra nada
viejo.

La agenda se alimenta de **24 fuentes públicas** mediante adaptadores. Un
despachador corre cuatro veces al día, programado desde la propia base con
`pg_cron`, porque el plan Hobby de Vercel no acepta cron más de una vez al día.

## Documentación

El índice está en [`docs/README.md`](docs/README.md). Si vienes a revisar el
proyecto, empieza por [`CARLOS_HANDOFF.md`](CARLOS_HANDOFF.md) y
[`CARLOS_REVIEW_CHECKLIST.md`](CARLOS_REVIEW_CHECKLIST.md).

## Licencia y datos

Los datos de eventos y lugares provienen de fuentes públicas y cada registro
guarda su origen. Las coordenadas vienen de OpenStreetMap (ODbL) mediante
Nominatim. Las imágenes son carteles oficiales publicados por el propio local,
el municipio o la ticketera, con su procedencia declarada; no se usan
resultados de búsquedas de imágenes.
