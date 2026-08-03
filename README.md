# Onda Monorepo

Nx + Next.js + NestJS + Prisma + Hero UI v3.

## Stack

- Apps: `landing`, `pwa-client`, `merchant-dashboard`, `organizer-dashboard`, `api`
- Libs: `@onda/shared-ui`, `@onda/shared-types`, `@onda/shared-utils`, `@onda/database`, `@onda/wallets`, `@onda/whatsapp`
- UI: Hero UI 3 + Tailwind 4 (paleta celeste `#3DB9E8` / violeta `#6E5AE6`)
- WhatsApp: Kapso a nivel plataforma Onda
- Wallets: Wallet API

## Quick start

Guía completa (requisitos, Docker, env, DB y todas las apps): [GETTING_STARTED.md](./GETTING_STARTED.md).

```bash
pnpm install
pnpm docker:up
pnpm db:push
pnpm db:seed

# terminals
pnpm dev:api          # http://localhost:3333/api/health
pnpm dev:landing      # :4200
pnpm dev:pwa          # :4201
pnpm dev:merchant     # :4202
pnpm dev:organizer    # :4203
```

## Env

Copia `.env.example` → `.env`. Variables clave:

- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
- `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`
- `WALLET_API_KEY`, `WALLET_API_BASE_URL`
- `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`
- `NEXT_PUBLIC_API_URL=http://localhost:3333`

## Kapso MCP (Cursor)

```json
{
  "mcpServers": {
    "kapso": {
      "url": "https://api.kapso.ai/mcp",
      "headers": { "X-API-Key": "YOUR_KEY" }
    }
  }
}
```

## Seed demo

- Evento: `festival-neiva`
- Merchant login email seed: `owner0@onda.lat` / PIN store `1234`
- User demo: `+573001112233`
