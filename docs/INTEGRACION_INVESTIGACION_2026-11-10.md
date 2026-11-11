# Integración acotada de hallazgos Viña/Valparaíso — 10 nov 2026

**Estado:** revisión por PR, **no equivale a publicación ni despliegue**. Fuentes externas: lote Claude (36 recintos, 34 filas de eventos) y catastro Gemini (115 filas declaradas). Las cifras no representan entidades nuevas ni verificadas en la DB; varias filas agrupan locales, contienen direcciones sin nombre o ya existen en el catálogo.

## Cambios incorporados en esta rama

- Se agregan dos eventos al feed editorial: **Pulso, tributo a Pink Floyd** (Viña Stage, 27/11 20:00) y **María Delitos + Sugestión + Los Espectros** (Bar Vienés, 27/11 21:00).
- Se comprobó cada fecha, hora, lugar, dirección y condición +18 en su **ficha individual** de PortalTickets, no solo en un snippet de la portada.
- Se deja `price_clp: null`: el precio más barato observado puede agotarse antes de que se importe. Se evitan etiquetas engañosas de disponibilidad.
- Las dos sedes ya existían en `data/catalogo-publico.json`; no crear recintos duplicados. `lib/editorial-feed.ts` dispone de filtro de 90 días, revisión editorial reciente y deduplicación posterior. La importación a Supabase **no se ejecutó** desde esta PR.
- Test específico: identidad de recinto/comuna, evidencia por evento no reutilizada y correcciones territoriales conocidas.

## No importar automáticamente

| Hallazgo | Decisión | Por qué |
| --- | --- | --- |
| Okko Music Lab como Viña | **RECHAZAR cambio** | Catálogo vigente ya lo registra en **Concón**; lote Claude coincide. |
| Manda Viña y Manda Reñaca | **MANTENER separados** | Dos establecimientos y fuentes de programación distintas; la app trata Reñaca como ciudad de navegación, aunque administrativamente es Viña. |
| Brisamar (Las Salinas) y Casa Cochoa (Cochoa) | **HOLD** | Gemini los mezcló en Borgoño 16660; Claude cita Brisamar en Borgoño 12041. Confirmar identidad y localización por separado antes de fusionar o crear. |
| Hollywood Pub / Experience Viña vs Hollywood Reñaca | **HOLD parcial** | Alias de Viña plausiblemente confirmado, pero no equivale a certificar operación independiente en Reñaca. |
| Ipanema/Jaggers, 2 Norte 195 | **HOLD** | Colisión física; investigar sucesión temporal y eventual cierre. |
| LOCOS X VIÑA / Cantina del Cocodrilo / Psiquis | **HOLD** | Colisiones de dirección, no autorizar merge. |
| Idílico / Schopería, Borgoño 14650 | **HOLD** | Dirección coincidente sin identidad de local corroborada. |
| RUT «Club O Reñaca SpA» | **HOLD** | No publicar ni usar para relaciones jurídicas sin fuente primaria comprobable. |
| Eventos con URL genérica o `halloween-renaca` reutilizada | **RECHAZAR como evidencia de evento** | Una portada o ficha ajena no acredita fecha, precio y recinto. |
| Eventos recurrentes sin ocurrencia fechada | **NO incorporar como eventos específicos** | Guardar como fuente recurrente/ciclo; crear cada ocurrencia sólo con fecha acreditada. |

## Brecha de cobertura: acciones con mejor retorno

1. **Viña y Reñaca:** verificar el catálogo vigente contra los 115 registros de Gemini por identidad/dirección/sector antes de declarar nuevos; investigar Reñaca Alto, Recreo, Chorrillos, Gómez Carreño, Santa Inés, Forestal, Achupallas, Santa Julia, Miraflores y Nueva Aurora. Buscar cafeterías/restaurantes sin exigir programación.
2. **Valparaíso:** partir del censo canónico del 12-oct (`docs/VALPARAISO_FINAL_CENSUS.md`), no del inventario inicial de 159; concentrarse en los pendientes y brechas de Barrio Puerto, Subida Ecuador, Playa Ancha, cerros altos, Placilla y Curauma.
3. **Las fuentes antes que el volumen:** monitorear portaldisc regional y carteleras por local, Vesti por compañía, ComedyPass, Ticketplus, sitio municipal y sitios propios. **No abrir scraper masivo** antes de evaluar salud de las fuentes y de la cola de revisión.
4. **No aumentar deuda de moderación:** lote de 15–25 candidatos; revisión por fuente, vencimiento temporal, log de decisión por campo y métricas de yield (candidatos nuevos, confirmaciones, duplicados, falsos positivos).
5. **Secuencia regional:** Viña/Reñaca + Valparaíso primero; Concón luego por extensión costera; Quilpué y Villa Alemana por el eje urbano; Quillota, Limache y Olmué; litoral norte y Casablanca/San Antonio según evidencia de demanda y eventos.

## Costos, scraping y restricciones

- El estado canónico del 17-oct en `CURRENT_STATE.md` declara **34 fuentes activas de 44**, ingesta de sitios públicos con gasto marginal de proveedor registrado como US$0, y **Apify/Instagram pausado**. Presupuesto Apify: objetivo US$2,50/mes y corte duro US$3/mes; no se cambia aquí.
- HTTP/HTML y JSON-LD de fuentes públicas: no tienen por sí solos una tarifa por request, pero **sí consumen invocaciones de infraestructura** y requieren respetar robots.txt, TOS, rate limits, bloqueos y licencias.
- Apify tiene plan gratuito con crédito limitado; cualquier actor de pago, proxy o escalamiento debe estimarse antes de habilitarlo. Google Places API usa precios por SKU y cuotas gratuitas mensuales: es una herramienta de descubrimiento condicionada por sus términos, **no un catálogo libre para copiar**.
- **No usar login personal, cookies, proxies para evadir bloqueos ni scraping de Google Maps.** Para Instagram, primero resolver el watermark incremental ya identificado en el repo, restringir cuentas y dejar todo en revisión.

## Gates pendientes antes de desplegar

- [ ] Confirmar proyecto de Vercel, dominio y SHA de la rama con cuenta autorizada (la conexión actual solicitó acceso al equipo).
- [ ] Ejecutar CI/test, lint, typecheck y build en la PR.
- [ ] Verificar si los dos eventos ya están en Supabase mediante `event_key`, URL y venue (no accesible en esta sesión).
- [ ] Revisar cola de moderación, sincronía snapshot/DB y fuentes programadas.
- [ ] Publicar solo tras revisión de resultados y comprobar las URLs públicas; mantener rollback disponible.
