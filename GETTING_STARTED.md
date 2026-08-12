# Cómo correr Onda (local)

Guía para levantar el monorepo completo: Docker (Postgres + Redis), base de datos y todas las apps.

## Requisitos

- **Node.js** 20+ (recomendado LTS)
- **pnpm** 10.15.1 (el repo fija la versión vía `packageManager`)
- **Docker** + **Docker Compose** (Postgres 16 y Redis 7)

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

El `.env.example` ya apunta a los servicios de Docker locales. Variables mínimas para desarrollo:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres (`postgresql://onda:onda@localhost:5432/onda?schema=public`) |
| `REDIS_URL` | Redis (`redis://localhost:6379`) |
| `JWT_SECRET` | Auth JWT |
| `API_PORT` | Puerto del API (default `3333`) |
| `NEXT_PUBLIC_API_URL` | URL del API para frontends (`http://localhost:3333`) |

Opcionales (integraciones externas; pueden quedar vacías en local):

- Kapso (WhatsApp): `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`
- Wallets: `WALLET_API_KEY`, `WALLET_API_BASE_URL`
- Wompi: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`

## 3. Docker (Postgres + Redis)

Levanta los contenedores en segundo plano:

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

Con Docker arriba y el `.env` listo:

```bash
# Generar cliente Prisma
pnpm db:generate

# Sincronizar schema (desarrollo)
pnpm db:push

# Datos demo
pnpm db:seed
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

1. `pnpm docker:up`
2. `pnpm db:generate` → `pnpm db:push` → `pnpm db:seed`
3. `pnpm dev:api`
4. El resto de frontends cuando el API esté escuchando

## Checklist rápido (primera vez)

```bash
pnpm install
cp .env.example .env
pnpm docker:up
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
pnpm docker:up
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
docker-compose.yml      # Postgres + Redis
.env.example
```

## Problemas comunes

**Puerto ocupado (5432 / 6379 / 3333 / 420x)**  
Cierra el proceso que lo use o cambia el mapeo en `docker-compose.yml` / `API_PORT` / flags `-p` de los scripts `dev:*`.

**API no conecta a Postgres**  
Verifica `pnpm docker:up`, `docker compose ps` y que `DATABASE_URL` en `.env` coincida con Docker.

**Prisma Client desactualizado**  
Corre `pnpm db:generate` después de cambios en `libs/database/prisma/schema.prisma`.

**Frontends sin datos / errores de red**  
Confirma que el API está en http://localhost:3333 y que `NEXT_PUBLIC_API_URL` apunta ahí. Reinicia el `next dev` si cambiaste el `.env`.

**Docker no arranca**  
Asegúrate de que Docker Desktop (u otro daemon) esté corriendo antes de `pnpm docker:up`.
