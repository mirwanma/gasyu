#!/usr/bin/env bash
# Menjalankan semua uji SQL di database Postgres kosong.
# Pemakaian: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh [nama_db]
# Database dibuat ulang setiap kali, jadi jangan arahkan ke database produksi.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${1:-gasyu_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/_supabase_shim.sql > /dev/null

for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" > /dev/null 2> >(grep -v -E "NOTICE|pg_cron|storage" >&2)
done
echo "Migrasi terpasang: $(ls supabase/migrations/*.sql | wc -l) file"

fail=0
for t in supabase/tests/0*.sql; do
  if out=$("${PSQL[@]}" -d "$DB" -f "$t" 2>&1); then
    echo "OK    $(basename "$t")"
  else
    echo "GAGAL $(basename "$t")"; echo "$out" | grep -E "ERROR|UJI GAGAL" | head -5; fail=1
  fi
done
exit $fail
