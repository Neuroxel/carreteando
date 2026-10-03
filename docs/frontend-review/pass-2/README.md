# Segunda pasada visual — revisión de Carlos

Estado: frontend terminado y desplegado para revisión. Sin merge ni promoción a producción por esta sesión.

- Fuente canónica: `feat/frontend-final-october`.
- Antes: `68834935e2a4d324d480c98d1ccbcb6fcc91f968`.
- Código del después / preview: `0da36647a5b9686cb9f27204ec37bbd02c42555b`.
- Preview: https://carreteando-d06kp4d7y-neuroxel.vercel.app
- Deployment `dpl_FfiXZHnNaL1gyW4gDh2nJnRVdMA2`, READY, target null (preview).
- El commit posterior sólo agrega evidencia y este handoff. No existe una segunda rama del nuevo frontend.

## Cuatro cambios

1. Cabecera de papel claro, tipografía Georgia de gran tamaño y ciudad como navegación subrayada. La atmósfera nocturna se conserva en el resto de la página.
2. Fecha visible; búsqueda, escenas y modos reunidos en la apertura «Buscar y filtrar», cerrada inicialmente también en Explorar. Los filtros aplicados se señalan en el resumen. Mismos controles, enlaces y estado local.
3. Dos columnas de afiches en escritorio; marco 5:4 en escritorio y cuadrado en móvil, siempre `object-fit: contain`. Fichas claras con título editorial, fecha, hora, lugar y precio. Sin recortar, recrear ni alterar los afiches oficiales.
4. Lugares como fichas tipográficas abiertas, con regla superior, categoría, nombre grande y enlaces al pie. Se distinguen de los eventos sin fotografías inventadas.

Sólo se modificó producto en `app/globals.css`, `components/ExploreClient.tsx` y `components/EventImage.tsx`. Sin dependencias, funciones nuevas, cambios de fetching, scraping, esquema, rutas SEO ni arquitectura.

## Comparación visual

[Galería](index.html)

| Pantalla | Portada | Lugares |
| --- | --- | --- |
| 390 × 844 | [Antes / después](comparison-390.png) | [Antes / después](comparison-venues-390.png) |
| 1440 × 1000 | [Antes / después](comparison-1440.png) | [Antes / después](comparison-venues-1440.png) |

Capturas de builds de producción locales del antes y después, misma fecha y tamaños de viewport, sin modificar el DOM ni inyectar datos. Los tres eventos de portada son los mismos. La base pública cambió durante el trabajo: los contadores de ciudades y algunos lugares difieren; no se presentan como cambios del diseño. El preview vivo contiene datos más recientes y tiene una captura adicional `preview-390.png`.

El navegador devuelve capturas reducidas de 375×812 y 1425×990 para los viewports solicitados. Se conservan esos originales `before-*`/`after-*`; cada panel de las comparativas se normalizó a 390×844 o 1440×1000 y se añadieron etiquetas. No se retocó contenido ni se eliminaron elementos.

**Referencias originales:** no estuvieron disponibles las dos imágenes originales en los adjuntos accesibles. Se trabajó con las descripciones explícitas del brief: A, claridad de fecha/precio/lugar; B, ambiente oscuro y grandes imágenes. La comparación literal contra las imágenes sigue sin poder verificarse. No se afirma haberlas inspeccionado.

## Verificación final

- 128/128 tests; lint, typecheck y build correctos. Logs en esta carpeta.
- Interacción real: ciudad → fecha → abrir filtros → buscar «mauri» → Lugares → Mapa (1 marcador) → Lista → limpiar → atrás → adelante. **0 solicitudes adicionales al mismo origen, 0 solicitudes de datos** en el proxy de registro después de la carga inicial. `network.json`. Los tiles externos del mapa no forman parte de la prueba de datos del producto.
- Ocho anchos: 360, 375, 390, 412, 430, 768, 1024 y 1440; sin desbordamiento horizontal del documento en Explorar/Lugares. `responsive.json`. Revisión visual de portada y lugares en los dos tamaños solicitados. No se probó un teléfono físico.
- SEO: título, descripción, canonical, robots y tipos JSON-LD coinciden antes/después en portada, explorar, evento disponible y lugar. Robots y sitemap responden 200. `seo.json`.
- Preview verificado en navegador, con el nuevo diseño y sin errores de consola observados.

| Lighthouse móvil | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| --- | ---: | ---: | ---: | ---: |
| Local — portada | 100 | 100 | 96 | 100 |
| Local — explorar | 100 | 100 | 96 | 100 |
| Local — Piel + Macrobia | 100 | 100 | 96 | 100 |
| Preview alojado — portada | 99 | 100 | 100 | 58 |

Informes completos HTML/JSON incluidos, con credenciales de acceso redactadas. El 96 local procede del error existente de `/api/medir`; no ocurre en el preview. El 58 SEO del preview protegido corresponde al `noindex` de Vercel y robots con protección; no se debilitó la protección para subir la puntuación. Por tanto, **no se cumple literalmente ≥95 en todas las categorías del preview protegido**; sí en las páginas locales indexables medidas. No confundir SEO del preview con pérdida de SEO del producto.

## Exclusiones y handoff a Claude/Opus

- No se tocó backend, scraping, fuentes ni datos. No se hizo merge a main.
- Durante la sesión otro trabajo retiró de esta rama commits de backend; el commit de diseño parte directamente de `6883493`. Los commits de backend observados `8d69dce` y `a2e5683` no están incluidos en el preview ni en este handoff frontend. La sesión también observó cambios externos en main; no fueron realizados aquí.
- La portada local contiene «José Alfredo Fuentes: 60 Gold», pero su ficha `/evento/curated-pd-josealfredofuentes60goldenteatromauriscd-1003` devuelve **404 en ambos builds**, antes y después. Es una inconsistencia observable de snapshot/ficha, pendiente de integración de datos. Se conserva el informe Lighthouse fallido `lighthouse-event-unavailable.*`; se midió luego la ficha disponible de Piel + Macrobia.
- La advertencia existente de snapshot de más de seis horas también apareció durante QA. No se ocultó ni se alteró su comportamiento.
- En el preview observado, FALSOCLUB muestra 19:00 en los datos y 23:00 en el afiche; debe revisarlo el trabajo de datos antes de presentar el catálogo como validado. No se corrigió contenido desde frontend.
- No se incluye prueba comparativa literal contra las imágenes originales ausentes ni una promesa de aceptación de Carlos. La diferencia visual queda disponible para su revisión.

La integración con backend/datos y cualquier merge posterior corresponden a Claude/Opus. Todos los cambios útiles de esta pasada quedan versionados en la rama canónica.
