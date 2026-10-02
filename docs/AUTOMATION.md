# Automatización 3.0 — motor de evidencia

Vigente desde el 2 de octubre de 2026. El objetivo no es "cero personas": es
que **una persona solo vea lo que de verdad tiene duda**.

## Por qué existe

En septiembre la ingesta funcionó todos los días, pero 19 de 24 fuentes
mandaban todo a revisión y nadie revisó. 193 eventos se vencieron esperando.
El problema no era encontrar eventos: era decidir sobre ellos.

## Dónde corre (sin IA)

```
Supabase pg_cron (11:00, 17:00 y 21:00 de Chile)
  → GET https://carreteando.vercel.app/api/cron/scrape   (pase de un solo uso)
    → adaptadores de fuentes        lib/sources/adapters/*
    → evidencia                     tabla event_evidence
    → evaluador determinista        lib/sources/evidence.ts  (7 reglas)
    → publicar / descartar / persona  (lib/sources/automation.ts aplica)
```

**No hay IA, ni modelos de lenguaje, ni embeddings.** El evaluador es
TypeScript común: comparaciones de fechas, nombres y niveles fijos. La misma
entrada da siempre la misma salida, y cada decisión guarda la regla que la
tomó.

## Las 7 reglas

| # | Regla | Resultado |
|---|---|---|
| 1 | Fuente oficial (nivel A), estructurada, lugar conocido, sin contradicción | publicar |
| 2 | Ticketera (nivel B), fecha verificada (año y día de la semana, o estructurada), hora escrita, lugar conocido | publicar |
| 3 | Dos orígenes fuertes e independientes coinciden | publicar |
| 4 | Pasado, duplicado (misma ficha o mismo evento ya publicado), académico explícito, fuera de la región | vencer / descartar |
| 5 | Una fuente fuerte dice "cancelado" | cancelar |
| 6 | Contradicción en fecha, lugar, hora (más de 90 min) o reprogramación | persona; si estaba publicado, se retira |
| 7 | Todo lo demás | persona, con el motivo escrito |

Condiciones comunes para publicar: evidencia leída en las **últimas 72 horas**
(caso real: un show se movió del 9 al 11 y la cola guardaba la fecha vieja) y
hora no diurna (antes de las 17:00 decide una persona).

**Datos críticos** (deben ser correctos): que el evento exista, fecha, lugar,
ciudad, cancelación. **No críticos** (pueden faltar o estar incompletos):
estilo, ambiente, precio, imagen, descripción. Nunca se rechaza un evento real
porque falte el estilo o el precio.

**Niveles fijos**, declarados en `lib/sources/registry.ts`: A oficial,
B ticketera, C directorio o institución, D red social o pista. No cambian
solos. La precisión medida por fuente se muestra en el panel como
diagnóstico, para revisarla con datos reales de octubre.

**Lo editado por una persona** no se cambia nunca. Si después una fuente con
autoridad contradice un dato crítico, el evento se **retira** a revisión (no
se corrige solo): la persona decide el valor correcto.

### Autoridad y orígenes

| Autoridad | Quién |
|---|---|
| `first_party` | el local, el organizador, el artista, la universidad |
| `transactional` | la ticketera que vende la entrada |
| `directory` | agendas de terceros, municipios |
| `community` | aportes del público |
| `lead` | posts y pistas de redes |
| `human` | ficha revisada por una persona (solo para medir, no para decidir) |

Dos URLs no son dos fuentes: las 20 carteleras de Portaldisc son un solo
origen. Confirmación independiente = dos orígenes distintos con autoridad
`first_party` o `transactional`.

### Lo que se sacó o se dejó para después

| Mecanismo | Estado | Por qué |
|---|---|---|
| Subir y bajar niveles automáticamente según la precisión | quitado de las decisiones; queda como diagnóstico | no resolvía un fallo observado; se revisa con datos de octubre |
| "La cartelera ya no lo muestra" → retirar | diferido | ningún caso real lo pidió |
| Publicar por la ficha humana | quitado | lo humano ya está publicado; no aporta |
| Comentarios de redes | no se hace | ruido, riesgo de plataforma, sin acceso legítimo |
| Grafo de promotores, artistas y colectivos | diferido | hasta que las fuentes muestren que hace falta |

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

## Cómo mantener esto

| Quiero… | Dónde |
|---|---|
| Ver o cambiar las reglas | `lib/sources/evidence.ts`, función `evaluateEventEvidence` (unas 110 líneas) |
| Ver cómo se aplican | `lib/sources/automation.ts`, función `reevaluate` |
| Ver los adaptadores | `lib/sources/adapters/` (`wordpress`, `portaldisc`, `tribe`, `usm`, `jsonld`, `ics`) |
| **Agregar una fuente** | una entrada en `SOURCES` de `lib/sources/registry.ts` con `family`, `tier`, `adapter` y `config`. Si publica Event en JSON-LD o tiene `.ics`, no hace falta código nuevo |
| **Desactivar una fuente** | sacarla de `SOURCES` (o pasarla a `MANUAL_SOURCES`), o en la base: `update event_sources set active = false where id = '…';` |
| Ver por qué se publicó un evento | panel `/admin` (cada evento muestra su regla y evidencia), o `select * from automation_decisions where event_id = …;` y `select * from event_evidence where event_id = …;` |
| Deshacer una decisión | la columna `previous` de `automation_decisions` guarda el estado anterior; se aprueba o retira desde el panel |
| **Volver a modo sombra** | `update automation_config set value = 'shadow' where key = 'engine_mode';` (sin desplegar) |
| Correr el motor sin esperar | `/api/cron/automatizacion` (con pase) |
| Repetir el backtest | `/api/cron/automatizacion?modo=backtest` (con pase); escribe en modo `backtest`, no cambia eventos |
| Ver el snapshot público | `https://carreteando.vercel.app/api/snapshot` (versión, hora, eventos y lugares) |
| Pruebas | `npm test` (`tests/evidencia.test.ts`, `tests/adaptadores-genericos.test.ts`) |

## Hacia dónde va: "Reclama este lugar"

El límite de este enfoque es leer páginas ajenas. La salida de largo plazo es
que un lugar verificado entregue su propio calendario (ICS, RSS, formulario).
El punto de entrada ya está: una fuente nueva con familia `VENUE_OFFICIAL`,
adaptador estructurado y nivel A publica bajo la regla A desde el primer día.
