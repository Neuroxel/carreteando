# Handoff — cierre del piloto, 17-oct-2026 (19:57 Chile)

**Veredicto: GO para piloto controlado.** No es cobertura exhaustiva, y el GPS en
teléfono físico no está validado (Radar se validó con GPS simulado).

- App en producción: `73d8689` en `https://dondesalgo.vercel.app` (canónica; se mantiene).
  CI verde, Vercel READY, 225 tests. Esta documentación entra en el commit siguiente.
- Estado vigente y métricas: `CURRENT_STATE.md`. QA: `docs/evidence/QA_PILOTO_2026-10-17.md`.
- Dominio `.cl` y rollback: `docs/MARCA_Y_DOMINIO.md` (no ejecutado; DNS según lo que entregue Vercel).

## Decisiones de revisión del cierre (Codex, actor `codex-piloto-verificado`, 11 auditorías)

- Aprobados: Don Carter 24-oct **20:00** (venta cerrada, sin precio) y **22:00** (general $20.000) como dos
  ocurrencias; Paola Molina, Nico Pontigo y Roberto Delgado, Ipanema.
- Columbia: retirado (enlace genérico). Garage: la invitación gratis está agotada → pack 2×$110.000. Socias: VIP agotado.
  Amy Winehouse: hora `null` (09 vs 21 en fuentes). Julio: $8.000 con cupos. Hollywood: 00:00 agotada, 22/23 disponibles.
- Privados por conflicto: JUHN (Blanco 889 vs Ex Club, Errázuriz 880), Lavanda (106 vs 109 B),
  Pachabamba (sin coincidencia), Carlita (2 funciones agotadas).
- Yorka (PCDV, id 784): cancelado en la fuente y retirado.

## Fuentes

TicketPlus activa en revisión (nivel C). ComedyPass y ComediaTicket en revisión (C). Cinzano inactiva (revisión, C)
hasta aprobación humana. Apify pausado: US$0,1377 de US$3,00 en octubre.

## Pendiente (no bloquea)

1. QA en Android/iPhone físico con GPS real.
2. Apify incremental: leer el watermark que ya se escribe antes de reactivar Instagram.
3. 121 lugares sin ruta automática (deuda de cobertura).
4. Revisión humana de TicketPlus, Cinzano y la cola (24).
5. `og:url` ausente; afiches faltantes.
6. Registrar `dondesalgo.cl` y aplicar el plan tras validar el piloto.
