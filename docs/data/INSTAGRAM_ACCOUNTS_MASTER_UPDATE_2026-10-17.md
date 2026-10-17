# Registro de cuentas: estado al 17-oct-2026

- **Migración `instagram_accounts`:** no aplicada. El conector de Supabase sigue sin acceso al proyecto (`list_projects` vacío). Sin la base tampoco se pudo armar la corrida de Apify: el benchmark y el piloto 2 **no se ejecutaron**, y el costo es USD 0.
- **Cuentas de lugares:** las del maestro de lugares (63 `VERIFIED`, 18 `UNVERIFIED`) entran al aplicar la migración, tal como describe `docs/INSTAGRAM_ACCOUNTS_MASTER.md`.

## Cuentas que no son lugares

Siembra inicial en `data/exports/non_venue_accounts_seed.csv`:

- Son 6 productoras que aparecen como productoras de eventos baratos o under en fichas de venta reabiertas hoy.
- Todas quedan como `candidate`. La única con handle es @hollywoodchile.cl, que ya estaba verificada. No se inventó ningún handle.

## Próximo paso de Instagram

Cuando vuelva la base, en este orden:

1. Aplicar la migración.
2. Sembrar las cuentas.
3. Correr BENCH con los dos actores (tope USD 0,50).
4. Correr el piloto 2 (cohortes A y B, tope USD 1,00).
5. Revisar las productoras y colectivos que aparezcan citados en esos posts.

El Gemini A1 no aporta verificación nueva: lo marcó él mismo, porque no tenía búsqueda. Sus estados no se importan.
