# Marca y dominio: Dónde Salgo?

## Veredicto de marca: **REVISIÓN LEGAL/MARCA REQUERIDA**

No es "seguro de usar" todavía. No hay una señal de conflicto grave, pero falta
lo que solo puede hacer el dueño o un abogado.

| Chequeo | Resultado (04-10-2026) |
|---|---|
| `dondesalgo.cl` | **No registrado** (whois NIC Chile: "no entries found"). Disponible para el dueño |
| `dondesalgo.com` | Sin respuesta DNS; no confirmado |
| Uso previo del nombre | "¿Dónde salgo?" es una frase genérica en español; hay usos informales en medios y apps de otros países. No se encontró una app chilena de eventos con ese nombre |
| INAPI (clases 9, 35, 41, 42) | **No consultado.** Hay que buscar "DONDE SALGO" y variantes en el buscador de marcas de INAPI |
| Redes sociales (@dondesalgo, @dondesalgo.cl) | **No verificado** en Instagram ni TikTok |
| Riesgo de frase genérica | Alto: puede costar registrarla como marca denominativa sola. Una marca mixta (logotipo) es más defendible |

### Lo que tiene que hacer el dueño

1. Registrar `dondesalgo.cl` en NIC Chile (no se compró nada desde aquí).
2. Buscar en INAPI y, si está libre, solicitar marca mixta en clases 9, 35 y 41.
3. Reservar los usuarios de Instagram y TikTok.

## Renombre público (hecho en `release/dondesalgo-v1`)

- Navbar y footer: wordmark **DÓNDE SALGO?** (el "?" en el color de acento).
- `<title>`: "Dónde Salgo? | Eventos y lugares para salir hoy", plantilla
  "%s | Dónde Salgo?". `siteName`, `applicationName`, imagen OG y su texto
  alternativo, imagen OG de cada evento, descripción del sitio, textos de "Cómo
  funciona" y "Confianza", y la etiqueta de las fichas editoriales.
- Se mantiene el nombre interno `carreteando` en el código, en el proyecto de
  Vercel, en la cookie de admin y en el `User-Agent` del lector de fuentes: no
  aporta nada cambiarlos y podría romper accesos.

## Dominio: plan `dondesalgo.cl` (preparado 17-oct-2026, no ejecutado)

**No cambiar el dominio principal hasta validar el piloto con usuarios reales.**
Hoy la canónica es `https://dondesalgo.vercel.app` (`NEXT_PUBLIC_SITE_URL` sin
definir → `lib/site.ts`). `carreteando.vercel.app` redirige 308 a ella
(`next.config.mjs`). Nada de esto requiere tocar la base.

Ya queda listo en el código: `metadataBase`, canónicos, Open Graph, JSON-LD,
`sitemap.xml`, `robots.txt`, enlaces para compartir e IndexNow salen de
`NEXT_PUBLIC_SITE_URL`. Los endpoints con control de origen (`/api/ambiente`,
`/api/medir`, aportes) comparan contra el host de la propia solicitud, así que
funcionan en cualquier dominio sin lista de orígenes. La app no usa redirects
de Supabase Auth.

### A. Vercel (proyecto `carreteando`, equipo Neuroxel)
1. Registrar `dondesalgo.cl` en NIC Chile (lo hace el dueño; nada se compró desde aquí).
2. Domains → agregar `dondesalgo.cl` (principal) y `www.dondesalgo.cl` con
   "Redirect to `dondesalgo.cl`" permanente (308).
3. **Conservar** `dondesalgo.vercel.app` asignado al proyecto, sirviendo normal.

### B. DNS
Copiar **exactamente** los registros que Vercel muestre al agregar cada dominio
(apex y `www`) y cargarlos en NIC Chile. No se documentan valores por adelantado:
hay que usar los que entregue Vercel ese día. Registrar aquí fecha y valores
una vez cargados. Esperar el certificado (candado en Domains).

### C. App (un solo redeploy)
1. Comprobar `curl -I https://dondesalgo.cl/` → 200 con HTTPS válido, y
   `curl -I https://www.dondesalgo.cl/` → 308 a la raíz.
2. Production env `NEXT_PUBLIC_SITE_URL=https://dondesalgo.cl` y redeploy.
3. Verificar en `https://dondesalgo.cl/`: `<link rel="canonical">`, `og:image`,
   `/sitemap.xml`, `/robots.txt` (`host` y `sitemap`), `/indexnow-key.txt`.
4. Cambio menor de código pendiente para ese día: `lib/venues.ts` → `propia()`
   reconoce como propias solo `carreteando.vercel.app` y `dondesalgo.vercel.app`;
   agregar `https://dondesalgo.cl`.
5. Search Console (propiedad de dominio) y Bing Webmaster: alta y envío de `/sitemap.xml`.

### D. Redirect del dominio viejo (solo después de C)
Con `.cl` validado: `dondesalgo.vercel.app/*` → `https://dondesalgo.cl/*`
permanente, como regla `has: host` en `next.config.mjs` (igual que la de
`carreteando.vercel.app`, que pasa a apuntar directo a `.cl` para evitar dos
saltos). **No activarlo antes** de comprobar HTTPS y funcionamiento del `.cl`.

**Los crons quedan fuera del redirect.** Un cron no sigue un 308: si
`/api/cron/*` redirigiera, la ingesta dejaría de correr en silencio.
- La regla de redirect excluye `/api/cron/:path*` (patrón negativo en `source`,
  p. ej. `/((?!api/cron/).*)`), y lo mismo la de `carreteando.vercel.app`.
- Las rutas de cron responden directo en **todos** los hosts asignados; no se
  mueven a otro dominio hasta migrar, verificadamente, cada llamador: el Vercel
  cron de `vercel.json` (ruta relativa, sigue al deployment de producción) y los
  tres jobs de pg_cron de Supabase (URL absoluta: hoy apuntan a
  `dondesalgo.vercel.app`).
- Prueba obligatoria en el PR del redirect: `curl -s -o /dev/null -w "%{http_code}"`
  a `https://dondesalgo.vercel.app/api/cron/scrape` sin credenciales devuelve
  **401 directo** (nunca 308), y una página cualquiera sí devuelve 308; test
  automatizado del patrón con ambos casos.
- Tras el deploy: confirmar que la siguiente corrida programada aparece en
  `ingestion_runs` (o un `skip` por cooldown con HTTP 200).

### E. Rollback (sin tocar la base)
1. Si el redirect de D ya está: revert de ese PR y deploy (o "Promote" del
   deployment anterior en Vercel), y `dondesalgo.vercel.app` vuelve a servir.
2. Quitar `NEXT_PUBLIC_SITE_URL` (o volver a `https://dondesalgo.vercel.app`) y
   redeploy: canónicos, sitemap y OG vuelven a `.vercel.app`.
3. Crons: si algún job de pg_cron ya se había movido a `dondesalgo.cl`,
   volverlo a `https://dondesalgo.vercel.app/api/cron/scrape` (mismo secreto) y
   confirmar la siguiente corrida en `ingestion_runs`. El Vercel cron no cambia.
4. El dominio `.cl` puede quedar asignado sin ser canónico; se retira de
   Domains solo si falla su certificado o DNS.

## SEO tras el cambio de marca

- Páginas de zona: solo con inventario real (menos de 3 lugares: `noindex` y
  fuera del sitemap; ya implementado).
- Fichas de lugar: `LocalBusiness` (o `BarOrPub`, `NightClub`…) con dirección,
  perfiles y `priceRange` solo si el precio está verificado.
- Nada de reseñas ni horarios inventados en datos estructurados.
