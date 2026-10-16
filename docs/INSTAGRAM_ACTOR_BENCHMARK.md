# Benchmark de actores de Apify para Instagram

Corte: 2026-10-16, datos leídos en vivo de la Apify Store (API pública de `acts/<actor>`).

## Candidatos

| | `apify~instagram-scraper` (actual) | `apify~instagram-post-scraper` | `apidojo~instagram-scraper` |
|---|---|---|---|
| Precio por post, plan FREE | USD 0,0027 (`result`) | USD 0,0017 (`post`) | USD 0,0005 |
| Escalones | 0,0023 (Bronze) … 0,0005 (Diamond) | 0,0015 … 0,0004 | 0,00049 … 0,00047 |
| Límite por cuenta | `resultsLimit` por URL | `resultsLimit` por perfil | no; solo `maxItems` global |
| `onlyPostsNewerThan` | sí | sí | `until` (fecha) |
| `skipPinnedPosts` | no (se filtra en código) | sí | no |
| Tope de gasto | `maxTotalChargeUsd` por corrida (Apify) | igual | igual |
| Menciones / coautores | `mentions`, `coauthorProducers` | listados en la descripción | no garantizado |
| Usuarios 30 días | 53 043 | 15 868 | 881 |
| Valoración | 4,67 | 4,28 | 4,70 |
| Corridas OK / total (30 días) | 99,6 % | 99,9 % | 98,5 % (1,3 % abortadas) |

Las tasas de éxito salen de `publicActorRunStats30Days` y cuentan corridas, no cobertura de cuentas. El "~49 %" que mostraba la ficha de la tienda no es comparable y se descarta.

## Lectura

- **apidojo** es 5 veces más barato, pero no limita posts por cuenta. Con 15 cuentas y `maxItems` global, una cuenta muy activa se come el cupo y las demás quedan sin leer, que es justo el fallo que hay que evitar (piloto 1 leyó 9 de 15 cuentas). Tampoco garantiza menciones ni coautores. Se descarta para el registro por cuenta.
- **post-scraper** cuesta 37 % menos que el actual. Trae `skipPinnedPosts` nativo y límite por perfil, y es del mismo editor (Apify) que el actual.
- **actual**: es la referencia. El piloto 1 costó USD 0,0783 por 31 ítems (≈0,0025 por ítem), consistente con su tarifa FREE.

## Corrida comparativa: pendiente

El código ya está listo en `feat/instagram-ingestion-v2`. La cohorte `BENCH` tiene 5 cuentas (mascara_valparaiso, studiovalparaiso, psiquis.bar, manda.chile, glasgowpub), con la misma ventana (7 días), el mismo límite (3 posts por cuenta) y un tope de USD 0,25 por actor (0,50 en total).

No se ejecutó: `APIFY_API_TOKEN` es variable sensible de Vercel y solo es legible por código desplegado. Correr el benchmark exige desplegar la rama a producción, y eso requiere autorización explícita del dueño.

Para ejecutarlo hay que armar en la base `automation_config.instagram_pilot = 'armed-BENCH-scraper'` y llamar a `/api/cron/piloto-instagram?cohorte=BENCH&actor=apify~instagram-scraper` con un ticket de `issue_cron_ticket()`. Luego se repite con `armed-BENCH-post` y `actor=apify~instagram-post-scraper`. Cada respuesta deja en `instagram_pilot_runs.summary` cuentas leídas y faltantes, completitud de campos y costo.

## Decisión provisoria

Se mantiene `apify~instagram-scraper` hasta tener la corrida comparativa. Se cambia a `apify~instagram-post-scraper` solo si en BENCH cumple tres condiciones:

1. lee al menos las mismas cuentas;
2. trae `timestamp`, `caption` y `mentions` en una proporción igual o mayor;
3. cuesta menos.

La confiabilidad pesa más que los centavos.
