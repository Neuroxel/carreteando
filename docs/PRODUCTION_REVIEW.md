# Revisión de producción

**Veredicto: NOT READY para apertura pública.** Hay una base de código desplegable y probada, pero faltan cerrar la revocación de credenciales heredadas y demostrar oferta local válida. Una ejecución técnica correcta con cero candidatos no acredita utilidad ni precisión.

## Implementado

- `lib/server-events.ts`, `lib/events.ts`: lecturas server-side con proyección explícita, cero canónico, error diferenciado, sin localStorage, sólo aprobados activos vigentes en Chile; detalle con ID exacto.
- `lib/community-api.ts`, `lib/submission-validation.ts`, APIs publicar/reportar: validación, body acotado, dedupe y cuotas persistentes, bandeja privada; nunca publicación anónima directa ni éxito anticipado.
- `lib/ingestion.ts`, `lib/event-extraction.ts`, cron: autor permitido real, fechas estrictas, campañas, precio de entrada, candidatos inactivos, dedupe por recinto/noche, presupuesto/timeout/cooldown y registros privados.
- `lib/server-freshness.ts`: aviso público de consulta de fuentes atrasada (>36 h), fallida, en curso o no comprobable, sin exponer el registro administrativo. No equivale a revisión humana ni a cobertura completa.
- `components/Explore.tsx`, tarjetas/detalle/formularios y CSS: diseño nocturno mobile-first, filtros compartibles, fuente, compartir/copiar, imagen fallback, vacío/error/404, enlaces por zona. Radar y mapa ficticios retirados mediante redirecciones.
- Metadata, OG generado, JSON-LD con campos conocidos, robots y sitemap dinámico; canonical carreteando.vercel.app. Retiradas promesas de usuarios, radar y verificación sin sustento.

## Esquema aplicado

`supabase/migrations/20260913005823_production_trust_baseline.sql`: evolución aditiva de events y tablas privadas community_inbox, ingestion_runs e ingestion_posts; RPC de recepción y reserva con advisory locks. Mantiene 161 históricos en cuarentena. SELECT público exige activo + aprobado + fecha local vigente; sin INSERT/UPDATE/DELETE públicos; recent_events security_invoker.

## Evidencia

- Local: **25 tests**, lint sin avisos, TypeScript, build y npm audit de producción pasan; 0 vulnerabilidades reportadas. `evidence/final-local-verify.txt`.
- Base implementada `444885b0d398bf402ef0d08772a971f1b68784b9`: GitHub Actions [34767797104](https://github.com/Neuroxel/carreteando/actions/runs/34767797104) success; Vercel Ready, deployment `carreteando-lzw075y49-neuroxel.vercel.app`. El ajuste posterior de fechas/frescura se verifica por su SHA en el cierre de esta entrega; no atribuirle retrospectivamente R2.
- Producción: rutas home/buscar/publicar/zonas/confianza/como-funciona 200; detalle inexistente 404; Radar/Mapa 308; OG/sitemap/robots 200. `/api/eventos` 200 con total 0; cron sin autorización 401. `evidence/production-http.json`.
- Formulario real: UI mostró recibido/pendiente y la fila privada fue comprobada; muestra QA rechazada después de verificarla. No creó evento público.
- Navegador: escritorio y móvil 390×844, ancho del documento 375 sin desborde de página; filtro Viña reflejado en URL. Sin medición Lighthouse ni experimento de usabilidad con usuarios reales.
- Prueba SQL con transacción/rollback en Supabase: PASS para anon/authenticated, vista, recepción, duplicados, cuota y cooldown. Conteos corroborados tras rollback. Script `supabase/tests/trust.sql`.
- Security Advisor tras migración: 0 errores/warnings; 3 INFO por RLS sin policies en tablas privadas sin grants públicos. Esto no acredita revocación de credenciales ni ausencia de incidentes históricos.
- R2: 7 cuentas solicitadas, 22 registros, 0 candidatos, US$0,0486, 47,102 s; 161 filas canónicas / 0 activas. Muestra, denominadores y límites en [R2_REVIEW.md](R2_REVIEW.md).
- Estimación del build: JS inicial home 184 kB en baseline → 112 kB; detalle 113 kB. No es una medición de latencia móvil real.

## Bloqueos y límites

1. Cerrar la puerta operativa de credenciales heredadas antes de apertura pública; el informe local privado conserva la comprobación específica. Las nuevas escrituras usan exclusivamente sb_secret_ server-side. No publicar claves ni recuperar una clave comprometida como fallback.
2. Cero densidad demostrada. Parser sin OCR/video, ventana conservadora y sources limitados; no se garantiza cobertura de Viña/Reñaca ni de todas las cuentas solicitadas.
3. Moderación manual documentada mediante Supabase; falta responsable y plazo operativo acordado. No hay panel, avisos al remitente ni garantía de revisión inmediata.
4. Sin CAPTCHA/WAF específico ni retención automática. Cuotas y honeypot son defensa inicial; IP compartida puede limitar usuarios legítimos. Antes de campaña abierta: Turnstile/WAF y retención.
5. URLs Instagram pueden vencer; fallback funcional, sin mirroring propio. Imágenes remotas no optimizadas por el servidor evitan proxy arbitrario, pero pueden pesar más.
6. Lecturas no-store priorizan retiradas inmediatas, tope 300; paginación e invalidación antes de escala. No hay pruebas de carga ni SLO demostrado.
7. Sin analítica conductual ni PMF demostrado. Compartir depende de Web Share/clipboard y permisos del navegador; copia manual disponible. Ningún dato de asistentes se captura.

## Experimentos y salida

- Resolver el control de credenciales, volver a comprobar rechazo del token antiguo y continuidad del sitio, formularios y cron. Después habilitar únicamente **INTERNAL TEST**.
- Curar 3–6 planes válidos por noche, durante dos fines de semana; medir vigencia, cobertura por zona, duplicados, correcciones y minutos humanos/evento.
- Etiquetar 30–50 publicaciones consecutivas con flyers/captions y verdad de terreno; medir precisión y recall por separado. No extrapolar el cero de R2.
- Pruebas consentidas con usuarios locales: tiempo para encontrar precio/hora/fuente, abrir y compartir un plan; registrar errores y motivos de abandono.
- Analítica propuesta, aún no instalada: home_view, filter_selected, event_opened, source_clicked, directions_clicked, event_shared, submission_started/completed e incorrect_info_reported. Medir tasas con denominadores de sesión/evento elegible, retorno, densidad válida, frescura y coste/evento; no usar pageviews como evidencia de valor.
- **CLOSED BETA** sólo con credenciales cerradas, curación sostenida, responsable y flujo de corrección probado. **PUBLIC MVP** requiere además controles de abuso, cobertura útil sostenida y evidencia de uso repetido.

Backlog separado: reclamo de organizador, perfiles de recintos, atribución útil de aportes, promoción etiquetada y analítica consentida. No se exponen como capacidades actuales.
