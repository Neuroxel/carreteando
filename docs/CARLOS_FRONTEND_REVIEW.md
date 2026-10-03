# Carreteando — handoff final frontend para Carlos y Claude/Opus

El frontend nuevo tiene una sola fuente canónica: `feat/frontend-final-october`.

- Código desplegado: `0da36647a5b9686cb9f27204ec37bbd02c42555b`.
- Preview READY: https://carreteando-d06kp4d7y-neuroxel.vercel.app
- [Comparativas antes/después — 390×844 y 1440×1000](frontend-review/pass-2/index.html).
- [QA, alcance, informes y exclusiones de esta pasada](frontend-review/pass-2/README.md).
- [Primera pasada, conservada como antecedente](frontend-review/QA.md).

Cuatro cambios visuales: cabecera editorial clara, filtros secundarios agrupados, afiches oficiales dominantes con fichas claras y lugares como fichas tipográficas abiertas. No se agregaron funciones ni se modificó backend, scraping o arquitectura.

128 tests, lint, typecheck y build correctos. Cero solicitudes adicionales en la secuencia de filtros/búsqueda/lugares/mapa/atrás/adelante registrada. Sin desbordamiento de documento en ocho anchos revisados. SEO comparado antes/después sin cambios de metadatos en las páginas medidas.

Lighthouse local, portada/explorar/evento disponible: **100/100/96/100** (rendimiento/accesibilidad/buenas prácticas/SEO). Preview alojado, portada: **99/100/100/58**; el SEO del preview está limitado por protección y noindex, no se desactivaron para maquillar la medición.

Limitaciones relevantes: no estuvieron disponibles las dos imágenes originales de referencia, sólo su descripción. Se observó una ficha de José Alfredo Fuentes con 404 en ambos builds y una diferencia de horario entre afiche y datos de FALSOCLUB en el preview; el informe detalla ambas para integración de datos. No se ocultaron avisos de frescura.

Todo el trabajo útil está versionado. Esta sesión no hizo merge ni promoción a producción. Claude/Opus hará la integración posterior con backend/datos; los commits de backend retirados por otro trabajo durante la sesión no están incluidos en el preview. El HEAD final de la rama incluye este handoff y la evidencia; el código desplegado es el SHA indicado arriba.
