# Automatización 3.0 — motor de evidencia

Vigente desde el 2 de octubre de 2026. El objetivo no es "cero personas": es
que **una persona solo vea lo que de verdad tiene duda**.

## Por qué existe

En septiembre la ingesta funcionó todos los días, pero 19 de 24 fuentes
mandaban todo a revisión y nadie revisó. 193 eventos se vencieron esperando.
El problema no era encontrar eventos: era decidir sobre ellos.

## Cómo piensa

Un evento no es "una fila de una fuente". Es todo lo que distintas fuentes
afirman sobre él. Cada vez que una fuente lo menciona deja **evidencia**
(`event_evidence`): qué dice (título, fecha, hora, lugar, estado), desde dónde
(`origin_group`), con qué autoridad, y cuándo se leyó.

### Autoridad (de mayor a menor)

| Autoridad | Quién | Ejemplos |
|---|---|---|
| `human` | Ficha revisada por una persona | selección editorial, moderador |
| `first_party` | El que organiza o el lugar | calendario oficial del local, del artista, de la universidad |
| `transactional` | Quien vende la entrada | ticketera |
| `directory` | Agenda de terceros | Valpo Cultura, municipios |
| `community` | Aporte del público | `/publicar` |
| `lead` | Pista sin confirmar | post o comentario en redes |

Un moderador con nombre siempre manda: la automatización **nunca cambia** una
fila que una persona tocó; solo anota la duda.

### Orígenes, no URLs

Dos URLs no son dos fuentes. Las 20 carteleras de la ticketera son un origen
(`portaldisc`); una ficha editorial copiada de la ticketera también. Un
directorio puede estar copiando a cualquiera, así que **nunca cuenta como
confirmación independiente**. Confirmación independiente = dos orígenes
distintos con autoridad `first_party` o `transactional`.

### Decisiones

`evaluateEventEvidence()` en `lib/sources/evidence.ts`, función pura:

| Decisión | Cuándo |
|---|---|
| `AUTO_EXPIRE` | la fecha pasó |
| `AUTO_CANCEL` | una fuente con autoridad escribe "cancelado/suspendido" |
| `REVIEW_CONFLICT` | fuentes con autoridad discrepan en fecha, lugar o hora (>90 min); la fuente cambió la fecha; una cartelera completa dejó de mostrarlo; reprogramación. Si estaba publicado, **se retira** hasta que una persona lo vea |
| `AUTO_REJECT` | señal académica explícita (seminario, taller, charla…); misma ficha que otra fila; ya publicado con otro título; fuera de la región |
| `AUTO_PUBLISH` / `AUTO_PROMOTE_FROM_REVIEW` | ver abajo |
| `REVIEW_INSUFFICIENT` | todo lo demás, con el motivo escrito |

**Publica sin persona** si se cumple una de estas, con evidencia leída en las
**últimas 72 horas**:

- A. Calendario oficial del lugar, estructurado, fuente con nivel `auto`,
  lugar conocido, no diurno.
- B. Ticketera con nivel `strict` o mejor, año y día de la semana coinciden
  con la fecha, lugar conocido, hora ≥ 18:00.
- C. Dos orígenes independientes coinciden.
- D. Ficha humana sin contradicción.

Contradicciones no se promedian. Falla hacia lo privado.

## Confianza que se aprende

Por origen, se compara lo que dijo la fuente con lo que una persona verificó:

- **Coincide** (fecha y lugar) → confirmado.
- **Discrepa** cuando la fuente lo dijo antes o hasta 2 días después de la
  ficha → error grave.
- **Discrepa** más de 2 días después → no se cuenta (puede ser una
  reprogramación real; la detecta el motor de contradicciones).

Precisión = **límite inferior de Wilson al 95 %**: 2 de 2 no es 100 %.

| Nivel | Para subir | Para bajar |
|---|---|---|
| `review` → `strict` | ≥ 15 verificados, límite ≥ 80 %, ≤ 3 % errores graves | — |
| `strict` → `auto` | ≥ 40 verificados, límite ≥ 95 %, 0 errores graves | — |
| `auto` → `strict` | — | límite < 90 % o cualquier error grave (con ≥ 10) |
| `strict` → `review` | — | límite < 70 % o > 6 % errores graves (con ≥ 10) |
| cualquiera → `review` | — | la fuente falló 2 veces seguidas o cambió de forma |

Cada nivel tiene techo: A → `auto`, B y C → `strict`, D → `review`.

## Backtest (2 de octubre de 2026)

Etiquetas disponibles: 115 eventos aprobados por una persona (selección
editorial y ticketera curada) y 1 rechazado. Los demás vencieron sin que nadie
los mirara: no son etiquetas.

**Parser de la ticketera contra fichas humanas** (relectura en vivo, por URL):
24 comparadas; fecha 23/24, hora 23/24, lugar 24/24. La única diferencia es
una **reprogramación real** (José Alfredo Fuentes: 3 → 11 de octubre). Sin
errores del parser. Límite de Wilson 23/23 = 85,7 % → justifica `strict`.

**Motor sobre el histórico** (cada evento juzgado como si acabara de llegar,
sin su ficha humana):

| Etiqueta | Publicar | Descartar | Persona | Contradicción |
|---|---|---|---|---|
| Aprobado por persona (115) | 0 | **0** | 114 | 1 (la reprogramación) |
| Rechazado (1) | 0 | 0 | 1 | 0 |

La primera versión descartaba 6 fondas diurnas aprobadas a mano; desde
entonces el descarte automático exige una señal académica explícita. Ninguna
publicación automática contradice una etiqueta humana. Ninguna pista de
Instagram (162) se publica.

Limitación honesta: las fichas editoriales no guardaban el texto original con
el año, así que en el backtest no podían cumplir la regla B; por eso "publicar"
sale 0 en esa fila. La precisión de la regla B se midió con la relectura en
vivo de arriba.

## Modo sombra y activación

`automation_config.engine_mode`: `shadow` registra lo que haría sin tocar
nada; `active` aplica. Con el motor activo, la ingesta solo reúne evidencia y
el motor decide. Cada decisión queda en `automation_decisions` con el estado
anterior, para poder deshacerla.

## Revalidación antes del evento

Una fuente con eventos en las próximas 72 h se vuelve a leer antes de su
turno: cada 12 h si el evento es en 1–3 días, cada 6 h si es en menos de 24.
Nunca más seguido.

## Redes sociales

- **Comentarios: no se usan.** Ni likes, ni cantidad de comentarios, ni
  entusiasmo prueban que un evento exista. Meta no ofrece acceso legítimo a
  comentarios de cuentas de terceros sin su autorización, y no se va a saltar
  esa restricción. Una respuesta fijada del organizador sería una señal fuerte,
  pero no hay forma legítima de leerla hoy.
- **Posts de la propia cuenta** (local, organizador, artista): serían
  evidencia `first_party`, pero el único acceso fue Apify (pausado). Si se
  reactiva, entra como `lead` hasta que la cuenta esté verificada como del
  organizador, y nunca publica sola.
- No se guardan identidades de comentaristas ni de asistentes.

## Patrones internacionales, sin exagerar

- **Bandsintown**: importa de muchos proveedores y deja que el artista o el
  lugar corrijan. Aquí: evidencia de varios orígenes con precedencia de la
  primera parte y de la corrección humana.
- **Songkick**: protege los datos según el riesgo. Aquí: la autoridad y la
  precisión aprendida deciden qué se publica solo; lo dudoso va a persona.
- **Resident Advisor**: lo que manda la comunidad pasa por moderación. Aquí:
  los aportes del público nunca se publican solos.

Carreteando usa una mezcla porque no tiene ninguna de sus ventajas: ni una
base de artistas que se registren, ni volumen para moderar todo a mano.

## Hacia dónde va: "Reclama este lugar"

El límite de este enfoque es leer páginas ajenas. La salida de largo plazo es
que un lugar verificado entregue su propio calendario (ICS, RSS, formulario).
El punto de entrada ya está: una fuente nueva con familia `VENUE_OFFICIAL`,
adaptador estructurado y nivel A publica bajo la regla A desde el primer día.
