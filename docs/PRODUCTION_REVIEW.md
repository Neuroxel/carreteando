# Revisión de producción — checkpoint de código

Estado de este documento: validación local completada; verificación de despliegue y R2 se registran en la siguiente actualización del mismo documento.

## Implementado y probado localmente

- Lecturas server-side, RLS aprobación + fecha Chile, cero canónico, eliminación de localStorage y prototipos ficticios.
- Cola privada de envíos/reportes con validación, límites persistentes y operación manual documentada.
- Ingesta acotada, registros privados, candidatos inactivos, dedupe conservador, timeout/cooldown y telemetría.
- Diseño mobile-first, tarjetas y detalle, fuentes, compartir/copia, estados vacío/error/404, imagen fallback, enlaces por zona.
- Canonical correcto, OG generado, JSON-LD sin campos inventados, robots y sitemap dinámico.
- 24 tests pasan; lint de todos los módulos sin avisos, typecheck, build, auditoría de producción sin vulnerabilidades.
- HTTP local: rutas públicas 200, detalle inexistente 404, Radar/Mapa 308, OG/sitemap/robots 200. Cron sin configurar en local 503 (cerrado).
- Prueba SQL real en dashboard: PASS de roles anon/authenticated, vista, recepción privada, duplicados, cuota y cooldown; rollback íntegro y conteos corroborados. `execute_sql` por MCP era read-only, por lo que no se usa su rechazo como evidencia de fracaso del esquema.
- Security Advisor tras migración: 0 errores/warnings; 3 INFO por RLS sin policies en tablas intencionalmente privadas. Las tablas carecen de grants públicos y los RPC sólo permiten service_role.

## Límites que la compilación no resuelve

- Revocación efectiva del JWT legacy comprometido requiere verificación específica; una clave nueva en el servidor no la demuestra.
- Densidad/precisión real y coste por evento útil todavía necesitan R2 y revisión de sus fuentes.
- La moderación es manual mediante Supabase; no hay responsable ni SLA demostrado, ni notificaciones a quien envía.
- El parser no lee texto de flyers/OCR. Rechaza ambigüedad, puede perder eventos válidos y agrupa conservadoramente un recinto/noche.
- URLs de imágenes Instagram pueden vencer; el fallback evita romper la tarjeta, pero no existe mirroring propio de medios.
- Cuota y honeypot no sustituyen WAF/CAPTCHA para una campaña abierta. Retención automática de registros pendiente.
- Lecturas no-store priorizan datos frescos y retiradas inmediatas. Tope de 300 eventos; paginación y caché con invalidación antes de escala.
- Sin analítica conductual. No se afirma PMF, usuarios, cobertura, tiempo real ni confirmación del organizador.

## Experimentos siguientes

1. Curar 3–6 planes válidos por noche durante dos fines de semana; medir disponibilidad por zona, vigencia, duplicados y correcciones.
2. Comparar manualmente 30–50 candidatos consecutivos, separar rechazos de falsos negativos y no mezclar precisión de candidatos con la cartelera ya moderada.
3. Prueba con usuarios de Valpo/Viña: tiempo hasta abrir un evento, encontrar precio/fuente y compartir. Registrar feedback consentido, sin trackers por defecto.
4. Acordar revisión diaria con organizadores y medir coste operativo, además del coste Apify.

Backlog separado: reclamo de organizador, perfiles de recintos, atribución de aportes, promoción claramente etiquetada y analítica mínima consentida. Ninguno está expuesto como funcionalidad actual.
