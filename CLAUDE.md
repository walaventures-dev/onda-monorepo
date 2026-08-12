# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Onda is a Colombian loyalty/wallet platform for events and merchants ("comercios"). Customers collect stamps/points via a WhatsApp-driven flow and redeem them through Apple/Google Wallet passes. The domain and most UI copy are in Spanish.

Nx monorepo, pnpm workspaces: 5 apps (1 NestJS API + 4 Next.js frontends) and 6 shared libs.

## Commands

```bash
pnpm install
pnpm docker:up          # Postgres 16 + Redis 7 via docker-compose
pnpm db:generate         # prisma generate
pnpm db:push             # sync schema.prisma -> DB (dev)
pnpm db:migrate          # prisma migrate dev (when versioning schema changes)
pnpm db:seed              # tsx libs/database/prisma/seed.ts

pnpm dev:api              # NestJS, http://localhost:3333/api (health: /api/health)
pnpm dev:landing          # :4200
pnpm dev:pwa               # :4201 — customer-facing PWA
pnpm dev:merchant          # :4202 — merchant dashboard
pnpm dev:organizer         # :4203 — organizer dashboard
```

There's no single script that starts everything — run the apps you need in separate terminals, API first.

Building a single app/lib goes through Nx: `pnpm exec nx build <project>` / `pnpm exec nx serve <project>` (project names: `api`, `landing`, `pwa-client`, `merchant-dashboard`, `organizer-dashboard`, `database`, `shared-ui`, `shared-types`, `shared-utils`, `wallets`, `whatsapp`). The API's `build` target is a raw `tsc` compile to `dist/apps/api`; frontend `build` targets are `next build`.

**No lint or test tooling is configured anywhere in this repo** (no eslint config, no jest/vitest config, no `*.spec.ts`/`*.test.ts` files) despite `@nx/eslint*` being present as a devDependency. Don't assume a `pnpm lint` or `pnpm test` command exists — verify manually (build + read + exercise the running app) instead.

Seed data: event `festival-neiva`, merchant login `owner0@onda.lat`, demo user `+573001112233`.

## Architecture

### Monorepo layout
- `apps/api` — NestJS backend, single source of truth for business logic.
- `apps/landing`, `apps/pwa-client`, `apps/merchant-dashboard`, `apps/organizer-dashboard` — Next.js 16 / React 19 frontends.
- `libs/database` — Prisma schema (`libs/database/prisma/schema.prisma`) + seed script; exports the Prisma client via `libs/database/src/index.ts`.
- `libs/shared/ui`, `libs/shared/types`, `libs/shared/utils` — cross-app React components, TS types, and utils. Imported as `@onda/shared-ui`, `@onda/shared-types`, `@onda/shared-utils` (path aliases in `tsconfig.base.json`; also has legacy `@onda/shared/*` aliases pointing to the same files).
- `libs/wallets` — Wallet API client (Apple/Google Wallet pass provisioning).
- `libs/whatsapp` — Kapso WhatsApp integration client.

### API: flat, single-module NestJS app
There is **one** `AppModule` (`apps/api/src/app.module.ts`) — no per-domain feature modules. Every controller and provider is registered directly on it. New backend features are added as a new `*.controller.ts` (and, if needed, `*.service.ts`) file in `apps/api/src/`, then wired into `AppModule`'s `controllers`/`providers` arrays. Several related controllers can live in one file (e.g. `analytics.controller.ts` exports `AnalyticsController`, `DrawsController`, `LeadsController`, `BillingController`, `FeedbackController`, `WebhooksController`).

`PrismaService` is the only DB access point; injected wherever needed rather than scoped per-module.

`main.ts` refuses to boot in production without `KAPSO_API_KEY` set — this is a deliberate guard against the OTP dev-mode bypass leaking into prod, not boilerplate.

### Prisma schema
Core models (`libs/database/prisma/schema.prisma`): `Store`, `Event`, `StoreEventMembership`, `User`, `Pass`, `Transaction`, `Promotion`, `PassDesign`, `Lead`, `Draw`, `Feedback`, `Session`, `OtpCode`, `PendingRequest`. A `Store` belongs to `Event`(s) via `StoreEventMembership`; `Pass` is the wallet-pass record tied to a `User`+`Store`/`Event`; `Transaction` records stamp/point activity against a `Pass`. `PendingRequest` (+ `PendingRequestsSseService`/`Controller`) models an async approve/deny flow pushed to clients over SSE.

### Frontend apps
- `pwa-client` (customer-facing) and `landing` use normal Next.js file-based routing under `app/`.
- `merchant-dashboard` is a **client-side SPA masquerading as Next.js**: `app/[[...slug]]/page.tsx` is an intentional no-op (`return null`). All real UI lives in `app/layout.tsx` → `DashboardShell` → `MerchantWorkspace` and sibling components (`ActivityHeatmap`, `CompareStores`, `CustomerDetail`, `PendingRequestsPanel`, `PromoDetail`, etc.), which manage view state client-side rather than through Next.js routes. Don't add real content to files under `[[...slug]]`; extend `MerchantWorkspace`/`DashboardShell` instead.
- Frontends never call the API by absolute URL from the browser: each app's `next.config.js` rewrites `/api/:path*` to the NestJS API (`http://localhost:3333/api/:path*`), and `getApiUrl()` (`libs/shared/ui/src/api.ts`) returns `''` client-side so `fetch` hits same-origin `/api/...`. This is deliberate — it avoids host/port mismatches on LAN or dev tunnels. Server-side code (SSR) uses `NEXT_PUBLIC_API_URL` directly. Use the shared `api()` helper from `@onda/shared-ui` for API calls rather than raw `fetch`.

### Design system
Hero UI v3 + Tailwind 4. Brand palette: celeste `#3DB9E8`, violeta `#6E5AE6`. Icons via `@phosphor-icons/react` — import named exports (e.g. `import { Tag } from '@phosphor-icons/react'`), not default exports, and reuse existing icon usages/constants (e.g. `promoTypeIcon`) instead of redefining icon sets per component.

**[DESIGN.md](DESIGN.md) is the single source of truth for UI work** — color tokens, typography scale, spacing/radius/shadow system, icon conventions, component guidelines (buttons/inputs/cards/tables/modals, PWA vs. dashboard differences), and explicit AI generation guardrails (what never to do when building components). Read it before generating or modifying any UI in this repo — the notes above are just a summary.

### External integrations
- **Kapso** — WhatsApp messaging at the Onda platform level (`libs/whatsapp`, `WhatsappService`).
- **Wallet API** — Apple/Google Wallet pass issuance (`libs/wallets`, `WalletService`).
- **Wompi** — payments (`WOMPI_PUBLIC_KEY`/`WOMPI_PRIVATE_KEY`).

Env vars are documented in `.env.example`; copy to `.env` before running anything locally.

## Superpowers skills

This repo uses the Superpowers skill system (`.claude/skills/`, `.superpowers/`, `docs/superpowers/`) — check `docs/superpowers/plans/` and `docs/superpowers/specs/` for in-flight design/implementation plans before starting related work.
