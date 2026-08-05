# Onboarding OTP, Sesión y Ciclo de Sellos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el enroll sin verificación de `pwa-client` por un flujo con OTP por WhatsApp, sesión persistente en base de datos, un mecanismo unificado de confirmación (`PendingRequest`) para acumular/reclamar vía código de 6 dígitos + notificación SSE a caja, y un ciclo de sellos configurable por tienda (máx. 12) con reinicio atado al reclamo del premio final.

**Architecture:** NestJS API (`apps/api`) gana 2 controladores nuevos (`customer-auth`, `pending-requests`) más validaciones en los existentes (`stores`, `promotions`). `pwa-client` reemplaza su flujo de enroll por un state machine (OTP → nombre si aplica → preview → tarjeta con 3 acciones → espera de confirmación) y agrega la vista "mis tarjetas". `merchant-dashboard` agrega un panel de notificaciones SSE con confirmar/rechazar y un campo de configuración del ciclo de sellos. La grilla de sellos vive en `PassPreview` (shared-ui) para que ambas apps la reutilicen.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL, Redis/BullMQ (WhatsApp queue), RxJS (SSE), Next.js 15 (pwa-client, merchant-dashboard), `@onda/shared-ui`.

## Global Constraints

- **Alcance:** solo `Store`. No tocar `Event`, `apps/organizer-dashboard`, ni su lógica de `globalTarget`.
- **Sin Playwright ni pruebas E2E.** Este repo no tiene framework de tests configurado (no hay `jest.config`, no hay `*.spec.ts`). La verificación de cada tarea es: el código compila (`tsc --noEmit` para la app tocada) y el diff se revisa manualmente — no se agrega infraestructura de testing nueva.
- Todos los códigos (OTP login, `PendingRequest` ACCUMULATE/CLAIM) son de 6 dígitos, expiran a los 10 minutos.
- El límite de 5 intentos fallidos aplica **solo** al OTP de login (se escribe manualmente). Los códigos de `PendingRequest` nunca se escriben — caja solo compara visualmente y confirma — así que no llevan límite de intentos.
- `Store.pinCode` y el endpoint `POST /transactions/accumulate` / `POST /transactions/redeem` que lo usan **no se tocan ni se borran**; solo se oculta del UI de `merchant-dashboard` la tarjeta que expone ese flujo manual.
- **Cuota de WhatsApp (`store.whatsappUsed`):** decisión pendiente en el spec (sección 7). Para esta implementación, los mensajes de OTP y de `PendingRequest` **no** incrementan `whatsappUsed` — solo el mensaje de bienvenida del `/enroll` original sigue contando, sin cambios. Si se decide lo contrario más adelante, es un cambio aislado a `customer-auth.service.ts` y `pending-requests.controller.ts`.
- **Comportamiento de "rechazar"** (spec sección 7, también pendiente): el `PendingRequest` pasa a `REJECTED`, sin notificación adicional al cliente. Como el endpoint de creación solo reutiliza solicitudes en estado `PENDING`, el cliente puede pedir un código nuevo de inmediato tras un rechazo — no hace falta lógica de límite ni cooldown.
- Sin estado `EXPIRED` separado (spec sección 2): la expiración se valida por fecha (`expiresAt`) al momento de confirmar/crear. Una solicitud `PENDING` vencida se marca `REJECTED` de forma perezosa (al intentar reutilizarla o confirmarla), nunca hay un job en segundo plano.
- Modo desarrollo: cuando `KAPSO_API_KEY` no está configurada, el endpoint devuelve el código en la respuesta (`devCode`) para que el UI de `pwa-client` lo muestre directamente — nunca se hace esto si `KAPSO_API_KEY` está presente.
- Comandos de verificación:
  - API: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
  - pwa-client: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
  - merchant-dashboard: `pnpm exec tsc --noEmit -p apps/merchant-dashboard/tsconfig.json`
  - Prisma: `pnpm exec prisma migrate dev --schema=libs/database/prisma/schema.prisma --name <nombre> --skip-seed`
- Postgres y Redis ya corren localmente vía `docker compose` (contenedores `onda-postgres-1`, `onda-redis-1` verificados activos) — las migraciones se pueden ejecutar de verdad, no hace falta simularlas.

---

## Fase 1 — Modelo de datos

### Task 1: Extender `schema.prisma` (Session, OtpCode, PendingRequest, Store.maxStamps, Pass.cycleStartedAt)

**Files:**
- Modify: `libs/database/prisma/schema.prisma`

**Interfaces:**
- Produces: modelos `Session`, `OtpCode`, `PendingRequest`; enums `PendingRequestType` (`ACCUMULATE`|`CLAIM`), `PendingRequestStatus` (`PENDING`|`CONFIRMED`|`REJECTED`); `Store.maxStamps: Int`; `Pass.cycleStartedAt: DateTime`. Todas las tareas de la Fase 2+ dependen de estos nombres exactos.

Nota de implementación: `Pass.cycleStartedAt` no está en el spec escrito, pero es necesaria para poder validar "no reclamar el mismo premio dos veces en el mismo ciclo" (spec sección 2) sin agregar un estado nuevo — se compara contra `Transaction.createdAt` del mismo `promotionId`. Se resetea a `now()` junto con `points = 0` cuando se reclama el premio del sello final.

- [ ] **Step 1: Agregar los enums y modelos nuevos**

Agregar después del enum `PromotionExpiryMode` (línea 43 actual):

```prisma
enum PendingRequestType {
  ACCUMULATE
  CLAIM
}

enum PendingRequestStatus {
  PENDING
  CONFIRMED
  REJECTED
}
```

Agregar al final del archivo, después del modelo `Draw`:

```prisma
model Session {
  id        String    @id @default(uuid())
  token     String    @unique
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  @@index([userId])
}

model OtpCode {
  id         String    @id @default(uuid())
  phone      String
  code       String
  attempts   Int       @default(0)
  createdAt  DateTime  @default(now())
  expiresAt  DateTime
  consumedAt DateTime?

  @@index([phone])
}

model PendingRequest {
  id          String               @id @default(uuid())
  type        PendingRequestType
  code        String
  passId      String
  storeId     String
  promotionId String?
  status      PendingRequestStatus @default(PENDING)
  createdAt   DateTime             @default(now())
  expiresAt   DateTime
  resolvedAt  DateTime?
  pass        Pass                 @relation(fields: [passId], references: [id])
  store       Store                @relation(fields: [storeId], references: [id])
  promotion   Promotion?           @relation(fields: [promotionId], references: [id])

  @@index([storeId, status])
  @@index([passId, status])
}
```

- [ ] **Step 2: Agregar campos y relaciones inversas en modelos existentes**

En `model Store`, agregar junto a `whatsappUsed`:

```prisma
  maxStamps        Int                    @default(12)
```

y agregar a la lista de relaciones:

```prisma
  pendingRequests  PendingRequest[]
```

En `model User`, agregar junto a `passes`:

```prisma
  sessions  Session[]
```

En `model Pass`, agregar junto a `points`:

```prisma
  cycleStartedAt DateTime      @default(now())
```

y agregar a la lista de relaciones:

```prisma
  pendingRequests PendingRequest[]
```

En `model Promotion`, agregar a la lista de relaciones:

```prisma
  pendingRequests PendingRequest[]
```

- [ ] **Step 3: Generar y aplicar la migración**

Run: `pnpm exec prisma migrate dev --schema=libs/database/prisma/schema.prisma --name add_otp_sessions_pending_requests --skip-seed`
Expected: migración creada en `libs/database/prisma/migrations/`, aplicada sin error, Prisma Client regenerado.

- [ ] **Step 4: Verificar que el cliente Prisma generado compila contra el resto del código**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin nuevos errores (el código existente no referencia los modelos nuevos todavía).

- [ ] **Step 5: Commit**

```bash
git add libs/database/prisma/schema.prisma libs/database/prisma/migrations
git commit -m "Add Session, OtpCode, PendingRequest models and stamp-cycle fields"
```

---

## Fase 2 — Backend: autenticación de cliente por OTP y sesión

### Task 2: `CustomerAuthService` (OTP + sesión)

**Files:**
- Create: `apps/api/src/customer-auth.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (`apps/api/src/prisma.service.ts`), `WhatsappService.enqueue(job)` (`apps/api/src/whatsapp.service.ts:39`).
- Produces (usado por Task 3 y por Task 5 `PendingRequestsController`):
  - `requestOtp(phone: string): Promise<{ expiresAt: Date; devCode?: string }>`
  - `verifyOtp(phone: string, code: string): Promise<{ token: string; user: User; isNewUser: boolean }>`
  - `setProfile(token: string, name: string): Promise<User>`
  - `requireSession(token: string): Promise<User>` — lanza `UnauthorizedException` si el token falta, no existe o está revocado.
  - `logout(token: string): Promise<{ ok: true }>`

- [ ] **Step 1: Escribir el servicio**

```ts
// apps/api/src/customer-auth.service.ts
import { Inject, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService
  ) {}

  async requestOtp(phone: string) {
    const code = randomCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.prisma.otpCode.create({ data: { phone, code, expiresAt } });

    const devMode = !process.env.KAPSO_API_KEY;
    if (!devMode) {
      await this.whatsapp.enqueue({
        to: phone,
        template: 'onda_otp_login',
        variables: { code },
      });
    }

    return { expiresAt, devCode: devMode ? code : undefined };
  }

  async verifyOtp(phone: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Código expirado, solicita uno nuevo');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Demasiados intentos, solicita un código nuevo');
    }
    if (otp.code !== code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código incorrecto');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;
    if (!user) {
      user = await this.prisma.user.create({ data: { name: '', phone } });
    }

    const token = randomToken();
    await this.prisma.session.create({ data: { token, userId: user.id } });

    return { token, user, isNewUser };
  }

  async setProfile(token: string, name: string) {
    const user = await this.requireSession(token);
    return this.prisma.user.update({ where: { id: user.id }, data: { name } });
  }

  async requireSession(token: string) {
    if (!token) throw new UnauthorizedException('Sesión requerida');
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return session.user;
  }

  async logout(token: string) {
    await this.prisma.session.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true as const };
  }
}
```

- [ ] **Step 2: Registrar el servicio en el módulo**

En `apps/api/src/app.module.ts`, agregar el import:

```ts
import { CustomerAuthService } from './customer-auth.service';
```

y agregarlo al arreglo `providers` (junto a `WhatsappService`):

```ts
  providers: [PrismaService, WalletService, WhatsappService, CustomerAuthService],
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/customer-auth.service.ts apps/api/src/app.module.ts
git commit -m "Add CustomerAuthService for OTP login and session management"
```

### Task 3: `CustomerAuthController` (endpoints OTP/sesión)

**Files:**
- Create: `apps/api/src/customer-auth.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `CustomerAuthService` (Task 2).
- Produces: `POST /api/customer-auth/otp`, `POST /api/customer-auth/otp/verify`, `PATCH /api/customer-auth/profile`, `GET /api/customer-auth/session`, `POST /api/customer-auth/logout`. Todos (menos `otp`) requieren header `Authorization: Bearer <token>`.

- [ ] **Step 1: Escribir el controlador**

```ts
// apps/api/src/customer-auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';

function toE164Colombia(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('57') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('3') && digits.length === 10) return `+57${digits}`;
  if (input.trim().startsWith('+')) return input.trim();
  return `+${digits}`;
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(@Inject(CustomerAuthService) private auth: CustomerAuthService) {}

  @Post('otp')
  requestOtp(@Body() body: { phone: string }) {
    return this.auth.requestOtp(toE164Colombia(body.phone));
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: { phone: string; code: string }) {
    return this.auth.verifyOtp(toE164Colombia(body.phone), body.code);
  }

  @Patch('profile')
  setProfile(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string }
  ) {
    return this.auth.setProfile(bearerToken(authHeader), body.name);
  }

  @Get('session')
  async session(@Headers('authorization') authHeader: string) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    return { user };
  }

  @Post('logout')
  logout(@Headers('authorization') authHeader: string) {
    return this.auth.logout(bearerToken(authHeader));
  }
}
```

Nota: `toE164Colombia` se duplica localmente en vez de importarse de `@onda/shared-utils`, siguiendo el mismo patrón ya usado en `apps/api/src/users.controller.ts:7`.

- [ ] **Step 2: Registrar el controlador**

En `apps/api/src/app.module.ts`, agregar el import:

```ts
import { CustomerAuthController } from './customer-auth.controller';
```

y agregarlo al arreglo `controllers` (junto a `AuthController`):

```ts
    AuthController,
    CustomerAuthController,
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/customer-auth.controller.ts apps/api/src/app.module.ts
git commit -m "Add customer OTP login and session endpoints"
```

---

## Fase 3 — Backend: PendingRequest (acumular/reclamar) + SSE a caja

### Task 4: `PendingRequestsSseService` (bus SSE en memoria por tienda)

**Files:**
- Create: `apps/api/src/pending-requests-sse.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces (usado por Task 5): `stream(storeId: string): Observable<MessageEvent>`, `emit(storeId: string, data: unknown): void`.

- [ ] **Step 1: Escribir el servicio**

```ts
// apps/api/src/pending-requests-sse.service.ts
import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class PendingRequestsSseService {
  private streams = new Map<string, Subject<MessageEvent>>();

  private bus(storeId: string): Subject<MessageEvent> {
    let subject = this.streams.get(storeId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(storeId, subject);
    }
    return subject;
  }

  stream(storeId: string) {
    return this.bus(storeId).asObservable();
  }

  emit(storeId: string, data: unknown) {
    this.bus(storeId).next({ data });
  }
}
```

- [ ] **Step 2: Registrar el servicio**

En `apps/api/src/app.module.ts`, agregar import y agregarlo a `providers`:

```ts
import { PendingRequestsSseService } from './pending-requests-sse.service';
```

```ts
  providers: [PrismaService, WalletService, WhatsappService, CustomerAuthService, PendingRequestsSseService],
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/pending-requests-sse.service.ts apps/api/src/app.module.ts
git commit -m "Add in-memory per-store SSE bus for pending requests"
```

### Task 5: `PendingRequestsController` (crear, confirmar, rechazar, listar, stream)

**Files:**
- Create: `apps/api/src/pending-requests.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `WhatsappService.enqueue`, `CustomerAuthService.requireSession` (Task 2), `PendingRequestsSseService.stream`/`emit` (Task 4).
- Produces:
  - `POST /api/pending-requests` (Bearer) `{ passId, type: 'ACCUMULATE'|'CLAIM', promotionId? }` → `PendingRequest` (+ `devCode` si aplica).
  - `GET /api/pending-requests/mine?passId=` (Bearer) → `PendingRequest | null` (la más reciente en `PENDING`).
  - `GET /api/pending-requests/pending?storeId=` → lista para carga inicial de caja.
  - `GET /api/pending-requests/stream?storeId=` → SSE.
  - `POST /api/pending-requests/:id/confirm` → aplica el efecto y marca `CONFIRMED`.
  - `POST /api/pending-requests/:id/reject` → marca `REJECTED`.

- [ ] **Step 1: Escribir el controlador**

```ts
// apps/api/src/pending-requests.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from './prisma.service';
import { WhatsappService } from './whatsapp.service';
import { CustomerAuthService } from './customer-auth.service';
import { PendingRequestsSseService } from './pending-requests-sse.service';

const CODE_TTL_MS = 10 * 60 * 1000;

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new ForbiddenException('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('pending-requests')
export class PendingRequestsController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WhatsappService) private whatsapp: WhatsappService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService,
    @Inject(PendingRequestsSseService) private sse: PendingRequestsSseService
  ) {}

  @Sse('stream')
  stream(@Query('storeId') storeId: string): Observable<MessageEvent> {
    return this.sse.stream(storeId);
  }

  @Get('pending')
  listPending(@Query('storeId') storeId: string) {
    return this.prisma.pendingRequest.findMany({
      where: { storeId, status: 'PENDING' },
      include: { pass: { include: { user: true } }, promotion: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('mine')
  async mine(
    @Headers('authorization') authHeader: string,
    @Query('passId') passId: string
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    const pass = await this.prisma.pass.findUniqueOrThrow({ where: { id: passId } });
    if (pass.userId !== user.id) throw new ForbiddenException('Este pase no es tuyo');

    // Sin filtro de status: el front necesita ver el cambio PENDING -> CONFIRMED/REJECTED
    // de la misma fila para saber cómo se resolvió, no solo que ya no está pendiente.
    return this.prisma.pendingRequest.findFirst({
      where: { passId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() body: { passId: string; type: 'ACCUMULATE' | 'CLAIM'; promotionId?: string }
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id: body.passId },
      include: { user: true },
    });
    if (pass.userId !== user.id) throw new ForbiddenException('Este pase no es tuyo');
    if (!pass.storeId) throw new BadRequestException('Pase sin negocio asociado');
    const storeId = pass.storeId;

    const existing = await this.prisma.pendingRequest.findFirst({
      where: { passId: pass.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.expiresAt > new Date()) {
        return existing;
      }
      await this.prisma.pendingRequest.update({
        where: { id: existing.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
    }

    let promotion: { id: string; title: string; pointsRequired: number; storeId: string | null } | null = null;
    if (body.type === 'CLAIM') {
      if (!body.promotionId) throw new BadRequestException('Falta la promoción a reclamar');
      promotion = await this.prisma.promotion.findUniqueOrThrow({ where: { id: body.promotionId } });
      if (promotion.storeId !== storeId) {
        throw new BadRequestException('Promoción no pertenece a este negocio');
      }
      if (promotion.pointsRequired !== pass.points) {
        throw new BadRequestException('Aún no alcanzas este premio');
      }
      const alreadyClaimed = await this.prisma.transaction.findFirst({
        where: {
          passId: pass.id,
          promotionId: promotion.id,
          type: 'REDEEM',
          createdAt: { gte: pass.cycleStartedAt },
        },
      });
      if (alreadyClaimed) {
        throw new BadRequestException('Ya reclamaste este premio en este ciclo');
      }
    }

    const code = randomCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    const created = await this.prisma.pendingRequest.create({
      data: {
        type: body.type,
        code,
        passId: pass.id,
        storeId,
        promotionId: promotion?.id,
        expiresAt,
      },
    });

    const devMode = !process.env.KAPSO_API_KEY;
    if (!devMode) {
      await this.whatsapp.enqueue({
        to: pass.user.phone,
        template: 'onda_confirmar_codigo',
        variables: { code },
        storeId,
      });
    }

    this.sse.emit(storeId, {
      id: created.id,
      type: created.type,
      code: created.code,
      customerName: pass.user.name,
      promotionTitle: promotion?.title,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt,
    });

    return devMode ? { ...created, devCode: code } : created;
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({ where: { id } });
    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRequest.update({
        where: { id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
      throw new BadRequestException('Código expirado, el cliente debe pedir uno nuevo');
    }

    if (pending.type === 'ACCUMULATE') {
      await this.prisma.$transaction([
        this.prisma.pass.update({
          where: { id: pending.passId },
          data: { points: { increment: 1 } },
        }),
        this.prisma.transaction.create({
          data: { passId: pending.passId, storeId: pending.storeId, type: 'ACCUMULATE', points: 1 },
        }),
        this.prisma.pendingRequest.update({
          where: { id },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        }),
      ]);
    } else {
      const promotion = await this.prisma.promotion.findUniqueOrThrow({
        where: { id: pending.promotionId as string },
      });
      const store = await this.prisma.store.findUniqueOrThrow({ where: { id: pending.storeId } });
      const isFinalReward = promotion.pointsRequired === store.maxStamps;

      await this.prisma.$transaction([
        this.prisma.transaction.create({
          data: {
            passId: pending.passId,
            storeId: pending.storeId,
            type: 'REDEEM',
            points: promotion.pointsRequired,
            promotionId: promotion.id,
          },
        }),
        this.prisma.pass.update({
          where: { id: pending.passId },
          data: isFinalReward ? { points: 0, cycleStartedAt: new Date() } : {},
        }),
        this.prisma.pendingRequest.update({
          where: { id },
          data: { status: 'CONFIRMED', resolvedAt: new Date() },
        }),
      ]);
    }

    return { ok: true as const };
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    const pending = await this.prisma.pendingRequest.findUniqueOrThrow({ where: { id } });
    if (pending.status !== 'PENDING') {
      throw new BadRequestException('Esta solicitud ya no está pendiente');
    }
    await this.prisma.pendingRequest.update({
      where: { id },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });
    return { ok: true as const };
  }
}
```

- [ ] **Step 2: Registrar el controlador**

En `apps/api/src/app.module.ts`, agregar el import:

```ts
import { PendingRequestsController } from './pending-requests.controller';
```

y agregarlo al arreglo `controllers`:

```ts
    PendingRequestsController,
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Prueba manual rápida (sin Playwright/E2E, solo curl)**

Con la API corriendo (`pnpm run dev:api`), sin `KAPSO_API_KEY` configurada:

```bash
curl -s -X POST http://localhost:3333/api/customer-auth/otp -H 'Content-Type: application/json' -d '{"phone":"3001234567"}'
```

Expected: respuesta JSON con `devCode` de 6 dígitos y `expiresAt`. Confirma manualmente el resto del flujo (verify → create pending-request → confirm) contra una `Store`/`Pass` existentes de la seed, y verifica en los logs de la API que no hay excepciones no controladas.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pending-requests.controller.ts apps/api/src/app.module.ts
git commit -m "Add PendingRequest endpoints for accumulate/claim confirmation and SSE"
```

---

## Fase 4 — Backend: validación de ciclo de sellos y promociones

### Task 6: `stores.controller.ts` — aceptar y validar `maxStamps`

**Files:**
- Modify: `apps/api/src/stores.controller.ts`

**Interfaces:**
- Consumes: `store.maxStamps` (Task 1).
- Produces: `PATCH /api/stores/:id` acepta `maxStamps` y rechaza el guardado si no existe una promoción activa exactamente en ese sello (spec sección 2 y 5).

- [ ] **Step 1: Agregar la validación**

En `apps/api/src/stores.controller.ts`, agregar `BadRequestException` al import de `@nestjs/common` (línea 1-7):

```ts
import { Inject, Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query, } from '@nestjs/common';
```

Reemplazar el método `update` (líneas 69-84 actuales) por:

```ts
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      googlePlaceId: string;
      pinCode: string;
      lat: number;
      lng: number;
      planType: 'BASIC' | 'PRO';
      billingStatus: string;
      maxStamps: number;
    }>
  ) {
    let maxStamps: number | undefined;
    if (body.maxStamps != null) {
      maxStamps = Number(body.maxStamps);
      if (!Number.isInteger(maxStamps) || maxStamps < 1 || maxStamps > 12) {
        throw new BadRequestException('El tope de sellos debe ser un número entre 1 y 12');
      }
      const finalPromo = await this.prisma.promotion.findFirst({
        where: { storeId: id, pointsRequired: maxStamps, isActive: true },
      });
      if (!finalPromo) {
        throw new BadRequestException(
          `Debes tener una promoción activa en el sello ${maxStamps} antes de guardar este tope`
        );
      }
    }
    return this.prisma.store.update({
      where: { id },
      data: { ...body, maxStamps },
    });
  }
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/stores.controller.ts
git commit -m "Validate final-stamp promotion exists before saving store maxStamps"
```

### Task 7: `promotions.controller.ts` — validar `pointsRequired <= store.maxStamps`

**Files:**
- Modify: `apps/api/src/promotions.controller.ts`

**Interfaces:**
- Consumes: `store.maxStamps` (Task 1).
- Produces: `POST /api/promotions` y `PATCH /api/promotions/:id` rechazan `pointsRequired` mayor al tope de la tienda.

- [ ] **Step 1: Validar en `create`**

En `apps/api/src/promotions.controller.ts`, cambiar la firma de `create` (línea 289) de síncrona a `async` y agregar la validación después de `assertExpiryBody(body);`:

```ts
  @Post()
  async create(
    @Body()
    body: {
      title: string;
      pointsRequired: number;
      storeId?: string;
      eventId?: string;
      description?: string;
      imageUrl?: string;
      isActive?: boolean;
      type?: PromotionType;
      value?: number;
      buyQuantity?: number;
      getQuantity?: number;
      productName?: string;
      expiryMode: PromotionExpiryMode;
      endsAt?: string;
      maxRedemptions?: number;
    }
  ) {
    assertExpiryBody(body);
    if (body.storeId) {
      const store = await this.prisma.store.findUniqueOrThrow({ where: { id: body.storeId } });
      if (Number(body.pointsRequired) > store.maxStamps) {
        throw new BadRequestException(
          `El sello no puede superar el tope de ${store.maxStamps} de esta tienda`
        );
      }
    }
    return this.prisma.promotion.create({
```

(el resto del método `create` queda igual, solo se le agrega el bloque de validación antes del `return`).

- [ ] **Step 2: Validar en `update`**

En el método `update` (línea 338), agregar al inicio del cuerpo, antes del cálculo de `redemptionCount`:

```ts
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      pointsRequired: number;
      description: string;
      imageUrl: string | null;
      isActive: boolean;
      type: PromotionType;
      value: number | null;
      buyQuantity: number | null;
      getQuantity: number | null;
      productName: string | null;
      expiryMode: PromotionExpiryMode;
      endsAt: string | null;
      maxRedemptions: number | null;
    }>
  ) {
    if (body.pointsRequired != null) {
      const existing = await this.prisma.promotion.findUniqueOrThrow({ where: { id } });
      if (existing.storeId) {
        const store = await this.prisma.store.findUniqueOrThrow({ where: { id: existing.storeId } });
        if (Number(body.pointsRequired) > store.maxStamps) {
          throw new BadRequestException(
            `El sello no puede superar el tope de ${store.maxStamps} de esta tienda`
          );
        }
      }
    }

    const redemptionCount = await this.prisma.transaction.count({
```

(el resto del método `update` queda igual).

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/promotions.controller.ts
git commit -m "Validate promotion pointsRequired against store maxStamps"
```

---

## Fase 5 — pwa-client: login OTP, tarjeta con ciclo de sellos, mis tarjetas

### Task 8: helper de sesión de cliente

**Files:**
- Create: `apps/pwa-client/lib/session.ts`

**Interfaces:**
- Produces (usado por Tasks 10-13, 15): `loadSession(): CustomerSession | null`, `saveSession(session): void`, `clearSession(): void`, tipo `CustomerSession`.

- [ ] **Step 1: Escribir el helper**

```ts
// apps/pwa-client/lib/session.ts
export type CustomerSession = {
  token: string;
  user: { id: string; name: string; phone: string };
};

const KEY = 'onda_customer_session';

export function loadSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomerSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: CustomerSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/pwa-client/lib/session.ts
git commit -m "Add customer session storage helper for pwa-client"
```

### Task 9: `PassPreview` (shared-ui) — grilla de sellos en vez de número plano

**Files:**
- Modify: `libs/shared/ui/src/index.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `PassPreview` gana props opcionales `maxStamps?: number` (default `12`) y `milestoneStamps?: number[]` (default `[]`). Usado por `pwa-client` (Task 14) y `merchant-dashboard` (Task 18).

Este cambio vive en `shared-ui` (no en `pwa-client`) porque `PassPreview` ya se reutiliza en el preview de configuración de `merchant-dashboard` (`apps/merchant-dashboard/app/MerchantWorkspace.tsx:2416`) — así ambas apps ven la misma grilla sin duplicar lógica.

- [ ] **Step 1: Extender la firma de `PassPreview`**

En `libs/shared/ui/src/index.tsx`, reemplazar la firma de `PassPreview` (línea 150-173):

```tsx
export function PassPreview({
  backgroundColor = '#6E5AE6',
  foregroundColor = '#FFFFFF',
  labelColor = '#E5F6FC',
  title = 'Onda Rewards',
  subtitle = 'Tu pase de lealtad',
  description = 'Acumula ondas en cada visita',
  logoUrl,
  points = 0,
  maxStamps = 12,
  milestoneStamps = [],
  memberName,
  compact = false,
}: {
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  points?: number;
  maxStamps?: number;
  milestoneStamps?: number[];
  /** Nombre del miembro (como en Wallet) */
  memberName?: string | null;
  compact?: boolean;
}) {
```

- [ ] **Step 2: Mostrar `X/maxStamps` y agregar la grilla de sellos**

Reemplazar la línea del número de ondas (línea 231 actual):

```tsx
          <p className={`font-display font-bold ${compact ? 'text-2xl' : 'text-3xl'}`}>{points}</p>
```

por:

```tsx
          <p className={`font-display font-bold ${compact ? 'text-2xl' : 'text-3xl'}`}>
            {points}/{maxStamps}
          </p>
```

Agregar la grilla justo después del `</div>` que cierra el grid de "Miembro"/"Ondas" (después de la línea 233 actual, antes del bloque `{!compact && description ...}`):

```tsx
      <div
        className={`flex flex-wrap gap-1.5 ${compact ? 'px-4 pb-3' : 'px-5 pb-4'}`}
        aria-label="Progreso de sellos"
      >
        {Array.from({ length: maxStamps }).map((_, i) => {
          const stampNumber = i + 1;
          const filled = stampNumber <= points;
          const hasMilestone = milestoneStamps.includes(stampNumber);
          return (
            <span
              key={stampNumber}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
              style={{
                backgroundColor: filled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.18)',
                color: filled ? backgroundColor : foregroundColor,
                border: hasMilestone ? `1.5px solid ${foregroundColor}` : 'none',
              }}
              title={hasMilestone ? `Premio en el sello ${stampNumber}` : undefined}
            >
              {hasMilestone ? '★' : ''}
            </span>
          );
        })}
      </div>
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p libs/shared/ui/tsconfig.json` si existe ese tsconfig; si no, verificar vía las apps que lo consumen:

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json && pnpm exec tsc --noEmit -p apps/merchant-dashboard/tsconfig.json`
Expected: sin errores (los call-sites existentes no pasan `maxStamps`/`milestoneStamps`, así que usan los defaults y siguen compilando).

- [ ] **Step 4: Commit**

```bash
git add libs/shared/ui/src/index.tsx
git commit -m "Render stamp grid with milestone markers in PassPreview"
```

### Task 10: `OtpStep.tsx` — pantalla de celular + código OTP

**Files:**
- Create: `apps/pwa-client/app/r/[storeId]/OtpStep.tsx`

**Interfaces:**
- Consumes: `api` (`@onda/shared-ui`), `toE164Colombia`/`isCompletePhoneMask` (`@onda/shared-utils`).
- Produces: `<OtpStep onVerified={(result: { token: string; user: User; isNewUser: boolean }) => void} />`, usado por Task 13.

- [ ] **Step 1: Escribir el componente**

```tsx
// apps/pwa-client/app/r/[storeId]/OtpStep.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { PhoneInput, api } from '@onda/shared-ui';
import { toE164Colombia, isCompletePhoneMask } from '@onda/shared-utils';

type VerifyResult = {
  token: string;
  user: { id: string; name: string; phone: string };
  isNewUser: boolean;
};

export function OtpStep({ onVerified }: { onVerified: (result: VerifyResult) => void }) {
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    if (!isCompletePhoneMask(phone) || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ expiresAt: string; devCode?: string }>('/customer-auth/otp', {
        method: 'POST',
        body: JSON.stringify({ phone: toE164Colombia(phone) }),
      });
      setDevCode(res.devCode || null);
      setStage('code');
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar el código');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<VerifyResult>('/customer-auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: toE164Colombia(phone), code }),
      });
      onVerified(res);
    } catch (err: any) {
      setError(err.message || 'Código incorrecto');
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'phone') {
    return (
      <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={requestOtp}>
        <p className="onda-pwa-sub">Ingresa tu celular para continuar por WhatsApp</p>
        <PhoneInput
          required
          autoFocus
          enterKeyHint="go"
          placeholder="WhatsApp"
          className="onda-pwa-field"
          value={phone}
          onChange={setPhone}
        />
        {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
        <button
          type="submit"
          className="onda-pwa-cta"
          disabled={!isCompletePhoneMask(phone) || busy}
        >
          {busy ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={verify}>
      <p className="onda-pwa-sub">Ingresa el código de 6 dígitos que te enviamos por WhatsApp</p>
      {devCode ? (
        <p className="rounded-xl bg-[var(--onda-violet-soft)] px-3 py-2 text-sm text-[var(--onda-violet)]">
          Modo desarrollo — tu código es <strong>{devCode}</strong>
        </p>
      ) : null}
      <input
        required
        autoFocus
        type="tel"
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        className="onda-pwa-field text-center tracking-[0.4em]"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
      <button type="submit" className="onda-pwa-cta" disabled={code.length !== 6 || busy}>
        {busy ? 'Verificando…' : 'Verificar código'}
      </button>
      <button
        type="button"
        className="onda-pwa-secondary"
        onClick={() => requestOtp()}
        disabled={busy}
      >
        Reenviar código
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores (el componente no está montado todavía, pero debe tipar limpio de forma aislada).

- [ ] **Step 3: Commit**

```bash
git add apps/pwa-client/app/r/[storeId]/OtpStep.tsx
git commit -m "Add OTP phone verification step for pwa-client"
```

### Task 11: `PendingRequestWait.tsx` — pantalla de espera de confirmación

**Files:**
- Create: `apps/pwa-client/app/r/[storeId]/PendingRequestWait.tsx`

**Interfaces:**
- Consumes: `api` (`@onda/shared-ui`), `loadSession` (`@/lib/session`, Task 8).
- Produces: `<PendingRequestWait passId={string} session={CustomerSession} onResolved={(status: 'CONFIRMED'|'REJECTED'|'EXPIRED') => void} onCancelled={() => void} />`, usado por Task 13.

- [ ] **Step 1: Escribir el componente**

```tsx
// apps/pwa-client/app/r/[storeId]/PendingRequestWait.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@onda/shared-ui';
import type { CustomerSession } from '@/lib/session';

export type PendingRequestDto = {
  id: string;
  passId: string;
  code: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  expiresAt: string;
  devCode?: string;
};

export function PendingRequestWait({
  request,
  passId,
  session,
  onResolved,
}: {
  request: PendingRequestDto;
  passId: string;
  session: CustomerSession;
  onResolved: (status: 'CONFIRMED' | 'REJECTED' | 'EXPIRED') => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(request.expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    let cancelled = false;

    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        // /mine devuelve la solicitud más reciente sin filtrar por status, así el
        // front puede distinguir CONFIRMED de REJECTED una vez deja de estar PENDING.
        const current = await api<PendingRequestDto | null>(
          `/pending-requests/mine?passId=${passId}`,
          { headers: { Authorization: `Bearer ${session.token}` } }
        );
        if (cancelled) return;
        if (current && current.id === request.id && current.status !== 'PENDING') {
          onResolved(current.status === 'CONFIRMED' ? 'CONFIRMED' : 'REJECTED');
        }
      } catch {
        /* red intermitente: se reintenta en el próximo tick */
      }
    }, 3000);

    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          onResolved('EXPIRED');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [passId, request.id, session.token, onResolved]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="onda-pwa-sub">Muéstrale este código a caja</p>
      <p className="font-display text-5xl font-bold tracking-[0.2em] text-[var(--onda-violet)]">
        {request.devCode || request.code}
      </p>
      <p className="text-sm text-[var(--onda-muted)]">Expira en {mm}:{ss}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/pwa-client/app/r/[storeId]/PendingRequestWait.tsx
git commit -m "Add pending-request waiting screen with polling for pwa-client"
```

### Task 12: `passes.controller.ts` — endpoint de reclamo de tarjeta y "claimed this cycle"

**Files:**
- Modify: `apps/api/src/passes.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `CustomerAuthService.requireSession` (Task 2).
- Produces:
  - `POST /api/passes/store/:storeId/claim` (Bearer) → crea (o reutiliza) el `Pass` con `points: 0` para el usuario de la sesión (spec sección 3, paso 6).
  - `GET /api/passes/:id` ahora incluye `claimedPromotionIdsThisCycle: string[]` para que el front sepa qué premios ya no se pueden reclamar en este ciclo.

- [ ] **Step 1: Agregar la dependencia de `CustomerAuthService`**

En `apps/api/src/passes.controller.ts`, cambiar el import y el constructor:

```ts
import { Inject, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WalletService } from './wallet.service';
import { CustomerAuthService } from './customer-auth.service';

function randomSerial() {
  return `ONDA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function bearerToken(header?: string): string {
  if (!header?.startsWith('Bearer ')) {
    throw new Error('Falta token de sesión');
  }
  return header.slice('Bearer '.length);
}

@Controller('passes')
export class PassesController {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(WalletService) private wallet: WalletService,
    @Inject(CustomerAuthService) private auth: CustomerAuthService
  ) {}
```

- [ ] **Step 2: Extender `GET :id` con `claimedPromotionIdsThisCycle`**

Reemplazar el método `get` (líneas 12-23 actuales):

```ts
  @Get(':id')
  async get(@Param('id') id: string) {
    const pass = await this.prisma.pass.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        store: { include: { passDesign: true, promotions: true } },
        event: { include: { passDesign: true, promotions: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    const claimedThisCycle = await this.prisma.transaction.findMany({
      where: {
        passId: id,
        type: 'REDEEM',
        createdAt: { gte: pass.cycleStartedAt },
        promotionId: { not: null },
      },
      select: { promotionId: true },
    });

    return {
      ...pass,
      claimedPromotionIdsThisCycle: claimedThisCycle.map((t) => t.promotionId as string),
    };
  }
```

- [ ] **Step 3: Agregar el endpoint de reclamo de tarjeta**

Agregar al final de la clase, después del método `issue`:

```ts
  @Post('store/:storeId/claim')
  async claimStorePass(
    @Param('storeId') storeId: string,
    @Headers('authorization') authHeader: string
  ) {
    const user = await this.auth.requireSession(bearerToken(authHeader));

    let pass = await this.prisma.pass.findFirst({ where: { userId: user.id, storeId } });
    if (!pass) {
      pass = await this.prisma.pass.create({
        data: {
          userId: user.id,
          storeId,
          serialNumber: randomSerial(),
          points: 0,
        },
      });
    }

    return this.prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
      include: { store: { include: { passDesign: true, promotions: true } } },
    });
  }
```

- [ ] **Step 4: Registrar la nueva dependencia en el módulo**

`PassesController` ya está registrado en `apps/api/src/app.module.ts`; solo falta que `CustomerAuthService` siga estando en `providers` (ya se agregó en Task 2) — no se requiere ningún cambio adicional en `app.module.ts` para este task.

- [ ] **Step 5: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/passes.controller.ts
git commit -m "Add store pass claim endpoint and per-cycle claimed promotions"
```

### Task 13: reescribir `StoreEntryClient.tsx` — flujo completo OTP → preview → tarjeta

**Files:**
- Modify: `apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx`

**Interfaces:**
- Consumes: `OtpStep` (Task 10), `PendingRequestWait` (Task 11), `loadSession`/`saveSession` (Task 8), `POST /passes/store/:storeId/claim` (Task 12), `POST /pending-requests` y `GET /pending-requests/mine` (Task 5), `PassPreview` vía `PassSwipe` (Task 9/14).
- Produces: componente `StoreEntryPage` (export default), sin cambios en su punto de montaje (`apps/pwa-client/app/r/[storeId]/page.tsx` no se toca).

- [ ] **Step 1: Reescribir el archivo completo**

```tsx
// apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@onda/shared-ui';
import { loadSession, saveSession, type CustomerSession } from '@/lib/session';
import { PassSwipe, type PassSwipeCard } from './PassSwipe';
import { OtpStep } from './OtpStep';
import { PendingRequestWait, type PendingRequestDto } from './PendingRequestWait';

type Step = 'loading' | 'otp' | 'name' | 'preview' | 'home' | 'pendingWait' | 'rewards';

function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
}

export default function StoreEntryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;

  const [step, setStep] = useState<Step>('loading');
  const [store, setStore] = useState<any>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [pass, setPass] = useState<any>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [walletLinks, setWalletLinks] = useState<{ appleUrl?: string; googleUrl?: string } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequestDto | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const s = await api<any>(`/stores/${storeId}`);
        if (cancelled) return;
        setStore(s);

        const existing = loadSession();
        if (!existing) {
          setStep('otp');
          return;
        }
        setSession(existing);
        await loadOrPreview(existing, s);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'No se pudo conectar');
          setStep('otp');
        }
      }
    }

    async function loadOrPreview(sess: CustomerSession, s: any) {
      const passes = await api<any[]>(`/passes?userId=${sess.user.id}&storeId=${storeId}`);
      if (passes[0]) {
        setPass(passes[0]);
        setStep('home');
      } else {
        setStep('preview');
      }
      void s;
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function onOtpVerified(result: { token: string; user: CustomerSession['user']; isNewUser: boolean }) {
    const sess: CustomerSession = { token: result.token, user: result.user };
    saveSession(sess);
    setSession(sess);
    if (result.isNewUser) {
      setStep('name');
      return;
    }
    const passes = await api<any[]>(`/passes?userId=${sess.user.id}&storeId=${storeId}`);
    if (passes[0]) {
      setPass(passes[0]);
      setStep('home');
    } else {
      setStep('preview');
    }
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    if (!session || name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api<CustomerSession['user']>('/customer-auth/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const sess: CustomerSession = { token: session.token, user: updated };
      saveSession(sess);
      setSession(sess);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar tu nombre');
    } finally {
      setBusy(false);
    }
  }

  async function claimCard() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const created = await api<any>(`/passes/store/${storeId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      setPass(created);
      setStep('home');
    } catch (err: any) {
      setError(err.message || 'No se pudo reclamar tu tarjeta');
    } finally {
      setBusy(false);
    }
  }

  async function openWallet() {
    if (!pass?.id) return;
    setBusy(true);
    try {
      const links = await api<{ appleUrl?: string; googleUrl?: string }>(
        `/passes/${pass.id}/issue`,
        { method: 'POST' }
      );
      setWalletLinks(links);
      const target = isAppleDevice() ? links.appleUrl : links.googleUrl;
      if (target && typeof window !== 'undefined') {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo abrir Wallet');
    } finally {
      setBusy(false);
    }
  }

  async function startPendingRequest(type: 'ACCUMULATE' | 'CLAIM', promotionId?: string) {
    if (!session || !pass) return;
    setBusy(true);
    setError('');
    try {
      const created = await api<PendingRequestDto>('/pending-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ passId: pass.id, type, promotionId }),
      });
      setPendingRequest(created);
      setStep('pendingWait');
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar la solicitud');
    } finally {
      setBusy(false);
    }
  }

  async function onPendingResolved(status: 'CONFIRMED' | 'REJECTED' | 'EXPIRED') {
    if (status === 'CONFIRMED' && pass) {
      const refreshed = await api<any>(`/passes/${pass.id}`);
      setPass(refreshed);
    }
    setPendingRequest(null);
    setStep('home');
  }

  const promotions = useMemo(
    () => (store?.promotions || []).filter((p: any) => p.isActive),
    [store]
  );
  const milestoneStamps = useMemo(
    () => promotions.map((p: any) => p.pointsRequired as number),
    [promotions]
  );
  const claimablePromotion = useMemo(() => {
    if (!pass) return null;
    const claimed: string[] = pass.claimedPromotionIdsThisCycle || [];
    return (
      promotions.find(
        (p: any) => p.pointsRequired === pass.points && !claimed.includes(p.id)
      ) || null
    );
  }, [pass, promotions]);

  const storeDesign = store?.passDesign;
  const storeName = store?.name || 'tu visita';
  const walletLabel = isAppleDevice() ? 'Agregar a Apple Wallet' : 'Añadir a Google Wallet';
  const logoUrl = storeDesign?.logoUrl as string | undefined;
  const storeInitial = (storeName.trim().charAt(0) || 'O').toUpperCase();

  const swipeCards: PassSwipeCard[] = useMemo(() => {
    if (!storeDesign && !store) return [];
    return [
      {
        key: 'store',
        badge: 'Pase del negocio',
        design: {
          backgroundColor: storeDesign?.backgroundColor,
          foregroundColor: storeDesign?.foregroundColor,
          labelColor: storeDesign?.labelColor,
          title: storeDesign?.title || storeName,
          subtitle: storeDesign?.subtitle || 'Onda Rewards',
          description: storeDesign?.description,
          logoUrl: storeDesign?.logoUrl,
        },
        points: pass?.points ?? 0,
        maxStamps: store?.maxStamps ?? 12,
        milestoneStamps,
      },
    ];
  }, [storeDesign, store, storeName, pass, milestoneStamps]);

  if (step === 'loading') {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
        <p className="text-sm text-[var(--onda-muted)]">Preparando tu pase…</p>
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-avatar" aria-hidden>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : (
            <span>{storeInitial}</span>
          )}
        </div>
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">
            {step === 'rewards' ? 'Recompensas' : storeName}
          </h1>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        {step === 'otp' && <OtpStep onVerified={onOtpVerified} />}

        {step === 'name' && (
          <form className="flex flex-1 flex-col justify-center gap-3" onSubmit={submitName}>
            <p className="onda-pwa-sub">¿Cómo te llamas?</p>
            <input
              required
              autoFocus
              autoComplete="given-name"
              placeholder="Tu nombre en el pase"
              className="onda-pwa-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error ? <p className="text-sm text-[var(--onda-danger)]">{error}</p> : null}
            <button type="submit" className="onda-pwa-cta" disabled={name.trim().length < 2 || busy}>
              {busy ? 'Guardando…' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'preview' && (
          <div className="flex flex-1 flex-col">
            <PassSwipe cards={swipeCards} memberName={session?.user.name} compact />
            <div className="onda-pwa-bottom">
              {error ? <p className="mb-2 text-sm text-[var(--onda-danger)]">{error}</p> : null}
              <button type="button" className="onda-pwa-cta" disabled={busy} onClick={claimCard}>
                {busy ? 'Reclamando…' : 'Reclamar onda'}
              </button>
            </div>
          </div>
        )}

        {step === 'home' && pass && (
          <div className="flex flex-1 flex-col">
            <PassSwipe cards={swipeCards} memberName={session?.user.name} compact={false} />
            <div className="onda-pwa-bottom">
              {error ? <p className="mb-2 text-sm text-[var(--onda-danger)]">{error}</p> : null}
              <button type="button" className="onda-pwa-cta" disabled={busy} onClick={openWallet}>
                {busy ? 'Abriendo Wallet…' : walletLabel}
              </button>
              <button
                type="button"
                className="onda-pwa-secondary"
                disabled={busy}
                onClick={() => startPendingRequest('ACCUMULATE')}
              >
                Acumular onda
              </button>
              {claimablePromotion ? (
                <button
                  type="button"
                  className="onda-pwa-secondary"
                  disabled={busy}
                  onClick={() => startPendingRequest('CLAIM', claimablePromotion.id)}
                >
                  Reclamar {claimablePromotion.title}
                </button>
              ) : null}
              {promotions.length >= 2 ? (
                <button
                  type="button"
                  className="onda-pwa-secondary"
                  onClick={() => setStep('rewards')}
                >
                  Ver premios del ciclo
                </button>
              ) : null}
              {walletLinks ? (
                <p className="onda-pwa-legal">
                  Si no se abrió,{' '}
                  <a
                    href={isAppleDevice() ? walletLinks.appleUrl : walletLinks.googleUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    toca aquí
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        )}

        {step === 'pendingWait' && pendingRequest && session && pass && (
          <PendingRequestWait
            request={pendingRequest}
            passId={pass.id}
            session={session}
            onResolved={onPendingResolved}
          />
        )}

        {step === 'rewards' && (
          <div className="flex flex-1 flex-col gap-3">
            <button
              type="button"
              className="self-start text-sm font-medium text-[var(--onda-violet)]"
              onClick={() => setStep('home')}
            >
              ← Volver al pase
            </button>
            <div className="flex flex-col gap-3 pb-6">
              {promotions.map((p: any) => (
                <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[16/9] bg-[var(--onda-violet-soft)]" />
                  )}
                  <div className="p-4">
                    <p className="font-semibold">{p.title}</p>
                    {p.description ? (
                      <p className="mt-1 text-sm text-[var(--onda-muted)]">{p.description}</p>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold text-[var(--onda-violet)]">
                      Sello {p.pointsRequired} de {store?.maxStamps ?? 12}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

Notas de este task:
- El parámetro de URL `event`/`table` y el soporte multi-tarjeta (negocio+evento) del archivo original se elimina de esta pantalla porque el alcance es solo `Store` (spec explícito). El código de `Event` en `apps/api` no se toca.
- `POST /enroll` (`apps/api/src/users.controller.ts:36`) queda sin usar desde `pwa-client` pero no se borra — no forma parte del alcance de este plan tocar/eliminar endpoints existentes que no estén explícitamente reemplazados.

- [ ] **Step 2: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx
git commit -m "Rework store entry flow with OTP login and pending-request confirmation"
```

### Task 14: `PassSwipe.tsx` — propagar `maxStamps`/`milestoneStamps`

**Files:**
- Modify: `apps/pwa-client/app/r/[storeId]/PassSwipe.tsx`

**Interfaces:**
- Consumes: `PassPreview` extendido (Task 9).
- Produces: `PassSwipeCard` gana `maxStamps: number` y `milestoneStamps: number[]`, usados por Task 13.

- [ ] **Step 1: Extender el tipo y propagar las props**

En `apps/pwa-client/app/r/[storeId]/PassSwipe.tsx`, reemplazar el tipo `PassSwipeCard` (líneas 6-19):

```tsx
export type PassSwipeCard = {
  key: string;
  badge: string;
  design: {
    backgroundColor?: string;
    foregroundColor?: string;
    labelColor?: string;
    title?: string;
    subtitle?: string | null;
    description?: string | null;
    logoUrl?: string | null;
  };
  points: number;
  maxStamps: number;
  milestoneStamps: number[];
};
```

Reemplazar las dos llamadas a `<PassPreview ... points={only.points} .../>` y `points={card.points}` para que también pasen `maxStamps` y `milestoneStamps` (líneas 62-67 y 78-83):

```tsx
        <PassPreview
          compact={compact}
          {...only.design}
          points={only.points}
          maxStamps={only.maxStamps}
          milestoneStamps={only.milestoneStamps}
          memberName={memberName}
        />
```

```tsx
            <PassPreview
              compact={compact}
              {...card.design}
              points={card.points}
              maxStamps={card.maxStamps}
              milestoneStamps={card.milestoneStamps}
              memberName={memberName}
            />
```

- [ ] **Step 2: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/pwa-client/app/r/[storeId]/PassSwipe.tsx
git commit -m "Propagate maxStamps and milestones through PassSwipe"
```

### Task 15: "Mis tarjetas" — nueva página de inicio

**Files:**
- Modify: `apps/pwa-client/app/page.tsx`
- Create: `apps/pwa-client/app/MisTarjetasClient.tsx`

**Interfaces:**
- Consumes: `loadSession`/`clearSession` (Task 8), `GET /passes?userId=`, `POST /customer-auth/logout`.
- Produces: reemplaza el `redirect('/r/demo')` (spec sección 3, paso 13).

- [ ] **Step 1: Escribir el componente cliente**

```tsx
// apps/pwa-client/app/MisTarjetasClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '@/lib/session';

export function MisTarjetasClient() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = loadSession();
    setSession(existing);
    if (!existing) {
      setLoading(false);
      return;
    }
    api<any[]>(`/passes?userId=${existing.user.id}`)
      .then(setPasses)
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    if (!session) return;
    try {
      await api('/customer-auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } finally {
      clearSession();
      setSession(null);
      setPasses([]);
    }
  }

  if (loading) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3 px-6 text-center">
        <p className="onda-pwa-title">Mis tarjetas</p>
        <p className="text-sm text-[var(--onda-muted)]">
          Aún no tienes tarjetas. Escanea el QR de un negocio para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">Mis tarjetas</h1>
        </div>
      </header>
      <div className="onda-pwa-body onda-pwa-fade">
        <div className="flex flex-1 flex-col gap-4 pb-6">
          {passes.map((p) => (
            <Link key={p.id} href={`/r/${p.storeId}`} className="block">
              <PassPreview
                compact
                {...(p.store?.passDesign || {})}
                points={p.points}
                maxStamps={p.store?.maxStamps ?? 12}
                memberName={session.user.name}
              />
            </Link>
          ))}
          {!passes.length ? (
            <p className="text-center text-sm text-[var(--onda-muted)]">
              Aún no tienes tarjetas. Escanea el QR de un negocio para empezar.
            </p>
          ) : null}
          <button type="button" className="onda-pwa-secondary" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `app/page.tsx`**

```tsx
// apps/pwa-client/app/page.tsx
import { MisTarjetasClient } from './MisTarjetasClient';

export default function Home() {
  return <MisTarjetasClient />;
}
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/pwa-client/app/page.tsx apps/pwa-client/app/MisTarjetasClient.tsx
git commit -m "Add aggregated Mis tarjetas home view for pwa-client"
```

### Task 16: estilos nuevos en `globals.css`

**Files:**
- Modify: `apps/pwa-client/app/globals.css`

**Interfaces:** ninguna (solo CSS); usa las clases `onda-pwa-secondary` referenciadas en Tasks 10, 11, 13, 15.

- [ ] **Step 1: Verificar si `onda-pwa-secondary` ya existe**

Run: `grep -n "onda-pwa-secondary\|onda-pwa-field\|onda-pwa-cta" apps/pwa-client/app/globals.css`
Expected: si ya existen (el archivo original `StoreEntryClient.tsx` ya usaba `onda-pwa-secondary` en el botón "Ver recompensas"), no se necesita agregar nada nuevo — este task se cierra sin cambios de código, solo confirmando que las clases reutilizadas en Tasks 10/11/13/15 ya están cubiertas por el CSS existente.

- [ ] **Step 2: Si falta alguna clase, agregarla siguiendo el patrón existente**

Si el grep del Step 1 no encuentra `onda-pwa-secondary`, agregar al final de `apps/pwa-client/app/globals.css`:

```css
.onda-pwa-secondary {
  @apply mt-2 w-full rounded-full border border-[var(--onda-border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--onda-ink)] transition hover:bg-[var(--onda-violet-soft)] disabled:opacity-50;
}
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin errores (cambio de CSS puro, no afecta TypeScript).

- [ ] **Step 4: Commit (solo si el Step 2 aplicó cambios)**

```bash
git add apps/pwa-client/app/globals.css
git commit -m "Add missing onda-pwa-secondary style if absent"
```

---

## Fase 6 — merchant-dashboard: notificaciones SSE y configuración del ciclo

### Task 17: `PendingRequestsPanel.tsx` — cola de notificaciones SSE

**Files:**
- Create: `apps/merchant-dashboard/app/PendingRequestsPanel.tsx`

**Interfaces:**
- Consumes: `api`, `getApiUrl` (`@onda/shared-ui`), `GET /pending-requests/pending?storeId=`, `GET /pending-requests/stream?storeId=` (EventSource), `POST /pending-requests/:id/confirm`, `POST /pending-requests/:id/reject`.
- Produces: `<PendingRequestsPanel storeId={string} />`, usado por Task 18.

- [ ] **Step 1: Escribir el componente**

```tsx
// apps/merchant-dashboard/app/PendingRequestsPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { api, getApiUrl } from '@onda/shared-ui';

type PendingItem = {
  id: string;
  type: 'ACCUMULATE' | 'CLAIM';
  code: string;
  pass?: { user?: { name?: string } };
  promotion?: { title?: string } | null;
  createdAt: string;
};

type SsePayload = {
  id: string;
  type: 'ACCUMULATE' | 'CLAIM';
  code: string;
  customerName?: string;
  promotionTitle?: string;
  createdAt: string;
};

export function PendingRequestsPanel({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;

    api<PendingItem[]>(`/pending-requests/pending?storeId=${storeId}`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        /* la conexión SSE de abajo seguirá empujando novedades */
      });

    const source = new EventSource(
      `${getApiUrl()}/api/pending-requests/stream?storeId=${storeId}`
    );
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as SsePayload;
      setItems((prev) => [
        ...prev,
        {
          id: payload.id,
          type: payload.type,
          code: payload.code,
          pass: { user: { name: payload.customerName } },
          promotion: payload.promotionTitle ? { title: payload.promotionTitle } : null,
          createdAt: payload.createdAt,
        },
      ]);
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [storeId]);

  async function resolve(id: string, action: 'confirm' | 'reject') {
    setBusyId(id);
    try {
      await api(`/pending-requests/${id}/${action}`, { method: 'POST' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="onda-card space-y-2 border-l-4 border-[var(--onda-violet)] p-4 shadow-lg">
          <p className="text-sm font-semibold">
            {item.type === 'ACCUMULATE' ? 'Acumular onda' : `Reclamar: ${item.promotion?.title || 'premio'}`}
          </p>
          <p className="text-xs text-[var(--onda-muted)]">{item.pass?.user?.name || 'Cliente'}</p>
          <p className="text-center font-display text-2xl font-bold tracking-[0.3em]">{item.code}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full bg-[var(--onda-success)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={busyId === item.id}
              onClick={() => resolve(item.id, 'confirm')}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="flex-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              disabled={busyId === item.id}
              onClick={() => resolve(item.id, 'reject')}
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que `getApiUrl` está exportado desde `@onda/shared-ui`**

Run: `grep -n "getApiUrl" libs/shared/ui/src/api.ts libs/shared/ui/src/index.tsx`
Expected: `getApiUrl` está definido en `libs/shared/ui/src/api.ts:4` pero **no** se re-exporta desde `index.tsx` (solo se exporta `api` y `API_URL`, línea 8: `export { api, API_URL } from './api';`). Si el grep confirma esto, agregar `getApiUrl` al export:

En `libs/shared/ui/src/index.tsx`, cambiar:

```tsx
export { api, API_URL } from './api';
```

por:

```tsx
export { api, API_URL, getApiUrl } from './api';
```

- [ ] **Step 3: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/merchant-dashboard/tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/merchant-dashboard/app/PendingRequestsPanel.tsx libs/shared/ui/src/index.tsx
git commit -m "Add SSE pending-requests notification panel for merchant-dashboard"
```

### Task 18: integrar el panel, ocultar el flujo de PIN, configurar el ciclo de sellos

**Files:**
- Modify: `apps/merchant-dashboard/app/MerchantWorkspace.tsx`

**Interfaces:**
- Consumes: `PendingRequestsPanel` (Task 17), `PassPreview` extendido (Task 9).

- [ ] **Step 1: Importar y montar el panel**

En `apps/merchant-dashboard/app/MerchantWorkspace.tsx`, agregar el import junto a los otros componentes locales (después de la línea `import { ActivityHeatmap } from "./ActivityHeatmap";`):

```tsx
import { PendingRequestsPanel } from "./PendingRequestsPanel";
```

Montar el panel dentro del `return` principal, justo antes de `{dialogs}` (línea 2432 actual: `{dialogs}` dentro del fragmento que cierra con `</>`):

```tsx
      </AppShell>
      <PendingRequestsPanel storeId={storeId} />
      {dialogs}
    </>
  );
```

- [ ] **Step 2: Ocultar la tarjeta de "Pin caja"**

En el bloque de `tab === "resumen"` (grid completo en líneas 1582-1634 actuales), eliminar la tarjeta `<div className="onda-card space-y-3 p-5">...Agregar ondas a un cliente (Pin caja)...</div>` (líneas 1583-1603) y dejar el historial de movimientos como único hijo del grid, ajustando el grid a una sola columna:

```tsx
            <div className="grid gap-6 lg:grid-cols-1">
              <div className="onda-card p-5">
                <h3 className="font-display font-semibold">
                  Historial de movimientos
                </h3>
                <ul className="onda-tx-list mt-3 max-h-80 overflow-auto">
                  {txs.map((t: any) => (
                    <TxActivityRow
                      key={t.id}
                      item={{
                        id: t.id,
                        type: t.type,
                        points: t.points,
                        person: t.pass?.user?.name,
                        promotion: t.promotion
                          ? {
                              title: t.promotion.title,
                              type: t.promotion.type,
                            }
                          : null,
                        time: new Date(t.createdAt).toLocaleString("es-CO"),
                      }}
                    />
                  ))}
                  {!txs.length ? (
                    <li className="py-4 text-center text-sm text-[var(--onda-muted)]">
                      Sin movimientos con estos filtros.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
```

El estado `pin`/`passId`/`accumulate()` (líneas 447-448, 801-820) queda sin usar en el UI — no se borra del componente en este task para no arrastrar un refactor no pedido; solo se retira su único punto de uso visual. (El backend detrás, `POST /transactions/accumulate`, tampoco se toca — spec sección 8.)

- [ ] **Step 3: Agregar el campo "Número de sellos del ciclo" en Configuración**

En el bloque `tab === "config"` (línea 2321-2423 actuales), dentro del `<form onSubmit={saveDesign} ...>`, agregar el campo antes del bloque `<div className="flex justify-end pt-1">` (después del `<label><span>Descripción</span>...</label>` en la línea 2403):

```tsx
                      <label>
                        <span>Número de sellos del ciclo</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          required
                          value={store?.maxStamps ?? 12}
                          onChange={(e) => {
                            const maxStamps = Number(e.target.value);
                            setStores((prev) =>
                              prev.map((s) => (s.id === storeId ? { ...s, maxStamps } : s))
                            );
                          }}
                        />
                      </label>
```

Modificar `saveDesign` (líneas 822-838 actuales) para que también guarde `maxStamps` en la tienda:

```tsx
  async function saveDesign(e: FormEvent) {
    e.preventDefault();
    const payload = {
      ...design,
      ...derivePassPalette(design.backgroundColor || "#6E5AE6"),
    };
    const saved = await api(`/pass-designs/store/${storeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setDesign(saved);
    if (store?.maxStamps != null) {
      const updatedStore = await api(`/stores/${storeId}`, {
        method: "PATCH",
        body: JSON.stringify({ maxStamps: store.maxStamps }),
      });
      setStores((prev) => prev.map((s) => (s.id === storeId ? updatedStore : s)));
    }
    await alert({
      title: "Diseño guardado",
      message: "La vista previa del pase quedó actualizada.",
      tone: "success",
    });
  }
```

- [ ] **Step 4: Actualizar el preview de Configuración para usar la grilla de sellos**

Reemplazar el `<PassPreview {...design} points={12} memberName="Cliente demo" />` (línea 2416-2420 actuales) por:

```tsx
                    <PassPreview
                      {...design}
                      points={Math.min(3, store?.maxStamps ?? 12)}
                      maxStamps={store?.maxStamps ?? 12}
                      milestoneStamps={promos
                        .filter((p: any) => p.isActive)
                        .map((p: any) => p.pointsRequired)}
                      memberName="Cliente demo"
                    />
```

- [ ] **Step 5: Clamp del campo "Ondas requeridas" en el formulario de promociones**

En el bloque de `createPromo` form (línea 1990-2006 actuales), agregar `max` al input:

```tsx
                      <input
                        type="number"
                        min={1}
                        max={store?.maxStamps ?? 12}
                        required
                        className="ml-2 w-24 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={promoForm.pointsRequired}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            pointsRequired: e.target.value,
                          }))
                        }
                      />
```

y agregar un texto de ayuda justo después del `</label>` que envuelve ese input:

```tsx
                    <span className="text-xs text-[var(--onda-muted)]">
                      de {store?.maxStamps ?? 12} sellos del ciclo
                    </span>
```

- [ ] **Step 6: Verificar compilación**

Run: `pnpm exec tsc --noEmit -p apps/merchant-dashboard/tsconfig.json`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/merchant-dashboard/app/MerchantWorkspace.tsx
git commit -m "Wire pending-requests panel, stamp-cycle config, and hide PIN card in merchant-dashboard"
```

---

## Cierre

Después del Task 18, correr una verificación final de todas las apps tocadas:

```bash
pnpm exec tsc --noEmit -p apps/api/tsconfig.json
pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json
pnpm exec tsc --noEmit -p apps/merchant-dashboard/tsconfig.json
```

Expected: sin errores en las tres. Mostrar el resumen de commits (`git log --oneline` desde el commit del spec) como evidencia de los cambios realizados, sin ejecutar Playwright ni ninguna prueba E2E, por restricción explícita.
