# R2 — evidencia y límites

Ejecución real en producción el 13-09-2026 a las 13:13 Chile, sobre `444885b0d398bf402ef0d08772a971f1b68784b9`. Vercel → Apify → clasificación → Supabase funcionó. Se solicitaron 7 cuentas con límite 5; no se demuestra cobertura exitosa de cada cuenta por separado.

Resultado: 22 registros; 9 rechazados por autor, 4 sin caption, 5 antiguos, 3 sin fecha confiable y 1 clasificado vencido. Cero candidatos, cero inserciones canónicas y cero eventos publicados. Duración 47,102 s. Coste del proveedor registrado: **US$0,0486**. Las 161 filas históricas siguen inactivas. El cron no aprobó contenido.

**Precisión de candidatos: indeterminada (0 revisados / 0 candidatos).** No es 100%. Coste por evento válido único publicado: indeterminado, denominador cero. Tampoco puede calcularse recall con esta muestra: falta un inventario completo de eventos reales y el parser no interpreta flyers/video.

## Revisión manual

Se revisaron los 13 registros persistidos de autores permitidos, incluidos sus 9 captions no vacíos. Tres páginas originales se contrastaron en Instagram: `DdHlPE3FnhM`, `DdHpYEgzJtQ`, `DdBdjwwCQSh`. El resto se evaluó sobre la evidencia textual guardada, sin afirmar inspección visual de cada publicación. Los otros 9 registros rechazados por autor permanecen en el dataset del proveedor; no fueron inspeccionados manualmente.

| Post | Etiqueta manual | Observación y decisión |
|---|---|---|
| DdHlPE3FnhM | AMBIGUOUS / WRONG DATE | Resumen de jueves 10 a domingo 13. El parser tomó sólo el jueves: fallo real de extracción, aunque no produjo publicación. Instagram confirma varias fechas; no convertirlo en un evento único. |
| DctmzN7uDhi | AMBIGUOUS | Caption vacío; no afirmar que no existe evento. |
| DdBdjwwCQSh | AMBIGUOUS | Caption vacío, también en la página original consultada; contenido visual no extraído. |
| DdNt3ovmqb9 | AMBIGUOUS | Caption vacío; requiere revisión del contenido visual. |
| DYORYOEsJa2 | AMBIGUOUS | Caption vacío y publicación histórica. |
| DdHk63pggxK | FALSE POSITIVE si se aceptara | Promoción permanente de cumpleaños, sin evento fechado. Rechazo correcto. |
| DdHpYEgzJtQ | AMBIGUOUS | Viernes «o sábado», ofertas del local. Instagram confirma el texto ambiguo. |
| DdIIwevzT06 | AMBIGUOUS; texto duplicado | Mismo caption del anterior. No prueba de dos eventos ni de un evento único identificable. |
| DbUPWM2FkDH | TRUE EVENT histórico, vencido | Fiesta Dark & Wave del 5 de septiembre según caption. No vigente el día de R2. |
| Dc68qknAMi_ | FALSE POSITIVE si se aceptara | Promoción de todo septiembre, sin noche concreta. |
| DcvwDQ3R4Sp | FALSE POSITIVE si se aceptara | Saludo mensual e invitación a comentar, sin evento. |
| DOFAjDujUuI | AMBIGUOUS | Sólo emojis, publicación de 2025. |
| DYOXgB_NBCE | FALSE POSITIVE si se aceptara | Bienvenida al recinto de mayo, sin noche concreta. |

Estas etiquetas evalúan los descartes; no son falsos positivos publicados. No hubo candidatos sobre los que estimar precisión de publicación ni errores de ubicación.

## Corrección derivada de R2

El caso semanal reprodujo un fallo RED. Ahora el parser rechaza múltiples combinaciones día de semana/número incluso si sólo la primera incluye el mes. Tests GREEN. Reprocesamiento local de las 13 evidencias con el reloj de R2: cambia únicamente `DdHlPE3FnhM`, de `expired` a `parse_failed`; siguen cero candidatos. Los timestamps SQL se normalizaron a ISO antes de reproducir la entrada. No se cobró otra extracción ni se reescribió el registro original de R2. Véase `evidence/r2-replay.json`.

## Siguiente experimento

Conseguir una muestra curada de 30–50 publicaciones consecutivas y su verdad de terreno (flyer + caption + recinto + fecha), incluyendo descartes. Medir por separado precisión, recall, duplicados, vigencia y coste humano. La ventana de 3 días, posts fijados antiguos, autores colaboradores excluidos y captions vacíos limitan cobertura. No ampliar indiscriminadamente el scraping para llenar la portada.
