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

## Dominio: cómo cambiar sin duplicar páginas

La dirección canónica sale de `NEXT_PUBLIC_SITE_URL` (`lib/site.ts`). Hoy no
está definida, así que se usa `https://carreteando.vercel.app`. **No cambiarla
hasta que el dominio esté registrado y apuntando a Vercel.**

Orden cuando el dominio exista:

1. Vercel → proyecto `carreteando` → Domains: agregar `dondesalgo.cl` y
   `www.dondesalgo.cl` (www redirige a la raíz).
2. Configurar los registros DNS que pide Vercel en NIC Chile y esperar el
   certificado.
3. En Vercel, redirigir `carreteando.vercel.app` → `dondesalgo.cl` con 308.
4. Variable `NEXT_PUBLIC_SITE_URL=https://dondesalgo.cl` en Production y
   volver a desplegar: canónicos, sitemap, robots, Open Graph y JSON-LD pasan
   al dominio nuevo.
5. Search Console (propiedad de dominio) y Bing Webmaster: dar de alta el
   dominio, enviar `/sitemap.xml`. Recién ahí, no antes.
6. Revisar con `curl -I https://carreteando.vercel.app/` que responda 308.

Las vistas previas por rama están protegidas por Vercel y no se indexan.

## SEO tras el cambio de marca

- Páginas de zona: solo con inventario real (menos de 3 lugares: `noindex` y
  fuera del sitemap; ya implementado).
- Fichas de lugar: `LocalBusiness` (o `BarOrPub`, `NightClub`…) con dirección,
  perfiles y `priceRange` solo si el precio está verificado.
- Nada de reseñas ni horarios inventados en datos estructurados.
