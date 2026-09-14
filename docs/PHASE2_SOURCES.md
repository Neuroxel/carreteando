# Fuentes y decisiones de fase 2

Revisión del 13–14 septiembre 2026. No hay acuerdos comerciales/API de organizadores confirmados. Prioridad: API/feeds autorizados, recepción privada de propuestas y revisión de páginas públicas; no evasión de autenticación ni anti-bot.

## Diagnóstico R2

22 items: 9 source_rejected, 4 malformed, 5 stale_post, 3 parse_failed y 1 expired; cero candidatos y cero duplicados. Se inspeccionaron los 13 captions conservados. Los nueve objetos sin propietario válido no se conservaron: no se puede distinguir retrospectivamente un error del proveedor de una fuente equivocada. Dataset público respondió 403; no se eludió.

Entre los 13: cuatro captions vacíos (posible información sólo visual), una agenda semanal ambigua, promociones genéricas, un cumpleaños y un evento pasado. No se confirmó un falso negativo vigente inequívoco en esos captions. El calendario oficial de Trotamundos sí contiene programación futura fuera de esa muestra: cero candidatos no demuestra ausencia de oferta. Recencia estricta, límite reducido y captions incompletos son vías de pérdida; su contribución causal exacta no es cuantificable con R2.

## Catálogo e hipótesis para R3

| Cuenta | Evidencia / relevancia | Decisión | Incertidumbre |
|---|---|---|---|
| el.huevo | Recinto nocturno de Valparaíso; fuente histórica | Activa en ensayo R3 | Yield y actividad actual requieren R3 |
| barelhuevo | Alias del mismo recinto en catálogo | Pausa para evitar redundancia | No se afirma cuenta muerta |
| trotamundosvalpo | Programación nocturna contrastada con calendario oficial | Activa + feed editorial | Los posts limitados no representan todo el calendario |
| clubtrotaquilpue | R2: cumpleaños/bienvenida mensual; actividad gastronómica | Pausa en ensayo | No se infiere cierre ni ausencia universal de shows |
| club_segundo_piso | Fuente histórica sin evidencia suficiente en R2 | Pausa hasta verificación | Existencia/actividad/yield actual no determinados |
| mascara_valparaiso | Recinto nocturno; agenda en evidencia R2 | Activa | Captions semanales requieren fechas independientes |
| paganocl | Fuente histórica sin evidencia suficiente en R2 | Pausa hasta verificación | Existencia/actividad/yield actual no determinados |
| clubdvina | Perfil público inspeccionado: club nocturno, Viña, sábados 23:45 | Nueva fuente R3 | Rendimiento y anticipación se medirán; perfil no prueba cada evento |

No hay tasas por cuenta de falsos positivos ni anticipación medias fiables antes de R3. El conteo de posts no se presenta como conteo de eventos.

## Oferta editorial verificable

Ocho fichas de conciertos nocturnos, 16–26 septiembre, en Trotamundos Valparaíso, Blanco 1253. Procedencia: [calendario enlazado por el recinto](https://linktr.ee/trotavalparaiso) y fichas específicas listadas en `data/editorial-events.json`. Cada fila conserva URL, fecha de revisión, motivo de aprobación y precio individual vigente observado; cargos aparte. No se presenta como confirmación directa del organizador.

Pibes Chorros: fuente con horas contradictorias; hora null y advertencia visible. Pascuala: se conserva 20:00 de la ficha de venta, aclarando que debe confirmarse inicio del show. Las preventas agotadas y promociones de dos personas no se usan como precio individual disponible.

Passline y Portaldisc rechazaron acceso programático con 403. No se añadió un scraper ni se sortearon controles. El adaptador importa un manifiesto editorial versionado y explícitamente aprobado, sin solicitudes automáticas al sitio. Su coste humano y mantenimiento no son cero.

Cobertura pendiente: Viña/Reñaca, Concón, Quilpué y Villa Alemana. Se investigaron Club D, Journal, Brisamar y colectivos/recintos costeros, pero no se aprobaron fechas dudosas o evidencia antigua. La ficha Porfi Baloa/Club D tiene contradicción de día de semana/fecha; se excluye hasta contraste. No se llena la cartelera con actividades familiares para simular densidad nocturna.

## Comparables y decisiones de producto

[Salir](https://salir.app/) ofrece hoy/cercanía/calendario con programación cultural amplia; [Resident Advisor](https://ra.co/events/cl/all) destaca fecha, género, promotor y entradas. Son observaciones de sus interfaces, no un estudio de cuota o cobertura regional. Carreteando puede aportar comparación local rápida de fecha, recinto, precio, procedencia y correcciones. Un mapa sin densidad local añade poca utilidad.

- NOW: oferta editorial verificable, separación de acceso/show, correcciones privadas y métricas por fuente/run.
- NEXT: responsable diario de curación, ampliar recintos/ciudades con evidencia, feeds de organizadores, retención y protección de tráfico antes de campañas.
- LATER: organizadores verificados, favoritos/retorno con consentimiento y curación under diferenciada.
- KILL: aforo inventado, seguimiento de asistentes, conteos de posts como eventos, aumentar límites sin diagnóstico y dedupe sólo por recinto/fecha.
