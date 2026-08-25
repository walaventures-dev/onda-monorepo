# Cómo correr Onda (local)

Guía para levantar el monorepo completo: base de datos, jobs y todas las apps.

## Requisitos

- **Node.js** 20+ (recomendado LTS)
- **pnpm** 10.15.1 (el repo fija la versión vía `packageManager`)
- **Postgres** alcanzable (`DATABASE_URL`): Neon o el contenedor local
- **Docker** + **Docker Compose** — **opcional**. Solo si Postgres o Redis van en `localhost`. Con Neon + Cloud Tasks no hace falta.

Si no tienes pnpm:

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
```

## 1. Instalar dependencias

Desde la raíz del repo:

```bash
pnpm install
```

## 2. Variables de entorno

```bash
cp .env.example .env
```

El `.env.example` apunta a Postgres/Redis locales. Si usas Neon y Cloud Tasks, cambia `DATABASE_URL` / `DIRECT_URL` y define `GCP_PROJECT` + `CLOUD_TASKS_QUEUE`. Variables mínimas:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres (Neon o `postgresql://onda:onda@localhost:5432/onda?schema=public`) |
| `DIRECT_URL` | En Neon: host sin `-pooler`. En local puede coincidir con `DATABASE_URL` |
| `REDIS_URL` | Redis local. Innecesario si Cloud Tasks está configurado |
| `JWT_SECRET` | Auth JWT |
| `API_PORT` | Puerto del API (default `3333`) |
| `NEXT_PUBLIC_API_URL` | URL del API para frontends (`http://localhost:3333`) |

Opcionales (integraciones externas; pueden quedar vacías en local). Guía completa: [docs/proveedores.md](docs/proveedores.md).

- Firebase Auth (solo merchant-dashboard): `FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`
- Google Places: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Cloud Tasks (prod): `GCP_PROJECT`, `CLOUD_TASKS_QUEUE`, `JOBS_WORKER_URL`
- Kapso (WhatsApp): `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`
- WalletWallet: `WALLET_API_KEY`, `WALLET_API_BASE_URL`
- Wompi: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`
- Brevo (email + SMS): `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`

## 3. Infra (opcional: Docker)

`pnpm dev` / `pnpm dev:api` corren `scripts/ensure-dev-infra.sh`. Ese script **no exige Docker** si:

- `DATABASE_URL` no es `localhost` (p. ej. Neon), y
- hay Cloud Tasks (`GCP_PROJECT` + `CLOUD_TASKS_QUEUE`) o Redis no es local

En todos los casos genera el cliente Prisma y, si `Store` está vacía, carga el seed. El `db push` automático con `--accept-data-loss` solo corre contra Postgres local.

Si Postgres o Redis van en localhost, levanta los contenedores:

```bash
pnpm docker:up
```

Equivale a `docker compose up -d`. Servicios:

| Servicio | Imagen | Puerto local |
|---|---|---|
| Postgres | `postgres:16-alpine` | `5432` |
| Redis | `redis:7-alpine` | `6379` |

Credenciales Postgres (definidas en `docker-compose.yml`):

- User: `onda`
- Password: `onda`
- DB: `onda`

Comandos útiles:

```bash
# Ver estado
docker compose ps

# Logs
docker compose logs -f

# Parar (mantiene volúmenes)
docker compose stop

# Parar y eliminar contenedores (mantiene volúmenes de datos)
docker compose down

# Resetear datos (borra volúmenes)
docker compose down -v
```

## 4. Base de datos (Prisma)

Con el `.env` listo (y Docker arriba solo si Postgres es local):

```bash
# Generar cliente Prisma
pnpm db:generate

# Sincronizar schema (desarrollo)
pnpm db:push

# Datos demo
pnpm db:seed

# Visor para ver y editar tablas (http://localhost:5555)
pnpm db:studio
```

Alternativa con migraciones (cuando quieras versionar cambios de schema):

```bash
pnpm db:migrate
```

## 5. Correr todas las apps

No hay un solo script que las arranque juntas: abre **5 terminales** en la raíz del repo (o usa un terminal multiplexor).

```bash
pnpm dev:api          # NestJS API
pnpm dev:landing      # Landing Next.js
pnpm dev:pwa          # PWA cliente
pnpm dev:merchant     # Dashboard merchants
pnpm dev:organizer    # Dashboard organizers
```

### Puertos y URLs

| App | Script | URL |
|---|---|---|
| API | `pnpm dev:api` | http://localhost:3333/api |
| Health | — | http://localhost:3333/api/health |
| Landing | `pnpm dev:landing` | http://localhost:4200 |
| PWA cliente | `pnpm dev:pwa` | http://localhost:4201 |
| Merchant dashboard | `pnpm dev:merchant` | http://localhost:4202 |
| Organizer dashboard | `pnpm dev:organizer` | http://localhost:4203 |

Orden recomendado la primera vez:

1. `.env` con Neon + Cloud Tasks, **o** `pnpm docker:up` si es local
2. `pnpm db:generate` → `pnpm db:push` → `pnpm db:seed`
3. `pnpm dev:api`
4. El resto de frontends cuando el API esté escuchando

## Checklist rápido (primera vez)

```bash
pnpm install
cp .env.example .env
# Neon + Cloud Tasks en .env, o: pnpm docker:up
pnpm db:generate
pnpm db:push
pnpm db:seed

# En terminales separadas:
pnpm dev:api
pnpm dev:landing
pnpm dev:pwa
pnpm dev:merchant
pnpm dev:organizer
```

Las siguientes veces (si ya instalaste y configuraste):

```bash
pnpm dev:api
# + frontends que necesites
```

## Seed demo

Tras `pnpm db:seed`:

- Evento: `festival-neiva`
- Merchant: `owner0@onda.lat`
- Usuario demo: `+573001112233`

## Estructura relevante

```
apps/
  api/                  # NestJS
  landing/              # Next.js :4200
  pwa-client/           # Next.js :4201
  merchant-dashboard/   # Next.js :4202
  organizer-dashboard/  # Next.js :4203
libs/
  database/             # Prisma schema + seed
  shared/               # ui, types, utils
  wallets/
  whatsapp/
docker-compose.yml      # Postgres + Redis (opcional)
.env.example
```

## Problemas comunes

**Puerto ocupado (5432 / 6379 / 3333 / 420x)**  
Cierra el proceso que lo use o cambia el mapeo en `docker-compose.yml` / `API_PORT` / flags `-p` de los scripts `dev:*`.

**API no conecta a Postgres**  
Si `DATABASE_URL` es localhost: `pnpm docker:up` y `docker compose ps`. Si es Neon, verifica `DATABASE_URL` / `DIRECT_URL` (pooler vs host directo).

**Prisma Client desactualizado**  
Corre `pnpm db:generate` después de cambios en `libs/database/prisma/schema.prisma`.

**Frontends sin datos / errores de red**  
Confirma que el API está en http://localhost:3333 y que `NEXT_PUBLIC_API_URL` apunta ahí. Reinicia el `next dev` si cambiaste el `.env`.

**Docker no arranca**  
Solo es necesario si Postgres o Redis son locales. Con Neon + Cloud Tasks, ignóralo. Si sí lo usas, abre Docker Desktop antes de `pnpm docker:up`.
