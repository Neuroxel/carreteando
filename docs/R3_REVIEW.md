# R3: ocho eventos públicos, con rendimiento automático todavía insuficiente

Ejecución real sobre `94d84f57bf1d10fc12395d100008c99f0d6e7822`, después de CI y Vercel Ready. Run `0eca04b9-5dc0-4fea-b9e7-2124fdf24dd2`, 14 septiembre 2026 04:35:34 UTC; duración 32,849 s. [Métricas reproducibles](evidence/r3-summary.json).

| Medida | Resultado |
|---|---:|
| Cuentas solicitadas | 4 |
| Items del proveedor | 16 |
| Items con propietario del catálogo | 11 |
| Source rejected | 5: cuatro autores fuera del catálogo y un error del proveedor |
| Malformed / parse failed / stale / expired | 3 / 4 / 1 / 2 |
| Candidatos de Instagram guardados pendientes | 1 |
| Autoaprobados de Instagram | 0 |
| Duplicados suprimidos automáticamente | 0 |
| Duplicados identificados en revisión | 1 |
| Eventos editoriales revisados / importados / públicos | 8 / 8 / 8 |
| Nuevos eventos únicos públicos aportados por Instagram | 0 |
| Coste Apify | US$0,0297 |

## Muestra revisada y límites

El único candidato, `DdP8BE2kQDC`, anuncia Los Mirlos el 18 de septiembre en Trotamundos Valparaíso. Fecha y lugar correctos, evento real, pero duplicado de `curated-202609-mirlos`. Se rechazó el candidato y se dejó correspondencia en `ingestion_runs.metrics.manual_review`; el original conserva su evidencia. Precisión semántica 1/1 en esta muestra mínima; rendimiento de nuevos eventos únicos 0/1; duplicación manual 1/1, no 0%. No extrapolar 100% al sistema.

Las ocho fichas editoriales se contrastaron con el calendario enlazado por el recinto y sus fichas de venta: 8/8 eventos reales en la muestra seleccionada, 8/8 fechas y lugares coherentes. Hora publicada en 7/8; Pibes Chorros mantiene hora desconocida por contradicción interna. Pascuala conserva hora de ficha y pide confirmar inicio de show. Esta muestra está seleccionada por revisión previa: no estima precisión de un scraper ni recall de toda la región.

R3 conserva outcomes por item: el.huevo 3, trotamundosvalpo 3, mascara_valparaiso 5; cuatro autores no autorizados (trotalovers x2, levelvalparaiso, notpxndx). Club D no produjo propietario aceptado; atribuirle el error sin propietario es una inferencia, no un hecho demostrado. Los límites de extracción y posts colaborativos siguen afectando cobertura. La fecha del único candidato es posterior a R2: no demuestra que ampliar la ventana o cambiar el parser haya causado la mejora.

Proxy explícito de cobertura: el pipeline automático recuperó 1 de los 8 eventos conocidos del calendario editorial, con universos y ventanas distintos (12,5%, sólo proxy descriptivo). El canal editorial publica los ocho. El recall global permanece no determinado. No hay evidencia suficiente para culpar a un único filtro ni justificar subir presupuesto sin otra hipótesis.

R4 no se ejecutó: R3 fue técnicamente exitoso, añadió la oferta editorial, y el candidato restante se resolvió sin otra extracción. Repetir las mismas cuentas de inmediato no resolvería el problema de cobertura; se conserva el cooldown de seis horas.

Coste acumulado R2+R3: US$0,0783. No dividir US$0,0297 por ocho para anunciar coste por evento automatizado: los ocho requirieron curación separada y el rendimiento único de Instagram fue cero. El coste humano no se midió.

## Aceptación operativa

**INTERNAL TEST.** Ya se puede comprobar el producto con eventos reales, compartir fichas y proponer correcciones en privado. No se ha demostrado renovación sostenida de la oferta ni se ha asignado un responsable diario de moderación. Hay cinco eventos entre el 16 y el 19 de septiembre y tres el siguiente fin de semana, todos en el mismo recinto. No representa una oferta regional amplia.

Siguiente acción del propietario: designar quién revisará diariamente bandeja y fuentes, y sostendrá la curación de la beta. No hace falta rotar otra credencial ni entregar claves. Tras establecer esa operación, validar dos fines de semana y ampliar recintos/Viña mediante fuentes con autorización o evidencia pública suficiente. No se enviaron mensajes a organizadores ni se asumieron acuerdos comerciales.
