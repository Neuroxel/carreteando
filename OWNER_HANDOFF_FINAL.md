# Dueño — entrega final (11-10-2026)

Sin secretos en texto plano. Las claves viven en Vercel (servidor) y en el Llavero de este Mac.

## Sitios

| | Estable | 3D (experimento) |
|---|---|---|
| URL de revisión | https://dondesalgo.vercel.app | https://dondesalgo3d.vercel.app |
| Otros alias | https://carreteando.vercel.app (**no quitar**: el cron apunta ahí y es el canónico actual) | https://carreteando3d-omega.vercel.app |
| Proyecto Vercel | `carreteando` · `prj_wHvQ3Io24kHI21hrcbUEO0Um5Cdy` | `carreteando3d` · `prj_eYtVeclRtOA2CcipRj7C0gVcTotx` |
| Rama de producción | `main` | `experiment/dondesalgo-3d` |
| Código verificado | `d6d4c8f` | HEAD de `experiment/dondesalgo-3d` |
| Ignora builds de | `experiment/dondesalgo-3d` | toda rama distinta de `experiment/dondesalgo-3d` |
| Cron | sí: pg_cron de Supabase llama a `carreteando.vercel.app/api/cron/*` (3 agendas diarias + 2 trabajos internos), más el cron de Vercel `/api/cron/scrape` (diario, 18:00 UTC, autenticado con `CRON_SECRET`). | **no** (`/api/cron/*` responde 503) |
| Secretos | `ADMIN_ACCESS_TOKEN`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `APIFY_*` | **ninguno**: solo URL y clave anónima de Supabase + `NEXT_PUBLIC_EXPERIMENT=1` |
| `/admin` | sí | no existe (404) |
| Indexación | sí | no (noindex, robots `Disallow: /`, sitemap vacío) |

- **Plan Vercel Hobby:** un solo miembro. Agregar a Carlos al equipo requiere Pro (pago) y no se hizo. No hace falta: ambas URLs de producción son públicas, y él despliega el 3D con su acceso de escritura en GitHub (`tpotp`, repo público).
- **Otra rama 3D:** `feat/gui-3d` (React Three Fiber, desde un `main` anterior) es un intento paralelo de otra sesión. No forma parte de esta entrega; no se tocó.

## Acceso a `/admin` (estable)

- `/admin` es el panel de moderación de la aplicación, no Vercel. Se entra con la clave `ADMIN_ACCESS_TOKEN`.
- **Esa clave no cambia con los despliegues.** Está en Vercel desde el 15-09-2026 y no se ha modificado. El 11-10 se comprobó, sin mostrarla, que es idéntica a la del Llavero y a la del archivo privado. No se rotó.
- **Copiarla al portapapeles** (Terminal de este Mac):

  ```bash
  security find-generic-password -s "Carreteando Admin" -a owner -w | tr -d '\n' | pbcopy
  ```

- **Respaldo:** `docs/private/admin/admin-access-token.txt` (chmod 600, fuera de Git).
- **Procedimiento de recuperación:** `docs/private/ADMIN_RECOVERY.md`.

## Carlos como moderador

- **Estado:** activo en la tabla `moderators`. El hash de la base coincide con su clave guardada aquí. Ya inició sesión (16-09).
- **Acceso:** usa la estable y su propia clave; sus revisiones quedan firmadas "Carlos".
- **Copiar su clave** para enviársela por un canal privado:

  ```bash
  security find-generic-password -s "Carreteando Moderador Carlos" -a carlos -w | tr -d '\n' | pbcopy
  ```

## Operación

- **Motor:** `engine_mode = active`.
- **Piloto de Instagram:** `instagram_pilot = used` (un solo uso, consumido).
- **Apify:** `APIFY_PAUSED` es sensible y no se puede leer. Su último valor escrito es `true` (pausado). Sin scraping pagado continuo.
- **Cron:** las 5 tareas de pg_cron corrieron con éxito hoy.

## Dominio propio

- **Estado al 11-10-2026:** `dondesalgo.cl` **no está registrado** (NIC Chile: "no entries found"). No se compró.

Cuando lo registres:

1. **En Vercel**, proyecto `carreteando`, agrega `dondesalgo.cl` (principal) y `www.dondesalgo.cl` (que redirija al principal). Configura el DNS que pida Vercel.
2. **Con el DNS ya funcionando**, cambia `NEXT_PUBLIC_SITE_URL=https://dondesalgo.cl` y vuelve a desplegar. Eso actualiza canónicos, URLs de OG, sitemap y robots.
3. **Mueve el host del cron** (`carreteando.vercel.app` → `dondesalgo.cl`), o deja ese alias vivo.
4. **IndexNow:** vuelve a enviar las URLs.
5. **Search Console y Bing:** verifica el dominio y envía el sitemap.

No hagas esos pasos antes de que el DNS responda.
