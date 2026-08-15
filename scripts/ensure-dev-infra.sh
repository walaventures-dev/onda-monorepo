#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "No hay .env — copiando desde .env.example"
  cp .env.example .env
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker no está corriendo. Abre Docker Desktop y vuelve a intentar."
  exit 1
fi

echo "Levantando Postgres + Redis…"
docker compose up -d

wait_for() {
  local name="$1"
  local i=0
  shift
  until "$@" >/dev/null 2>&1; do
    i=$((i + 1))
    if [[ "$i" -ge 60 ]]; then
      echo "Timeout esperando $name"
      exit 1
    fi
    sleep 1
  done
  echo "$name listo"
}

wait_for Postgres docker compose exec -T postgres pg_isready -U onda
wait_for Redis docker compose exec -T redis redis-cli ping

echo "Generando cliente Prisma…"
pnpm db:generate

echo "Sincronizando schema…"
pnpm exec prisma db push --schema=libs/database/prisma/schema.prisma --accept-data-loss --skip-generate

store_count="$(
  docker compose exec -T postgres psql -U onda -d onda -tAc 'SELECT COUNT(*) FROM "Store";' 2>/dev/null | tr -d '[:space:]' || true
)"
if [[ "${store_count:-0}" == "0" ]]; then
  echo "Base vacía — cargando seed demo…"
  pnpm db:seed
fi

echo "Infra de desarrollo lista."
