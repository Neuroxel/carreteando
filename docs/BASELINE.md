# Base observada — 2026-09-13 UTC / 12 de septiembre en Chile

- Repositorio autorizado: Neuroxel/carreteando, rama main, SHA 5af54bdd4cc1f18e1a4306d033b8457b669bd851. Carpeta inicial sin archivos ni commits; obtenido exclusivamente desde ese fork.
- Vercel: carreteando-d9021ndw7-neuroxel.vercel.app, Ready, producción carreteando.vercel.app, mismo SHA en dashboard. CI verify y estado Vercel success.
- Supabase hgwljbtqdserkdhulbts: 161 filas / 0 activas. RLS habilitado; SELECT activo para anon/authenticated, sin INSERT/UPDATE/DELETE (has_table_privilege). recent_events security_invoker=true. Security Advisor: 0 hallazgos.
- API /api/eventos: HTTP 200, success=true, total=0. Cron sin autorización: HTTP 401.
- npm audit de producción: 0 vulnerabilidades; lint sin errores (dos avisos de img), typecheck pasa.
- El commit histórico cb8eb41172ce18260b1789ca9d8de225f0fa0560 no existe en el historial obtenido de main. Se reimplementa comportamiento requerido con evidencia actual.

## Fallos confirmados en código

1. [] exitoso de Supabase recupera localStorage; los detalles buscan IDs por substring de URL.
2. saveEvent crea evento local activo y devuelve éxito antes de POST; POST inserta canonical activo sin moderación ni límite de frecuencia. client_id permite reemplazar otra fila manual.
3. Cron: fallback de parentData y cuentas no allowlisted; fechas pasadas activables; sólo deduplica posts; error del proveedor se devuelve y registra completo; polling puede sobrepasar presupuesto de función.
4. Fechas: timestamp faltante sustituido por ahora; fechas antiguas saltan al próximo año; precio de bebida y acceso condicionado se muestran como entrada/gratis; ciudad desconocida se inventa Valparaíso.
5. Radar ofrece datos ficticios, contadores y un falso LLM. Portada promete miles de usuarios y actualización constante sin evidencia. Canonical/OG apuntan al dominio antiguo.
6. Home y detalle dependen de cliente; portada renderizada inicialmente con Cargando. Mapa usa hotspots genéricos sin eventos reales.

## Ejecución

Cambios incrementales con migraciones aditivas, conservación de históricos, ingesta pendiente y revisión explícita. Sin cambios a tpotp/carretes. Seguridad/corrección → ingesta → UX/SEO → pruebas completas → main/despliegue → R2 y muestra contra fuente → veredicto.
