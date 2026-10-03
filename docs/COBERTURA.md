# Cobertura de fuentes — 3 de octubre de 2026

## Cierre del sábado 3 (tarde)

| | Mañana (02:30) | Cierre (tarde) |
|---|---|---|
| Públicos hoy | 4 | **10** (7 de noche) |
| En revisión hoy | 8 | 3 |
| Públicos vigentes | 55 | **86** |
| En revisión vigentes | 41 | 32 |
| Fin de semana (sáb–dom) | — | 14 |
| Próximos 7 / 14 días | — | 23 / 35 |
| Con afiche oficial | — | 98 % |
| Familia más grande | — | PortalTickets, 55 % |

Lo que cambió en la tarde:

- **Lo diurno con señal de salida ya no espera**: un festival, un carnaval o
  una tarde de rock (Café Rock 12:00) sigue las mismas reglas que lo
  nocturno. Lo diurno sin señal sigue yendo a una persona.
- **Mil Tambores, completo y desde la fuente oficial**: Pasacalles barriales
  (7 territorios, 59 agrupaciones, sábado desde las 12:00), Fiesta oficial
  (Club Segundo Piso, 22:00) y Gran Pasacalle Latinoamericano (domingo
  10:00). Comparten el momento `mil-tambores-2026` y usan el arte oficial.
- **Puente manual de Passline**, solo con lo corroborado por más de una fuente:
  Eduardo Gatti + Orquesta Sinfónica Popular (Quilpué, 20:00) y Pulso
  Naranja (Quinta Vergara, 18:00). Columbia (Las Salinas) y Tributo Grupo
  Firme (El Parque Quilpué) quedan **sin verificar**: solo aparecen en un
  fragmento del índice de búsqueda.
- **Locales resueltos con evidencia pública**: aprobados Aula Magna USM,
  Teatro IPA, Cine Arte Viña, Valparaíso Profundo, Enjoy Viña y Barbones
  Comedy (venta vigente en ticketera o dirección publicada en prensa);
  descartados 4 duplicados y 2 estadios. Los alias reconocen las distintas
  formas de escribir el mismo local.
- **Correcciones**: José Alfredo Fuentes pasa a su fecha real (11-oct 18:00);
  FALSOCLUB a 23:00. La ficha de la ticketera decía 19:00 en el campo de
  fecha, pero su descripción dice 23:00–04:00, igual que el afiche.
  *Limitación conocida:* la hora estructurada de PortalTickets a veces es la
  de puertas o de venta, no la del show.
- **Decididos a mano hoy**: Octubrazo publicado (festival de 6 bandas,
  16:00–21:30); Orquesta Cinzano publicada (agenda oficial, hora por
  confirmar); "Programación Octubre" de Valparaíso Profundo rechazada (es la
  agenda del mes, no un evento).
- **Quedan en revisión hoy, con su motivo**: "Contar el mar(itorio)" (muestra
  de museo, 10:00); "La Contadora de Películas" en el Aula Magna (solo el
  directorio lo confirma); Patricia Maldonado en Veranda Hotel (local no
  verificado).

### Tres cosas distintas que no hay que confundir

- **A. Lo conocido pero retenido** (hoy, 3): está en la cola con su motivo.
- **B. Lo que no descubrimos**: casi todo está en **Passline**, que bloquea la
  lectura automática; el resto son locales que solo publican en Instagram.
- **C. Lugares abiertos sin evento especial**: 99 lugares publicados. La
  portada los ofrece como "lugares para salir", **sin decir "abierto ahora"**
  porque no hay horarios verificados.

## Piloto de Instagram: plan, no activado

Universo real: **16 locales de la zona núcleo (21 en la región)** que solo
existen en Instagram (lista en `docs/FUENTES_LOCALES.md`), más 4–9
productoras y colectivos que solo publican ahí.

| | Estimación |
|---|---|
| Cuentas | 25 |
| Frecuencia | 1 vez al día, posts de las últimas 48 h |
| Duración | 14 días |
| Posts leídos | ~1.000–1.400 |
| Costo | **US$ 2–3** (septiembre: US$ 0,08 por 38 posts); tope duro de US$ 10 |
| Candidatos | ~100, de los cuales ~30–50 eventos únicos |
| Duplicados con ticketeras | bajos: se eligen cuentas sin ticketera |
| Carga de revisión | todo a revisión (nivel D, nunca publica solo): ~2–3 h en 2 semanas |

**Recomendación:** hacerlo después de la revisión de Carlos y con aprobación
explícita del dueño. Medir el costo por evento único publicado. Si no supera
a fuentes gratuitas, se apaga.

## Auditoría de la madrugada del 3 de octubre

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
