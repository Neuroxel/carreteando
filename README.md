# Carreteando

Vida nocturna de Valparaíso, Viña del Mar, Reñaca, Quilpué, Villa Alemana y Concón. Pregunta central: **¿Dónde se carretea hoy?**

Fuente de producción: `Neuroxel/carreteando:main`. Vercel despliega en [carreteando.vercel.app](https://carreteando.vercel.app). No desplegar desde ni modificar `tpotp/carretes:main` para este trabajo.

## Desarrollo y verificación

```sh
npm ci
# Configurar .env.local con el entorno autorizado; nunca versionar credenciales.
npm run dev
npm run verify
```

Node 22, Next.js 15.5.25, React 19, TypeScript. CSS nativo; componentes de servidor para cartelera, búsqueda, zonas y detalle. Los formularios, la imagen con fallback y el botón de compartir usan componentes de cliente. `npm run verify` ejecuta tests, lint de todos los módulos, TypeScript, build y auditoría de dependencias de producción.

## Datos y confianza

- Lecturas con clave pública y RLS: sólo `is_active=true`, `moderation_status=approved` y fecha vigente en `America/Santiago`.
- Una respuesta exitosa vacía es autoritativa. No hay caché de eventos en localStorage ni datos ficticios. Un error se muestra como error y la API devuelve 503.
- Formulario → servidor → bandeja privada `community_inbox` → revisión humana. Nunca publica directamente. Reportes de información incorrecta usan la misma bandeja.
- Cron autenticado → Apify → registro de post → clasificación/extracción → deduplicación → candidato inactivo. No hay aprobación automática ni un LLM oculto.
- Fuente revisada no equivale a confirmación del organizador. Precio, horario y dirección desconocidos se indican como tales.

## Operación

[Procedimiento de operación y moderación](docs/OPERATIONS.md), [base observada](docs/BASELINE.md), [revisión y limitaciones](docs/PRODUCTION_REVIEW.md).

El esquema inicial legado está en `supabase-schema.sql`. Para instalaciones nuevas se aplica primero ese esquema y después, en orden, **todas** las migraciones de `supabase/migrations`. No volver a ejecutar el esquema legado sobre una instalación migrada, porque su política pública es menos restrictiva. Las migraciones de este checkpoint son aditivas y conservan los históricos.

`supabase/tests/trust.sql` prueba los roles anon/authenticated, la vista, la cuota y la reserva de ingesta dentro de una transacción con rollback. Requiere sesión administrativa de base de datos y una ventana sin ingesta activa. Nunca usar credenciales administrativas en el navegador del producto.

## Alcance actual

Cartelera, filtros con URL compartible, detalle server-rendered, OpenGraph generado, JSON-LD con campos conocidos, sitemap, fuentes, envíos pendientes y reportes. Sin ticketing, mapa de calor, RSVP agregado, seguimiento de asistentes, publicidad, analítica invasiva ni funciones simuladas.

Las limitaciones de precisión del parser y la densidad de eventos se evalúan por separado de las pruebas técnicas. La disponibilidad pública del sitio no equivale a un MVP aceptado.
