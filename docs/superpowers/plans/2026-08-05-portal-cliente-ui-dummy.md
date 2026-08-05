# Portal del Cliente (UI con datos dummy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir las pantallas del portal del cliente (tarjeta Onda universal, tarjetas por restaurante, catálogo de recompensas) en `pwa-client`, usando datos dummy con la misma forma que tendrá la futura API real, sin conectar backend todavía.

**Architecture:** Nueva ruta `/portal` (perfil) y `/portal/recompensas` (catálogo) en `apps/pwa-client`, siguiendo el patrón existente `page.tsx` (server, con `Suspense`) + `XxxClient.tsx` (`'use client'`). Un módulo `app/portal/lib/mockData.ts` expone funciones async (`getOndaCard`, `getRestaurantCards`, `getRewardsCatalog`) con las mismas firmas que tendrían las futuras llamadas reales a la API — así, cuando el backend exista, solo se reemplaza el contenido de ese archivo por llamadas a `api<T>()` de `@onda/shared-ui`, sin tocar los componentes. Los tipos nuevos (`OndaCardDto`, `RestaurantCardDto`) se agregan a `@onda/shared-types` junto a los DTOs existentes para que ese swap sea directo.

**Tech Stack:** Next.js App Router, React, Tailwind 4 + variables CSS `--onda-*`, componentes de `@onda/shared-ui` (Hero UI v3 + `PassPreview`), tipos de `@onda/shared-types`.

## Global Constraints

- Restricción estricta del usuario: **no usar Playwright ni ejecutar pruebas E2E** en ningún paso de este plan.
- La verificación de cada tarea es: el código compila (`tsc --noEmit` / `nx build`) y se muestra el diff de los cambios — no se requiere levantar el dev server ni probar manualmente en navegador para considerar una tarea completa.
- Esta pasada es **solo UI con datos dummy/mock**, sin conexión a backend real. No se implementa OTP, no se llama a ningún endpoint nuevo.
- **Alcance acotado**: solo el portal del cliente en `pwa-client` (perfil + tarjetas por restaurante + catálogo de recompensas). La pantalla de configuración de `earnMode` en `merchant-dashboard` y la conexión real al backend quedan fuera de este plan — serán planes separados posteriores, según lo definido en `docs/superpowers/specs/2026-08-05-onda-suscripcion-design.md`.

---

## Contexto de convenciones existentes (para quien ejecute este plan)

- Patrón de ruta: `apps/pwa-client/app/r/[storeId]/page.tsx` es un server component que envuelve `StoreEntryClient.tsx` (`'use client'`) en `<Suspense>`. Replica ese patrón para las rutas nuevas.
- Componentes compartidos vienen de `@onda/shared-ui` (alias a `libs/shared/ui/src/index.tsx`): incluye `PassPreview` (la tarjeta visual tipo wallet, con props `backgroundColor`, `foregroundColor`, `labelColor`, `title`, `subtitle`, `description`, `logoUrl`, `points`, `memberName`, `compact`) y la utilidad `api<T>()`.
- Los colores de marca están en variables CSS (`libs/shared/ui/src/styles.css`, importadas en `apps/pwa-client/app/globals.css`): `--onda-sky: #3db9e8`, `--onda-violet: #6e5ae6`, `--onda-violet-soft: #eeeaff`, `--onda-muted: #6b7289`, `--onda-ink: #1a1b2e`. Se usan como `var(--onda-violet)` o clases Tailwind arbitrarias `text-[var(--onda-violet)]`.
- Clases utilitarias ya definidas y reutilizables: `.onda-pwa-shell`, `.onda-pwa-hero`, `.onda-pwa-hero-copy`, `.onda-pwa-eyebrow`, `.onda-pwa-title`, `.onda-pwa-sub`, `.onda-pwa-body`, `.onda-pwa-fade`, `.onda-pwa-cta`, `.onda-pwa-secondary` (en `apps/pwa-client/app/globals.css`), y `.onda-card` (en `libs/shared/ui/src/styles.css`, usada por `KpiCard`).
- Tipos compartidos viven en `libs/shared/types/src/index.ts` (paquete `@onda/shared-types`), como una lista plana de `interface`s exportadas — sin subcarpetas.
- La sesión del cliente se guarda hoy en `localStorage` bajo la clave `'onda_pwa_session'`, con la forma de `EnrollResponse` (`{ user, pass, token }`), pero solo existe una copia de esa lógica dentro de `StoreEntryClient.tsx` — no hay helper compartido todavía.
- Comando de typecheck rápido: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json` (confirmado que corre limpio hoy, sin errores, antes de este plan). Comando de build de producción: `pnpm exec nx build pwa-client`.

---

### Task 1: Tipos compartidos para la tarjeta Onda y las tarjetas por restaurante

**Files:**
- Modify: `libs/shared/types/src/index.ts`

**Interfaces:**
- Produces: `OndaCardDto { id, userId, serialNumber, memberName, totalPoints }`, `RestaurantCardDto { storeId, storeName, points, design, rewards }` — usados por todas las tareas siguientes.
- Reutiliza (sin modificar): `PassDesignDto` y `PromotionDto`, ya existentes en este mismo archivo.

- [ ] **Step 1: Agregar las dos interfaces nuevas**

Abre `libs/shared/types/src/index.ts` y agrega esto inmediatamente después de la definición de `PassDto` (después de la línea 90, antes de `export interface TransactionDto`):

```ts
export interface OndaCardDto {
  id: string;
  userId: string;
  serialNumber: string;
  memberName: string;
  totalPoints: number;
}

export interface RestaurantCardDto {
  storeId: string;
  storeName: string;
  points: number;
  design: PassDesignDto | null;
  rewards: PromotionDto[];
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores), igual que el baseline.

- [ ] **Step 3: Mostrar el diff y commitear**

```bash
git diff libs/shared/types/src/index.ts
git add libs/shared/types/src/index.ts
git commit -m "Agregar tipos OndaCardDto y RestaurantCardDto para el portal del cliente"
```

---

### Task 2: Helper de sesión (lectura)

**Files:**
- Create: `apps/pwa-client/app/lib/session.ts`

**Interfaces:**
- Consumes: `EnrollResponse` de `@onda/shared-types` (ya existente: `{ user: UserDto; pass: PassDto; token: string }`).
- Produces: `getSession(): EnrollResponse | null` — usada por Task 6 (`PortalClient.tsx`).

- [ ] **Step 1: Crear el helper**

Crea `apps/pwa-client/app/lib/session.ts`:

```ts
import type { EnrollResponse } from '@onda/shared-types';

const SESSION_KEY = 'onda_pwa_session';

export function getSession(): EnrollResponse | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EnrollResponse;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 3: Mostrar el diff y commitear**

```bash
git status --short apps/pwa-client/app/lib/
git add apps/pwa-client/app/lib/session.ts
git commit -m "Agregar helper de lectura de sesion para el portal del cliente"
```

---

### Task 3: Módulo de datos dummy

**Files:**
- Create: `apps/pwa-client/app/portal/lib/mockData.ts`

**Interfaces:**
- Consumes: `OndaCardDto`, `RestaurantCardDto`, `PromotionDto` de `@onda/shared-types` (Task 1).
- Produces: `getOndaCard(memberName: string): Promise<OndaCardDto>`, `getRestaurantCards(): Promise<RestaurantCardDto[]>`, `getRewardsCatalog(): Promise<CatalogReward[]>`, y el tipo `CatalogReward = PromotionDto & { storeName: string }`. Usados por Task 6 y Task 7.

- [ ] **Step 1: Crear el módulo con datos mock**

Crea `apps/pwa-client/app/portal/lib/mockData.ts`:

```ts
import type { OndaCardDto, RestaurantCardDto, PromotionDto } from '@onda/shared-types';

export type CatalogReward = PromotionDto & { storeName: string };

const MOCK_RESTAURANT_CARDS: RestaurantCardDto[] = [
  {
    storeId: 'store-aa',
    storeName: 'Restaurante AA',
    points: 1,
    design: {
      id: 'design-aa',
      storeId: 'store-aa',
      eventId: null,
      backgroundColor: '#3DB9E8',
      foregroundColor: '#FFFFFF',
      labelColor: '#E5F6FC',
      logoUrl: null,
      stripImageUrl: null,
      title: 'Restaurante AA',
      subtitle: 'Onda Rewards',
      description: null,
    },
    rewards: [
      {
        id: 'promo-aa-1',
        storeId: 'store-aa',
        eventId: null,
        title: 'Café gratis',
        description: 'Canjea 5 ondas por un café',
        imageUrl: null,
        pointsRequired: 5,
        isActive: true,
      },
    ],
  },
  {
    storeId: 'store-bb',
    storeName: 'Restaurante BB',
    points: 1,
    design: {
      id: 'design-bb',
      storeId: 'store-bb',
      eventId: null,
      backgroundColor: '#6E5AE6',
      foregroundColor: '#FFFFFF',
      labelColor: '#EEEAFF',
      logoUrl: null,
      stripImageUrl: null,
      title: 'Restaurante BB',
      subtitle: 'Onda Rewards',
      description: null,
    },
    rewards: [
      {
        id: 'promo-bb-1',
        storeId: 'store-bb',
        eventId: null,
        title: 'Postre gratis',
        description: 'Canjea 8 ondas por un postre',
        imageUrl: null,
        pointsRequired: 8,
        isActive: true,
      },
    ],
  },
];

export async function getOndaCard(memberName: string): Promise<OndaCardDto> {
  const totalPoints = MOCK_RESTAURANT_CARDS.reduce((sum, c) => sum + c.points, 0);
  return {
    id: 'mock-onda-card-1',
    userId: 'mock-user-1',
    serialNumber: 'ONDA-DEMO0001',
    memberName,
    totalPoints,
  };
}

export async function getRestaurantCards(): Promise<RestaurantCardDto[]> {
  return MOCK_RESTAURANT_CARDS;
}

export async function getRewardsCatalog(): Promise<CatalogReward[]> {
  return MOCK_RESTAURANT_CARDS.flatMap((c) =>
    c.rewards.map((r) => ({ ...r, storeName: c.storeName }))
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 3: Mostrar el diff y commitear**

```bash
git status --short apps/pwa-client/app/portal/
git add apps/pwa-client/app/portal/lib/mockData.ts
git commit -m "Agregar datos dummy del portal (tarjeta Onda, restaurantes, catalogo)"
```

---

### Task 4: Componente `OndaCardView`

**Files:**
- Create: `apps/pwa-client/app/portal/OndaCardView.tsx`

**Interfaces:**
- Consumes: `OndaCardDto` de `@onda/shared-types` (Task 1); `PassPreview` de `@onda/shared-ui` (ya existente).
- Produces: `OndaCardView({ card: OndaCardDto })` — componente usado por Task 6.

- [ ] **Step 1: Crear el componente**

Crea `apps/pwa-client/app/portal/OndaCardView.tsx`:

```tsx
import { PassPreview } from '@onda/shared-ui';
import type { OndaCardDto } from '@onda/shared-types';

export function OndaCardView({ card }: { card: OndaCardDto }) {
  return (
    <PassPreview
      backgroundColor="#6E5AE6"
      foregroundColor="#FFFFFF"
      labelColor="#E5F6FC"
      title="Tarjeta Onda"
      subtitle="Tu identidad en todos los restaurantes"
      description="Acumula ondas en cualquier restaurante Onda"
      points={card.totalPoints}
      memberName={card.memberName}
    />
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 3: Mostrar el diff y commitear**

```bash
git add apps/pwa-client/app/portal/OndaCardView.tsx
git commit -m "Agregar componente OndaCardView (tarjeta Onda universal)"
```

---

### Task 5: Componente `RestaurantCardList`

**Files:**
- Create: `apps/pwa-client/app/portal/RestaurantCardList.tsx`

**Interfaces:**
- Consumes: `RestaurantCardDto` de `@onda/shared-types` (Task 1).
- Produces: `RestaurantCardList({ cards: RestaurantCardDto[] })` — componente usado por Task 6.

- [ ] **Step 1: Crear el componente**

Crea `apps/pwa-client/app/portal/RestaurantCardList.tsx`:

```tsx
import type { RestaurantCardDto } from '@onda/shared-types';

export function RestaurantCardList({ cards }: { cards: RestaurantCardDto[] }) {
  if (!cards.length) {
    return (
      <p className="text-[var(--onda-muted)]">
        Aún no tienes ondas en ningún restaurante.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <div
          key={c.storeId}
          className="onda-card flex items-center justify-between gap-3 px-4 py-3.5"
          style={{ borderLeft: `4px solid ${c.design?.backgroundColor || 'var(--onda-violet)'}` }}
        >
          <div className="min-w-0">
            <p className="font-semibold text-[var(--onda-ink)]">{c.storeName}</p>
            <p className="text-xs text-[var(--onda-muted)]">
              {c.rewards.length} recompensa{c.rewards.length === 1 ? '' : 's'} disponible
              {c.rewards.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-[var(--onda-ink)]">{c.points}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--onda-muted)]">ondas</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 3: Mostrar el diff y commitear**

```bash
git add apps/pwa-client/app/portal/RestaurantCardList.tsx
git commit -m "Agregar componente RestaurantCardList (tarjetas por restaurante)"
```

---

### Task 6: Página del portal (`/portal`)

**Files:**
- Create: `apps/pwa-client/app/portal/page.tsx`
- Create: `apps/pwa-client/app/portal/PortalClient.tsx`

**Interfaces:**
- Consumes: `getSession` (Task 2); `getOndaCard`, `getRestaurantCards` (Task 3); `OndaCardView` (Task 4); `RestaurantCardList` (Task 5); `OndaCardDto`, `RestaurantCardDto` (Task 1).
- Produces: ruta `/portal` navegable; enlace a `/portal/recompensas` (consumido por Task 7).

- [ ] **Step 1: Crear el componente cliente `PortalClient.tsx`**

Crea `apps/pwa-client/app/portal/PortalClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession } from '../lib/session';
import { getOndaCard, getRestaurantCards } from './lib/mockData';
import { OndaCardView } from './OndaCardView';
import { RestaurantCardList } from './RestaurantCardList';
import type { OndaCardDto, RestaurantCardDto } from '@onda/shared-types';

export default function PortalClient() {
  const [loading, setLoading] = useState(true);
  const [ondaCard, setOndaCard] = useState<OndaCardDto | null>(null);
  const [restaurantCards, setRestaurantCards] = useState<RestaurantCardDto[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = getSession();
      const memberName = session?.user?.name || 'Cliente Onda';
      const [card, cards] = await Promise.all([
        getOndaCard(memberName),
        getRestaurantCards(),
      ]);
      if (cancelled) return;
      setOndaCard(card);
      setRestaurantCards(cards);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !ondaCard) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
        <p className="text-sm text-[var(--onda-muted)]">Cargando tu tarjeta…</p>
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">Mi tarjeta Onda</h1>
          <p className="onda-pwa-sub">{ondaCard.totalPoints} ondas acumuladas en total</p>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade flex flex-col gap-5">
        <OndaCardView card={ondaCard} />

        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--onda-ink)]">Mis restaurantes</h2>
          <RestaurantCardList cards={restaurantCards} />
        </div>

        <Link href="/portal/recompensas" className="onda-pwa-secondary block text-center">
          Explorar recompensas
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear la página server `page.tsx`**

Crea `apps/pwa-client/app/portal/page.tsx`:

```tsx
import { Suspense } from 'react';
import PortalClient from './PortalClient';

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="onda-pwa-shell items-center justify-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-2xl onda-gradient" />
          <p className="text-sm text-[var(--onda-muted)]">Cargando tu tarjeta…</p>
        </div>
      }
    >
      <PortalClient />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 4: Mostrar el diff y commitear**

```bash
git add apps/pwa-client/app/portal/page.tsx apps/pwa-client/app/portal/PortalClient.tsx
git commit -m "Agregar pagina /portal con tarjeta Onda y tarjetas por restaurante"
```

---

### Task 7: Página de catálogo de recompensas (`/portal/recompensas`)

**Files:**
- Create: `apps/pwa-client/app/portal/recompensas/page.tsx`
- Create: `apps/pwa-client/app/portal/recompensas/RecompensasClient.tsx`

**Interfaces:**
- Consumes: `getRewardsCatalog`, `CatalogReward` de `../lib/mockData` (Task 3).
- Produces: ruta `/portal/recompensas` navegable (ya enlazada desde Task 6).

- [ ] **Step 1: Crear el componente cliente**

Crea `apps/pwa-client/app/portal/recompensas/RecompensasClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRewardsCatalog, type CatalogReward } from '../lib/mockData';

export default function RecompensasClient() {
  const [rewards, setRewards] = useState<CatalogReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getRewardsCatalog().then((data) => {
      if (cancelled) return;
      setRewards(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">Recompensas</h1>
          <p className="onda-pwa-sub">Disponibles en los restaurantes Onda</p>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade flex flex-col gap-3">
        <Link
          href="/portal"
          className="self-start text-sm font-medium text-[var(--onda-violet)]"
        >
          ← Volver a mi tarjeta
        </Link>

        {loading ? (
          <p className="text-sm text-[var(--onda-muted)]">Cargando recompensas…</p>
        ) : (
          <div className="flex flex-col gap-3 pb-6">
            {rewards.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="p-4">
                  <p className="text-xs font-medium text-[var(--onda-violet)]">{r.storeName}</p>
                  <p className="mt-0.5 font-semibold">{r.title}</p>
                  {r.description ? (
                    <p className="mt-1 text-sm text-[var(--onda-muted)]">{r.description}</p>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold text-[var(--onda-violet)]">
                    {r.pointsRequired} ondas
                  </p>
                </div>
              </div>
            ))}
            {!rewards.length ? (
              <p className="text-[var(--onda-muted)]">Pronto habrá recompensas aquí.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear la página server**

Crea `apps/pwa-client/app/portal/recompensas/page.tsx`:

```tsx
import { Suspense } from 'react';
import RecompensasClient from './RecompensasClient';

export default function RecompensasPage() {
  return (
    <Suspense fallback={null}>
      <RecompensasClient />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 4: Mostrar el diff y commitear**

```bash
git add apps/pwa-client/app/portal/recompensas/
git commit -m "Agregar pagina /portal/recompensas con catalogo de recompensas"
```

---

### Task 8: Enlazar el portal desde el flujo existente de escaneo de QR

**Files:**
- Modify: `apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx`

**Interfaces:**
- No produce ni consume tipos nuevos; solo agrega un enlace de navegación a la ruta `/portal` (Task 6).

- [ ] **Step 1: Importar `Link` de Next.js**

En `apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx`, agrega el import junto a los demás imports de Next (después de la línea 4, `import { useParams, useSearchParams } from 'next/navigation';`):

```tsx
import Link from 'next/link';
```

- [ ] **Step 2: Agregar el enlace en el paso `home`**

En el mismo archivo, dentro del bloque `{step === 'home' && session && ( ... )}`, justo después del botón "Ver recompensas" (líneas 351-357 del archivo actual):

```tsx
              <button
                type="button"
                className="onda-pwa-secondary"
                onClick={() => setStep('rewards')}
              >
                Ver recompensas
              </button>
```

agrega inmediatamente debajo:

```tsx
              <Link href="/portal" className="onda-pwa-secondary block text-center">
                Ver mi tarjeta Onda
              </Link>
```

- [ ] **Step 3: Verificar que compila**

Run: `pnpm exec tsc --noEmit -p apps/pwa-client/tsconfig.json`
Expected: sin salida (0 errores).

- [ ] **Step 4: Mostrar el diff y commitear**

```bash
git diff apps/pwa-client/app/r/\[storeId\]/StoreEntryClient.tsx
git add "apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx"
git commit -m "Enlazar el portal del cliente desde el flujo de escaneo de QR"
```

---

### Task 9: Verificación final de build de producción

**Files:** ninguno (solo verificación, no hay cambios de código en esta tarea).

**Interfaces:** N/A.

- [ ] **Step 1: Ejecutar el build completo de `pwa-client`**

Run: `pnpm exec nx build pwa-client`
Expected: build exitoso, sin errores de TypeScript ni de Next.js (incluye todas las rutas nuevas: `/portal` y `/portal/recompensas`).

- [ ] **Step 2: Mostrar el resumen de cambios de todo el plan**

```bash
git log --oneline -9
git diff main --stat
```

Expected: 8 commits nuevos (Tasks 1-8) listados, y el `--stat` mostrando únicamente los archivos de `libs/shared/types`, `apps/pwa-client/app/lib`, `apps/pwa-client/app/portal/**` y el archivo modificado `StoreEntryClient.tsx`.

No hay commit en este paso — es solo la verificación final de que todo el conjunto compila y construye correctamente en conjunto.
