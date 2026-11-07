#!/bin/bash
# Loads every migration into a throwaway Postgres and runs supabase/tests/new_features_checks.sql.
# Ends with: ALL CHECKS PASSED. Never touches Supabase or the website's dev database.
#
#   bash scripts/test-migrations.sh
#
# Uses the portable Postgres 17 and the Supabase stand-ins in the website repo (../minnaboweb).
# Own data folder and port (54330). UTF-8 is forced: on Windows psql otherwise reads the files in the
# console's encoding, and «fått» in a migration no longer matches «fått» in a check.
export PGCLIENTENCODING=UTF8
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$HERE/../minnaboweb"
BIN="$WEB/.tools/pgsql/bin"
DATA="${TMPDIR:-/tmp}/minnabo-pgtest"

[ -d "$DATA" ] || "$BIN/initdb.exe" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C >/dev/null
"$BIN/pg_ctl.exe" -D "$DATA" status >/dev/null 2>&1 ||
  "$BIN/pg_ctl.exe" -D "$DATA" -o "-p 54330 -c listen_addresses=localhost" -l "$DATA/pg.log" start -w >/dev/null 2>&1 </dev/null

PSQL="$BIN/psql.exe -h localhost -p 54330 -U postgres"
$PSQL -q -d postgres -c "drop database if exists app" -c "create database app" >/dev/null 2>&1
$PSQL -q -d app -v ON_ERROR_STOP=1 -f "$WEB/supabase/test/00_supabase_stub.sql" >/dev/null || exit 1

for f in "$HERE"/supabase/migrations/*.sql; do
  # pg_net and pg_cron don't exist in the portable Postgres; the stub has stand-ins for what they do
  sed -E "s/^\s*create extension if not exists (pg_net|pg_cron)[^;]*;//I" "$f" > "$DATA/current.sql"
  if ! out=$($PSQL -q -d app -v ON_ERROR_STOP=1 --single-transaction -f "$DATA/current.sql" 2>&1 >/dev/null); then
    echo "FAILED $(basename "$f")"
    echo "$out" | grep -E "ERROR|LINE" | head -8
    exit 1
  fi
done
echo "ALL MIGRATIONS LOADED"
$PSQL -q -d app -f "$HERE/supabase/tests/new_features_checks.sql" 2>&1 | grep -vE "^(NOTICE|DROP|CREATE)|does not exist, skipping" | tail -6
