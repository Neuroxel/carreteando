# Documentación de Carreteando

**Empieza por [`CURRENT_STATE.md`](../CURRENT_STATE.md).** Es el único documento
que describe la verdad vigente. Todo lo demás lo complementa o es histórico.

## Vigentes

| Documento | Para qué |
|---|---|
| [`CURRENT_STATE.md`](../CURRENT_STATE.md) | **Estado actual.** Manda sobre cualquier informe antiguo. |
| [`CARLOS_HANDOFF.md`](../CARLOS_HANDOFF.md) | Traspaso técnico: arquitectura, mapa del repositorio, accesos, cómo correrlo. |
| [`ROADMAP.md`](../ROADMAP.md) | Tesis del producto, qué viene ahora, después y más adelante, y economía. |
| [`docs/CARLOS_FRONTEND_REVIEW.md`](CARLOS_FRONTEND_REVIEW.md) | **La URL única del release candidate** y qué revisar. |
| [`docs/AUTOMATION.md`](AUTOMATION.md) | Las 7 reglas del motor, dónde corre (sin IA) y cómo mantenerlo. |
| [`docs/COBERTURA.md`](COBERTURA.md) | Cobertura de fuentes, lo que falta y por qué, economía, piloto de Instagram. |
| [`docs/FUENTES_LOCALES.md`](FUENTES_LOCALES.md) | Paquete de fuentes por local y brecha de redes sociales. |
| [`CARLOS_REVIEW_CHECKLIST.md`](../CARLOS_REVIEW_CHECKLIST.md) | Catorce pruebas de revisión, con las limitaciones ya conocidas. |
| [`BETA_TEST_GUIDE.md`](../BETA_TEST_GUIDE.md) | Lo que se le manda a una persona que va a probar el sitio. |
| [`PRODUCT_MASTER_SPEC.md`](../PRODUCT_MASTER_SPEC.md) | Qué es el producto y qué no es. |
| [`PRODUCT_BACKLOG.md`](../PRODUCT_BACKLOG.md) | Prioridades vivas: P0, P1, P2. |
| [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) | Color, tipografía, tarjetas, acentos por ciudad. |
| [`BRAND_NAMING_EXPLORATION.md`](../BRAND_NAMING_EXPLORATION.md) | Exploración de nombre. **No decide nada.** |
| [`COMPETITIVE_PRODUCT_PATTERNS.md`](../COMPETITIVE_PRODUCT_PATTERNS.md) | Qué hacen Vesti, Shotgun, Partiful y qué tomamos. |

## Privados (no versionados)

Viven en `docs/private/`, fuera de Git porque contienen operación interna:

| Documento | Para qué |
|---|---|
| `AUTOMATION_TRUTH.md` | Qué se actualiza solo y qué no, sin frases ambiguas. |
| `ADMIN_RECOVERY.md` | Cómo recuperar el acceso a `/admin` sin ayuda. |
| `REGIONAL_COVERAGE.md` | Cobertura comuna por comuna. |
| `SOURCE_REGISTRY.md` | Fuentes, cadencias y salud. |
| `respaldos/` | Copias fechadas de la base. |

## Histórico

Los informes de fase anteriores describen cómo se llegó hasta aquí y **pueden
contradecir el estado actual**. Son evidencia, no instrucciones. Ante cualquier
diferencia, manda `CURRENT_STATE.md`.
