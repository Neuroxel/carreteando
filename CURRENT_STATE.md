# Carreteando — estado actual

**Este documento es la única verdad vigente.** Los informes de fase anteriores
son evidencia histórica y pueden contradecirlo; si difieren, manda este.

Última verificación: **2 de octubre de 2026**.

## Qué es

Un producto de descubrimiento de vida nocturna para la Región de Valparaíso.
Responde una pregunta: **«Estoy acá, ¿dónde salgo?»**

No es una ticketera. No vende entradas. Modela **lugares** (existen aunque hoy
no pase nada) y **eventos** (pasan en una fecha), y los conecta con **zonas** y
un **mapa**.

## Producción

| | |
|---|---|
| Sitio | https://carreteando.vercel.app |
| Repositorio | `Neuroxel/carreteando`, rama `main` |
| Despliegue | Vercel, automático desde `main` |
| Base de datos | Supabase (Postgres 17), plan Free |
| Marco | Next.js 15 App Router, React Server Components |

## Datos (verificado el 02-10-2026)

| | |
|---|---|
| Lugares publicados | 93 |
| Lugares con evidencia pendiente | 92 |
| Lugares cerrados | 3 |
| **Registros sin clasificar** | **0** (garantizado por *trigger*) |
| Eventos públicos vigentes | 26 (25 editoriales, 1 de fuente oficial) |
| Eventos vigentes en cola de revisión | 44 (41 de la ticketera) |
| Eventos vencidos sin revisar (barridos el 02-10) | 193 |

**Lo que pasó entre el 16-09 y el 02-10:** la automatización corrió todos los
días (49 corridas, 1 fallida el 16-09, ya corregida; `pg_cron` sin fallas), pero
19 de las 24 fuentes mandaban todo a revisión y **nadie revisó la cola** desde
el 16-09. Resultado: la cartelera pública se vació (de 119 a 26 vigentes) y 40
eventos se vencieron esperando. Octubre cambia eso (ver Automatización).

Completitud de los lugares publicados: identidad digital **67 %**, Instagram
**46 %**, coordenada verificada **66 %**, fuente de programación **60 %**,
imagen propia **0 %**.

## Modelo de confianza

Nada se publica sin fuente. Cada evento y cada lugar guarda de dónde salió y
cuándo se revisó. Los principios que no se negocian:

- **No se inventa** precio, horario, género, dirección ni estado de apertura.
- Lo que no se sabe **se dice que no se sabe**; no se rellena.
- Una imagen sin procedencia declarada **no entra** (hay una restricción en la
  base que lo impide).
- Un candidato sin disposición **no existe**: todo es `published`,
  `needs_evidence`, `closed`, `duplicate` o `rejected`, y `needs_evidence`
  obliga a declarar qué falta, dónde se buscó y cuándo se revisa de nuevo.
- La ingesta automática es **sólo inserción**: una corrección o un retiro del
  moderador nunca se pisan solos.

## Automatización

Cuatro trabajos programados en la propia base (`pg_cron` + `pg_net`):

| Trabajo | UTC | Chile |
|---|---|---|
| `carreteando-agenda-manana` | 14:00 | 11:00 |
| `carreteando-agenda-tarde` | 20:00 | 17:00 |
| `carreteando-agenda-noche` | 00:00 | 21:00 |
| `carreteando-limpieza-pases` | 03:30 | 00:30 |

El cron diario de Vercel (18:00 UTC) sigue como red de seguridad.

**No hay secreto compartido.** La base emite un pase de un solo uso desde una
tabla reservada al rol de servicio y el endpoint lo canjea una vez, dentro de
dos minutos. Quien pueda emitir un pase ya tiene acceso de rol de servicio.

**28 fuentes automáticas + 4 manuales**, cada una con familia, nivel de
confianza (A–D) y modo de acceso:

| Nivel | Qué es | Fuentes | Publica solo |
|---|---|---|---|
| A | Calendario oficial del propio lugar, fecha estructurada | Parque Cultural, Bar Cinzano | Sí, si es de noche y no está repetido |
| B | Ticketera hablando por un local conocido | 20 carteleras de Portaldisc | Solo si el año escrito y el día de la semana coinciden con la fecha, la hora es ≥ 18:00, el local es conocido y no hay duplicado |
| C | Directorios, universidades, municipios | Valpo Cultura, USM, 2 municipios | Nunca: van a revisión, y lo claramente académico o diurno se descarta antes |
| D | Instagram, pistas | Apify (pausado) | Nunca |
| Manual | Se mira a mano | UV (bloqueada por anti-bots), PUCV, UPLA, Puntos de Cultura | — |

**Clasificador de relevancia** determinista (sin IA, auditable):
`NIGHTLIFE_HIGH`, `CULTURAL_NIGHT`, `REVIEW`, `IRRELEVANT`, usando título,
descripción, categorías y hora. En USM descarta 13 de 15 actividades (talleres
a mediodía, seminarios, ferias).

**Barrido diario** (`carreteando-barrido-vencidos`, 04:15 UTC): lo que pasó de
fecha sin revisión queda `expired`, y la cola del panel muestra solo lo
vigente.

**Instagram/Apify:** corrió dos veces (13 y 14-09: 38 posts, US$ 0,08 en
total, 80 candidatos). Ninguno se publicó solo y ninguno fue aprobado. Está
pausado (`APIFY_PAUSED=true`) por costo/rendimiento; reactivarlo es decisión
del dueño.

## Automatización 3.0 — motor de evidencia

Detalle completo en `docs/AUTOMATION.md`. En corto:

- Cada fuente que menciona un evento deja **evidencia** (`event_evidence`) con
  su origen y autoridad. Los espejos de un mismo origen no cuentan dos veces.
- Después de cada ingesta, el motor **reevalúa toda la cola vigente**: publica
  lo confirmado (con evidencia de las últimas 72 h), descarta lo académico,
  vence lo pasado, cancela ante una cancelación explícita y manda a una persona
  solo las contradicciones y lo que no tiene prueba suficiente, **con el motivo
  escrito**.
- La precisión de cada fuente se aprende contra fichas humanas (límite de
  Wilson, con histéresis). La ticketera midió 23/23 sin errores.
- Backtest: 0 de 115 eventos aprobados por una persona habrían sido
  descartados; 1 contradicción real detectada (una reprogramación).
- **Estado: modo sombra.** Registra lo que haría sin cambiar nada. La
  activación (`automation_config.engine_mode = 'active'`) queda en manos del
  dueño.

Cartelera pública al 02-10 (antes de activar): 3 hoy, 6 este fin de semana,
7 en 7 días, 11 en 14 días; 43 vigentes esperando en la cola.

## Buscadores

- Dirección pública configurable con `NEXT_PUBLIC_SITE_URL` (si falta o es
  inválida, se usa `https://carreteando.vercel.app`).
- Evento: JSON-LD `Event` con hora local y desfase de Chile de esa fecha
  (`2026-10-10T22:00:00-03:00`), estado y modalidad; sin precio, hora ni lugar
  inventados.
- Lugar: tipo schema.org (`BarOrPub`, `NightClub`, `MusicVenue`,
  `PerformingArtsTheater`), dirección, `sameAs` con sus perfiles, coordenadas
  solo si son exactas. Nunca reseñas ni horarios inventados.
- Migas de pan (`BreadcrumbList`) en evento, lugar y zona.
- URLs con filtros: `noindex, follow` y canónico limpio. Zonas con menos de 3
  lugares: `noindex` y fuera del sitemap.
- IndexNow: la ingesta en producción avisa las URLs nuevas (Bing y otros).
  Clave pública en `/indexnow-key.txt`. Google no usa IndexNow: para Google
  queda el sitemap y Search Console (lo tiene que dar de alta el dueño).

## Admin

**Moderadores con nombre.** `review_audit` registra cada cambio con estado
anterior, posterior, revisión, nota, hora **y quién**. Cada moderador tiene
credencial propia y revocable; sólo se guarda el resumen SHA-256 del token.
Falta MFA (P1).

## Limitaciones conocidas

1. **0 de 93 lugares con imagen propia.** No se copian fotos de terceros sin
   derechos claros. Falta el flujo «Reclama este lugar».
2. **Sin MFA para moderadores.** Hay credenciales por persona y auditoría con
   nombre; falta un segundo factor.
3. **Tiles de mapa**: OpenStreetMap desaconseja uso intensivo; hay que pasar a
   un proveedor contratado antes de escalar.
4. **31 lugares sin coordenada fiable.** No se publica un pin dudoso.
5. **37 lugares sin fuente de programación.**
6. **Concentración de fuentes.** La ticketera es la mayor fuente automática. Si
   cambia su HTML, la cartelera automática cae a los niveles A y C. El panel
   muestra el porcentaje que aporta la familia más grande.
7. **Reportes en vivo sin uso orgánico.** Funcionan; nadie los ha usado aún.
8. **Respaldo sin ensayo de restauración.**
9. **Moderación humana.** Si nadie revisa, los niveles C y la parte dudosa del
   B se vencen en cola. El barrido evita que se pudra; no reemplaza a un
   moderador.
10. **Cobertura**: no se afirma haber encontrado todos los locales de la región.
   Eso no se puede demostrar.

## Veredicto

**Beta cerrada.** No MVP público: faltan imágenes propias, MFA para
moderadores, evidencia de uso real y una rutina de moderación que no dependa de
que alguien se acuerde.
