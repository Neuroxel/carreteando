# Carreteando — hoja de ruta

Vigente desde el 3 de octubre de 2026. Lo histórico está en `docs/`; esto es lo
que viene.

## Tesis del producto

Carreteando **no es un scraper de eventos**. Responde una pregunta:

> **"Estoy acá. ¿Dónde salgo y qué está pasando?"**

Para eso combina seis cosas que nadie junta en la región:

1. **Eventos**, de ticketeras, sitios oficiales y la comunidad.
2. **Lugares aunque hoy no tengan evento**: un bar abierto un sábado también es un plan.
3. **Fuentes chicas y under**, no solo las grandes ticketeras.
4. **Mapa**: dónde queda, qué hay cerca.
5. **Información fresca**: lo pasado no se muestra y lo dudoso no se publica.
6. **Señales en vivo de la comunidad**: cómo está ahora.

Simple por fuera, sofisticado por dentro.

## Ahora (octubre 2026)

- **Release candidate** `release/october-final`: frontend de Astra + datos y
  automatización. Revisión de Carlos sobre una sola URL.
- **Densidad de fuentes**: PortalTickets regional, TicketPlus, PuntoTicket y
  Evently automáticos; Passline como puente manual.
- **Cobertura de lugares**: aprobar los locales propuestos por las ticketeras;
  completar Instagram, programación y horario de sábado de los 30–50 más
  importantes (`docs/FUENTES_LOCALES.md`).
- **Alta en buscadores**: Search Console y Bing (requiere la cuenta del dueño).
- **Primeros usuarios beta reales** y medir: aperturas, "cómo llegar",
  Instagram, búsquedas sin resultado.

## Después

- **"Reclama este lugar"**: el local verificado entrega su calendario (ICS,
  RSS o formulario) y pasa a nivel A.
- **Feeds oficiales de locales**: el adaptador ICS y el JSON-LD ya existen;
  falta que los locales los publiquen.
- **Piloto acotado de Instagram** para los 21 locales que solo existen en
  redes (ver `docs/COBERTURA.md`): con tope de gasto y sin publicación
  automática desde redes.
- **Reportes en vivo orgánicos**: que la gente los use sin pedírselo.

## Más adelante

- Cuentas y favoritos.
- Notificaciones ("esta noche toca tu banda").
- Más geografía: el resto de la región, después otras ciudades.
- Mejoras nativas o PWA, **solo si el uso lo justifica**.

## Momentos (patrón reutilizable)

Una ocasión que reúne muchos eventos (Mil Tambores, Año Nuevo, semana
universitaria, un fin de semana cultural) se marca con `events.moment`
(ej. `mil-tambores-2026`). Así se puede armar una colección temporal "Hoy en
Valpo" sin código especial por festival. **Nada de un festival queda fijo en
la interfaz**: el momento existe mientras existen sus eventos.

## Economía

Hipótesis en orden de prioridad. **No hay pagos implementados.** Primero
hace falta tráfico real, interés de locales y demanda medible (aperturas,
"cómo llegar").

1. **Evento destacado / boost.** Un local o productora paga para que un
   evento se vea más grande, más arriba o en inventario patrocinado. Siempre
   rotulado **Destacado** o **Promocionado**.
2. **Lugar destacado / local pro.** Perfil verificado, imágenes oficiales,
   feed de programación automático, analítica básica, espacio destacado.
3. **Afiliación de ticketeras**, solo donde el proveedor tenga términos de
   referidos legítimos.
4. **Escena, fin de semana o ciudad patrocinada** ("Esta noche en Valpo,
   presentado por…"), claramente rotulado.
5. **Analítica para locales**: clics, "cómo llegar", aperturas de Instagram,
   demanda de búsqueda, cuando el volumen sea significativo.
6. **Beneficios** (lista, 2×1, descuentos) financiados por el local.

**Publicidad programática: última prioridad.** No se implementa ahora.

**Invariante:** pagar nunca cambia la confianza, la frescura, el estado en
vivo ni la verificación. `events.placement` (`organic` | `promoted`) es una
columna aparte que el motor de decisión no lee.

## Principio de costo

- IA en tiempo de ejecución: **$0**.
- Búsqueda y filtros: en el teléfono, **~$0** de backend.
- Primero fuentes estructuradas gratuitas; scraping pago solo cuando su
  rendimiento en eventos únicos lo justifique.
- Métrica que manda: **costo por evento único publicado**.
