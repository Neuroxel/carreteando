#!/usr/bin/env bash
# Prueba local de la migración 20261029040057 sobre las definiciones de producción.
# Uso: PGBIN=/ruta/a/postgres/bin PGPORT=55433 supabase/tests/verified-event-end/run.sh
# Necesita un servidor local de prueba (nunca la base real). Crea y borra sus propias bases.
set -euo pipefail
cd "$(dirname "$0")"
PSQL="${PGBIN:+$PGBIN/}psql -h 127.0.0.1 -p ${PGPORT:-5432} -U postgres -v ON_ERROR_STOP=1 -q"
MIG=../../migrations/20261029040057_verified_event_end.sql
for db in vee_ok vee_cerrado; do $PSQL -d postgres -c "DROP DATABASE IF EXISTS $db" >/dev/null; done
# Roles de clúster: se crean una sola vez por servidor de prueba.
$PSQL -d postgres -c "DO \$\$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$; DO \$\$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$; DO \$\$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;" >/dev/null
base() { grep -v '^CREATE ROLE' 00-base-produccion.sql; }

echo "== 1. Migración sobre producción + comprobaciones"
$PSQL -d postgres -c "CREATE DATABASE vee_ok" >/dev/null
base | $PSQL -d vee_ok >/dev/null
$PSQL -d vee_ok --single-transaction -f "$MIG" >/dev/null
$PSQL -d vee_ok -At -F ' | ' -f 10-comprobaciones.sql | tee /dev/stderr | tail -1 | grep -qE '\| 0$' || { echo "HAY FALLAS"; exit 1; }

echo "== 2. Falla cerrado si una función de producción cambió (y no deja nada a medias)"
$PSQL -d postgres -c "CREATE DATABASE vee_cerrado" >/dev/null
base | sed 's/ and date_text < hoy;/ and date_text <= hoy;/' | $PSQL -d vee_cerrado >/dev/null
if $PSQL -d vee_cerrado --single-transaction -f "$MIG" 2>/tmp/vee_err.txt >/dev/null; then echo "ERROR: debió fallar"; exit 1; fi
grep -q 'sweep_stale_events changed' /tmp/vee_err.txt && echo "ok    falla cerrado con mensaje claro"
cols=$($PSQL -d vee_cerrado -Atc "SELECT count(*) FROM information_schema.columns WHERE table_name='events' AND column_name='event_end_time'")
[ "$cols" = 0 ] && echo "ok    sin cambios parciales (rollback completo)" || { echo "ERROR: quedó a medias"; exit 1; }
echo "TODO OK"
