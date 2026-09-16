# Carreteando — estado actual

**Este documento es la única verdad vigente.** Los informes de fase anteriores
son evidencia histórica y pueden contradecirlo; si difieren, manda este.

Última verificación: **16 de septiembre de 2026**.

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

## Datos (verificado el 16-09-2026)

| | |
|---|---|
| Lugares publicados | 93 |
| Lugares con evidencia pendiente | 92 |
| Lugares cerrados | 3 |
| **Registros sin clasificar** | **0** (garantizado por *trigger*) |
| Eventos vigentes | 119 |
| Eventos del 17 al 21 de septiembre | 74 |

Completitud de los lugares publicados: identidad digital **67 %**, Instagram
**46 %**, coordenada verificada **66 %**, fuente de programación **60 %**,
imagen propia **0 %**.

Imágenes de eventos vigentes: **55 %** con visual oficial real (cartel del
local, gráfica municipal o ticketera). El resto usa el sistema gráfico propio.

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

**24 fuentes** registradas: 2 publican sin revisión (calendario oficial del
propio local con fecha estructurada), 19 pasan por la cola, 2 municipales y
el import editorial.

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
6. **Reportes en vivo sin uso orgánico.** Funcionan; nadie los ha usado aún.
7. **Respaldo sin ensayo de restauración.**
8. **Cobertura**: no se afirma haber encontrado todos los locales de la región.
   Eso no se puede demostrar.

## Veredicto

**Beta cerrada.** No MVP público: faltan imágenes propias, credenciales por
persona y evidencia de uso real.
