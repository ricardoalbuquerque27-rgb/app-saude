#!/usr/bin/env bash
# Roda as migrações de supabase/migrations/ e os testes de supabase/testes/
# num Postgres LOCAL, nunca no de produção. Precisa de um cluster no ar
# (no container: `pg_ctlcluster 16 main start`) e do usuário `postgres`.
#
#   ferramentas/testar-sql.sh                         # todas as migrações e testes
#   ferramentas/testar-sql.sh 20261013120000_consultas_e_agenda consultas
set -euo pipefail
cd "$(dirname "$0")/.."

BANCO=pacefit_teste
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$BANCO")
como_postgres() { if [ "$(id -un)" = postgres ]; then "$@"; else su postgres -c "$(printf '%q ' "$@")"; fi; }

como_postgres dropdb --if-exists "$BANCO"
como_postgres createdb "$BANCO"
como_postgres "${PSQL[@]}" -f "$PWD/supabase/testes/base-local.sql" >/dev/null

if [ $# -ge 1 ]; then migracoes=("supabase/migrations/$1.sql"); else migracoes=(supabase/migrations/*.sql); fi
for m in "${migracoes[@]}"; do
  echo "== migração $(basename "$m")"
  como_postgres "${PSQL[@]}" -f "$PWD/$m" >/dev/null
done

if [ $# -ge 2 ]; then testes=("supabase/testes/$2.sql"); else testes=(); for t in supabase/testes/*.sql; do [ "$(basename "$t")" = base-local.sql ] || testes+=("$t"); done; fi
for t in "${testes[@]}"; do
  echo "== testes $(basename "$t")"
  como_postgres "${PSQL[@]}" -f "$PWD/$t" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
done
