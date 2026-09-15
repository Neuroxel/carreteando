# Patrones de producto en apps de vida nocturna

Estudio de referencia para Carreteando. **No se copia diseño ni código**: se extraen patrones y se
decide explícitamente qué usar, qué adaptar y qué ignorar, con la razón.

Contexto que cambia las decisiones: Carreteando opera en una región de ~1 millón de habitantes con
una escena de bares chicos, no en un mercado de clubes grandes con ticketing masivo. Varios
patrones que funcionan en Europa no se sostienen aquí por falta de densidad o de datos.


## Vesti — la referencia más cercana, y la más importante

Vesti es la comparación real: opera en Chile, en la misma región, y ya lista recintos que también
tenemos (Studio Valparaíso, Manda en Reñaca, productoras locales). Es, ante todo, una **ticketera
con herramientas para productoras**: su centro de gravedad es vender entradas, gestionar accesos y
darle a un negocio su panel. Eso define lo que hace bien y lo que deja fuera.

### Qué hace mejor que nosotros

| | Por qué importa |
|---|---|
| **Imagen real en cada evento** | Su tarjeta es una fotografía o flyer del productor. La nuestra cae en arte generativo cuando no hay flyer, y eso siempre pierde contra una imagen real |
| **Identidad de negocio** | Cada productora o recinto tiene página con logo y banner. Se ve como suya |
| **Destacados y carrusel** | Tiene una superficie editorial de portada más rica |
| **Aplicación móvil** | iOS y Android; nosotros somos web |
| **Precio siempre presente** | El precio es un dato de primera clase porque venden |
| **Relación con el organizador** | El productor entra solo y publica |

### Qué adaptamos

- **Imagen primero.** Subir la jerarquía de imagen: flyer oficial → imagen del lugar → logo del
  lugar → arte generativo. Hoy sólo tenemos el primero y el último.
- **«Tu local tiene identidad».** Un lugar debe poder traer su logo y su banner, y la ficha debe
  sentirse parcialmente suya dentro de nuestro sistema.
- **Camino del organizador.** «Reclama este lugar» y envío de programación, sin construir panel de
  comercio todavía.

### Qué no copiamos nunca

- **Checkout y ticketing.** No queremos ser otra ticketera. Enlazamos a quien vende, incluida Vesti.
- **Producto centrado en la productora.** Nuestro usuario es quien sale, no quien produce.
- **Datos de clientes y control de acceso.** Fuera del alcance.
- **Sólo eventos con entrada.** Es exactamente el sesgo que nos hace falta corregir.

### Qué puede Carreteando que Vesti no

1. **Un lugar sin evento.** Un martes sin nada agendado, una ticketera queda vacía. Nosotros
   seguimos respondiendo dónde ir.
2. **La cola larga.** Un bar de la subida Cumming o un pub de Quintero nunca tendrá ficha de venta.
3. **Multi-fuente.** Agregamos Portaldisc, Ticketplus, Passline, municipios, cuentas oficiales y
   curaduría. Vesti muestra lo que se vende en Vesti.
4. **Zonas reales.** Subida Ecuador y Cerro Alegre, no comunas administrativas.
5. **Estado en vivo.** Nadie responde «¿está prendido ahora?» con reportes que caducan.
6. **Cuenta oficial como destino.** Para un bar chico, su Instagram es su sitio web.
7. **Ajuste cultural.** Fondas, cueca y cumbia como ciudadanos de primera.

### Vesti como fuente

Vesti es **una fuente**, no nuestro backend. Ya la usamos para fichas puntuales de evento, con
enlace de vuelta a ellos. No se elude autenticación ni control técnico, no se raspa de forma
agresiva, y cuando el dato viene de ahí, se dice y se enlaza. Su índice general es una SPA sin HTML
servido, así que la vía razonable es por ficha concreta, no por rastreo masivo.

## Resident Advisor

| Patrón | Decisión | Por qué |
|---|---|---|
| Grafo profundo club + evento + promotor | **USAR** | Es exactamente el modelo que ya adoptamos: lugar como entidad propia, evento colgando de él |
| Descubrimiento por cercanía | **ADAPTAR** | Sin geolocalización obligatoria. Zonas manuales primero; el mapa sólo cuando haya coordenadas legítimas |
| Filtros por género y fecha | **ADAPTAR** | El filtro de género sólo se expone cuando hay metadato real. Hoy la mayoría de nuestros eventos no declara género y un filtro vacío es peor que ninguno |
| Seguir club o promotor | **P1** | Requiere cuentas. Está en el backlog, no antes de la capa de identidad |
| Escenas locales editorializadas | **ADAPTAR** | Nuestras zonas (Subida Ecuador, Cerro Alegre) cumplen ese papel y son más específicas que «Valparaíso» |
| Archivo histórico de eventos | **IGNORAR** | Valor casi nulo para decidir dónde salir esta noche; añade superficie y coste |

## Xceed

| Patrón | Decisión | Por qué |
|---|---|---|
| El recinto como objeto rico: ambiente, música, fotos, contacto | **USAR** | Es la corrección central de esta fase. Ya expone tipo, zona, dirección, redes y agenda |
| Eventos conectados al club | **USAR** | Implementado con `venue_id`; 100% de los eventos vigentes enlazados |
| Fotos del local | **P2** | Depende de moderación, almacenamiento y derechos. En backlog, no ahora |
| Reserva y lista de invitados | **IGNORAR** | Sería convertirnos en ticketera; explícitamente fuera del foco |

## Shotgun

| Patrón | Decisión | Por qué |
|---|---|---|
| Identidad fuerte del recinto | **USAR** | Ficha estable, con su propia URL compartible |
| Distinción clara lugar / evento | **USAR** | Ya es la división del modelo; la tarjeta de lugar no imita a la de evento |
| Identidad del organizador | **ADAPTAR** | Guardamos organizador por evento; falta ficha de organizador, va a P1 |
| Próximos y pasados del recinto | **ADAPTAR** | Mostramos próximos. Los pasados aportan poco aquí y ensucian |
| Etiquetas de género | **ADAPTAR** | Mismo límite que RA: sólo con dato real |

## Partiful

| Patrón | Decisión | Por qué |
|---|---|---|
| Señales sociales: quién va | **P2** | Es parte de la visión del propietario, pero exige cuentas, bloqueo, denuncia y control de edad |
| Invitación como objeto compartible | **ADAPTAR** | Ya compartimos evento, lugar y zona por WhatsApp con texto legible |
| Creación de evento por cualquiera | **ADAPTAR** | Existe el canal de aportes, pero **nada se publica sin revisión**. No abriremos publicación directa |

## Fever

| Patrón | Decisión | Por qué |
|---|---|---|
| Tarjetas visuales fuertes | **USAR** | Es justamente lo que se corrigió: arte por tipo de noche en vez de quince mosaicos idénticos |
| Hoy / finde / cerca | **USAR** | Ya es la jerarquía de la portada |
| Curaduría presentada como experiencia | **ADAPTAR** | Sí a la curaduría; **no** a inventar «imperdible» sin criterio. «Joyita» debe significar algo |
| Precios dinámicos y venta | **IGNORAR** | No vendemos entradas |

## Lo que nos diferencia, y que ninguno de ellos resuelve aquí

1. **Densidad de cola larga local.** RA y Xceed cubren clubes grandes; el bar de Subida Ecuador no
   está en ninguno.
2. **Lugar útil sin evento.** Un martes sin programación, las otras apps quedan vacías.
3. **Estado en vivo de la comunidad.** Ninguna responde «¿está bueno ahora?» con reportes
   voluntarios que caducan.
4. **Zonas reales**, no comunas administrativas.
5. **Redes oficiales como destino**, no sólo la ficha de venta.
6. **Ajuste cultural**: fondas, dieciocho, cueca y cumbia son ciudadanos de primera, no una
   categoría «otros».

## Lo que no vamos a imitar

Ticketing propio, feed infinito, conteos de gente inventados, popularidad histórica como señal de
«está bueno», reseñas con estrellas que premian el sentimiento, y cualquier recompensa por reseñar
positivo.
