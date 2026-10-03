# Cobertura de fuentes — auditoría del 3 de octubre de 2026

Pregunta del dueño: el sábado 3 la portada mostraba 3 eventos. ¿Es lo que
hay, lo que está atascado o lo que no encontramos?

Respuesta: **las tres cosas**. Este documento dice cuánto pesa cada una y
qué se hizo.

## 1. Atascado en revisión (resuelto)

El motor estaba en modo sombra. El dueño lo activó el 3-oct a las 02:22
(Chile). En la primera ingesta con el motor activo:

| | Antes | Después |
|---|---|---|
| Públicos hoy (3-oct) | 3 | 4 (FALSOCLUB, Mil Tambores, Piel + Macrobia, Noche Almodóvar) |
| José Alfredo Fuentes (fecha equivocada) | público | retirado a revisión: la ticketera dice 11-oct |
| Públicos vigentes (todas las fechas) | 23 | 55 |
| En revisión vigentes | 65 | 41 |
| Decisiones aplicadas | — | 33 publicados, 3 descartados, 1 contradicción |

Mil Tambores no se publicaba porque su cartelera no se había vuelto a leer:
el presupuesto de 8 fuentes por corrida se llenaba antes. Ahora son 16 y
primero van las fuentes con evento esta noche.

## 2. No lo encontrábamos (lo principal)

Referencias revisadas para hoy y los próximos 14 días:

| Fuente | Acceso | Qué se hizo |
|---|---|---|
| PortalTickets, listado regional `/tickets/R05` | público, una página | **Nueva fuente.** 82 eventos de la región, 80 con fecha verificada, todos con afiche. Incluye locales sin cartelera propia (Ferri, Castillo del Mar, Rosmarino, Teatro IPA, Café Teatro VP, Casa Polanco, Espacio La Compañía, Barbones Comedy, Cine Arte Viña, Espacio Guestro). |
| Evently | `robots.txt` permite; fichas con schema.org/Event; sin sitemap de eventos | **Nueva fuente** (portada + productoras de la región conocidas, máx. 25 fichas por corrida). |
| PuntoTicket | `robots.txt` permite; fichas con schema.org/Event | **Nueva fuente** (solo fichas cuyo slug nombra una comuna de la región). |
| TicketPlus | ya activa (JSON-LD por sitemap) | sin cambios |
| Passline | Cloudflare responde 403 con desafío a un cliente identificado, también al sitemap | **Manual.** No se salta. |
| Vesti | cartelera armada con JavaScript desde una API no pública; el sitemap no lista eventos | **Manual.** |
| Mil Tambores (sitio oficial) | WordPress con tipo `programacion` vacío para 2026; programa en HTML | **Manual**, primera parte, una vez al año. |
| Eventbrite | publica JSON-LD, pero sus términos prohíben extraer | **Manual.** |

### Eventos de hoy encontrados afuera y faltantes

| Evento | Lugar | Dónde está | Por qué faltaba | Estado |
|---|---|---|---|---|
| Columbia | Balneario Las Salinas, Viña | Passline | Passline bloqueado | manual |
| Eduardo Gatti + Orquesta Sinfónica Popular | Teatro Municipal de Quilpué | Passline | Passline bloqueado | manual |
| ENDO | Club Patio, La Ligua | Evently | La Ligua no está entre las comunas cubiertas | fuera de cobertura (decisión de producto) |
| SUGAR / EL FOREST | Blanco Social Club, Valparaíso | Evently (según referencia) | no se pudo verificar en fuentes públicas el 3-oct | sin verificar |
| Cafeyna (festival de café) | Terminal de Cruceros, Valparaíso | sitio propio | diurno, no es salida nocturna | no aplica |

**Patrón:** lo que falta hoy está casi todo en **Passline**. Es la brecha más
grande y no tiene acceso automático legítimo.

## 3. Lo que hay (no se infla)

No se publica nada débil para subir el número. Lo diurno (Café Rock 12:00,
Octubrazo 16:00, "Contar el mar(itorio)" 10:00) sigue en revisión con su
motivo. Un evento de un local que no está en el registro tampoco se publica
solo: el local queda **propuesto** (privado) para que una persona lo apruebe
una vez.

## Métrica operativa de cobertura

No hay porcentaje "de toda la noche": no se puede saber. Sí se puede medir
contra fuentes de referencia con nombre:

```sql
-- Conocidos, públicos y en revisión para hoy
select disposition, count(*) from events
 where date_text = to_char(timezone('America/Santiago', now()),'YYYY-MM-DD')
 group by 1;
```

Lo descubierto afuera y faltante se anota en la tabla de arriba, con la
fuente donde estaba. La pregunta para cada uno es "¿dónde debimos
encontrarlo solos?", y si se repite, se registra la fuente.

## Economía de fuentes (últimos 7 días)

| Familia | Fuentes | Lecturas | Seg. prom. | Ítems | Nuevos | Duplicados | Descartados | Costo |
|---|---|---|---|---|---|---|---|---|
| Ticketeras | 22 | 85 | 3,3 | 292 | 38 | 226 | 4 | $0 |
| Centro cultural (PCdV) | 1 | 8 | 5,7 | 72 | 8 | 25 | 0 | $0 |
| Local oficial (Cinzano) | 1 | 7 | 2,3 | 280 | 8 | 1 | 43 | $0 |
| Directorio (Valpo Cultura) | 1 | 2 | 12,3 | 20 | 7 | 13 | 0 | $0 |
| Universidad (USM) | 1 | 1 | 4,8 | 50 | 2 | 0 | 13 | $0 |
| Municipios | 2 | 8 | 4,5 | 124 | **0** | 0 | 11 | $0 |

Los municipios no aportan nada nuevo en una semana: candidatos a bajar su
frecuencia. El listado regional de PortalTickets reemplaza en una petición
lo que hoy cuestan 20.

## Apify / Instagram: sigue pausado

Cuentas configuradas: `el.huevo`, `trotamundosvalpo`, `mascara_valparaiso`,
`clubdvina`. Trotamundos ya está cubierto por la ticketera. El Huevo,
Máscara y Club D no tienen otra fuente pública, así que serían lo único que
justificaría un experimento.

Historia real: 2 corridas en septiembre, 38 posts, 80 candidatos, 0
publicados, US$ 0,08. Costo estimado de un experimento de 3 cuentas, 1 vez
al día durante 2 semanas: menos de US$ 2, con carga de revisión alta
(posts sin fecha estructurada). **Decisión: no ahora.** Primero cerrar
Passline (manual) y aprobar los locales propuestos, que rinden más por
menos.

## Destacado pagado (preparación, sin pagos)

`events.placement` = `organic` | `promoted` (por defecto `organic`).

**Invariante:** lo destacado solo puede cambiar el orden o un rótulo
visible de "Destacado". **Nunca** cambia la confianza, la frescura, el
estado "en vivo", la verificación ni la decisión de publicar. El motor
(`lib/sources/evidence.ts`) no lee esa columna.
