FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /workspace
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /workspace

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /workspace /workspace

EXPOSE 8080

CMD ["pnpm", "exec", "tsx", "apps/api/src/main.ts"]
