#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "No hay .env — copiando desde .env.example"
  cp .env.example .env
fi

env_val() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" .env 2>/dev/null | tail -n 1 || true)"
  [[ -z "$line" ]] && return 0
  line="${line#"${key}="}"
  if [[ "$line" == \"*\" ]]; then
    line="${line#\"}"
    line="${line%\"}"
  elif [[ "$line" == \'*\' ]]; then
    line="${line#\'}"
    line="${line%\'}"
  fi
  printf '%s' "$line"
}

is_local_url() {
  local url="${1:-}"
  [[ "$url" == *localhost* || "$url" == *127.0.0.1* || "$url" == *'[::1]'* ]]
}

DATABASE_URL="$(env_val DATABASE_URL)"
DIRECT_URL="$(env_val DIRECT_URL)"
REDIS_URL="$(env_val REDIS_URL)"
GCP_PROJECT="$(env_val GCP_PROJECT)"
CLOUD_TASKS_QUEUE="$(env_val CLOUD_TASKS_QUEUE)"
ONDA_DEMO_REFERRAL_CODE="$(env_val ONDA_DEMO_REFERRAL_CODE)"

export DATABASE_URL DIRECT_URL ONDA_DEMO_REFERRAL_CODE

uses_cloud_tasks=false
if [[ -n "${GCP_PROJECT}" && -n "${CLOUD_TASKS_QUEUE}" ]]; then
  uses_cloud_tasks=true
fi

need_postgres_docker=false
if is_local_url "$DATABASE_URL"; then
  need_postgres_docker=true
fi

need_redis_docker=false
if [[ "$uses_cloud_tasks" != true ]]; then
  if [[ -z "$REDIS_URL" ]] || is_local_url "$REDIS_URL"; then
    need_redis_docker=true
  fi
fi

if [[ "$need_postgres_docker" != true && "$need_redis_docker" != true ]]; then
  echo "Docker no hace falta: Postgres remoto y jobs por Cloud Tasks (o Redis remoto)."
elif ! docker info >/dev/null 2>&1; then
  if [[ "$need_postgres_docker" == true ]]; then
    echo "Docker no está corriendo y DATABASE_URL apunta a localhost. Abre Docker Desktop o usa Neon en DATABASE_URL."
    exit 1
  fi
  echo "Docker no está corriendo — Redis local no se levantará; los jobs irán inline."
  need_redis_docker=false
else
  services=()
  if [[ "$need_postgres_docker" == true ]]; then
    services+=(postgres)
  fi
  if [[ "$need_redis_docker" == true ]]; then
    services+=(redis)
  fi
  echo "Levantando ${services[*]}…"
  docker compose up -d "${services[@]}"

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

  if [[ "$need_postgres_docker" == true ]]; then
    wait_for Postgres docker compose exec -T postgres pg_isready -U onda
  fi
  if [[ "$need_redis_docker" == true ]]; then
    wait_for Redis docker compose exec -T redis redis-cli ping
  fi
fi

echo "Generando cliente Prisma…"
pnpm db:generate

if [[ "$need_postgres_docker" == true ]]; then
  echo "Sincronizando schema…"
  pnpm exec prisma db push --schema=libs/database/prisma/schema.prisma --accept-data-loss --skip-generate
fi

store_count="$(
  pnpm exec tsx -e '
    import { PrismaClient } from "@prisma/client";
    const p = new PrismaClient();
    p.store.count()
      .then((n) => { process.stdout.write(String(n)); })
      .catch(() => { process.stdout.write("err"); })
      .finally(() => p.$disconnect());
  ' 2>/dev/null || true
)"

if [[ "${store_count}" == "0" ]]; then
  echo "Base vacía — cargando seed demo…"
  pnpm db:seed
elif [[ "${store_count}" == "err" || -z "${store_count}" ]]; then
  echo "No se pudo leer Store — si el schema no está en la DB, corre pnpm db:push y pnpm db:seed."
fi

echo "Infra de desarrollo lista."
