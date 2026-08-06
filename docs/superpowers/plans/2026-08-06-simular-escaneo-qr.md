# Simular escaneo QR (auto-redirect) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When "Mis tarjetas" has nothing to show (no session, or session with zero passes), auto-redirect to `/r/{storeId}` of the first store from `GET /stores`, landing directly on the post-QR-scan screen, instead of showing the "escanea el QR" dead-end message.

**Architecture:** All logic lives inline in the existing `MisTarjetasClient.tsx` client component — no new files, no backend changes. A single boot effect: load session → (if session) fetch passes → if nothing to show and not in production, fetch `GET /stores` and `router.replace` to the first store's `/r/[storeId]`. If that fails or there are no stores, fall back to the current empty-state message.

**Tech Stack:** Next.js App Router (`next/navigation` `useRouter`), existing `api()` helper from `@onda/shared-ui`.

## Global Constraints

- No Playwright, no E2E tests — this repo has no test runner configured (no jest/vitest/playwright config found for `pwa-client`). Verification is TypeScript compilation only (`tsc --noEmit` and/or `next build`), plus showing the diff.
- Redirect logic must be gated by `process.env.NODE_ENV !== 'production'` — in production the current message-only behavior must be unchanged.
- Use `router.replace`, not `router.push`, so "Mis tarjetas" doesn't sit in browser history as an intermediate screen the user never chose to view.
- If `GET /stores` returns an empty array or the request fails, fall back to the existing "Aún no tienes tarjetas..." message — never leave the screen stuck in a loading state.

---

### Task 1: Auto-redirect from empty "Mis tarjetas" to the first store's post-QR screen

**Files:**
- Modify: `apps/pwa-client/app/MisTarjetasClient.tsx` (full current contents below for reference)

Current file:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '../lib/session';

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

**Interfaces:**
- Consumes: `api<T>(path, options?)` from `@onda/shared-ui` (existing, `GET /stores` already public — returns array of `{ id: string; name: string; ... }`, see `apps/api/src/stores.controller.ts:22-42`). `loadSession`/`clearSession` from `../lib/session` (unchanged).
- Produces: nothing consumed by other tasks — this is the only task in the plan.

- [ ] **Step 1: Replace the file contents**

Write the full new contents of `apps/pwa-client/app/MisTarjetasClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '../lib/session';

const SIMULATE_QR_SCAN = process.env.NODE_ENV !== 'production';

async function simulateQrScan(router: ReturnType<typeof useRouter>): Promise<boolean> {
  try {
    const stores = await api<{ id: string }[]>('/stores');
    if (stores[0]) {
      router.replace(`/r/${stores[0].id}`);
      return true;
    }
  } catch {
    // No hay negocios disponibles o falló la red: se cae al mensaje vacío normal.
  }
  return false;
}

export function MisTarjetasClient() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const existing = loadSession();
      if (cancelled) return;
      setSession(existing);

      let userPasses: any[] = [];
      if (existing) {
        try {
          userPasses = await api<any[]>(`/passes?userId=${existing.user.id}`);
        } catch {
          userPasses = [];
        }
        if (cancelled) return;
        setPasses(userPasses);
      }

      if ((!existing || !userPasses.length) && SIMULATE_QR_SCAN) {
        const redirected = await simulateQrScan(router);
        if (redirected || cancelled) return;
      }

      if (!cancelled) setLoading(false);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

Key behavior changes from the current file:
- New `SIMULATE_QR_SCAN` constant (`true` outside production).
- New `simulateQrScan(router)` helper: fetches `GET /stores`, redirects to the first one via `router.replace`, returns whether it redirected.
- `boot()` inside the effect now: loads session → (if session) loads passes → if there's nothing to show (`!existing || !userPasses.length`) and `SIMULATE_QR_SCAN` is on, tries the redirect. Only flips `loading` to `false` (revealing either the empty message or the passes list) when there's actually something to render — i.e. the redirect wasn't attempted, or it failed.
- Everything else (JSX, `logout`, passes list rendering) is unchanged.

**Note for the person applying this diff:** since this is a full-file rewrite, use the Edit tool to replace only what changed if you're pairing it against the live file — the block above is written as a full replacement for clarity, not because every line differs.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors. (If `useRouter`'s type isn't inferred cleanly as a parameter type, confirm the import path is `next/navigation`, not `next/router` — the App Router hook, matching `apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx:5` which already imports `useParams` from `next/navigation` in this same app.)

- [ ] **Step 3: Build**

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 4: Show the diff**

Run: `git diff -- apps/pwa-client/app/MisTarjetasClient.tsx`
Paste the output back so the change can be reviewed before any commit — no Playwright, no manual browser E2E run as part of this task; compilation is the verification bar per the global constraint.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa-client/app/MisTarjetasClient.tsx
git commit -m "$(cat <<'EOF'
Auto-redirect empty Mis tarjetas to first store's post-QR screen

Prototype stage has no real QR scanning yet; simulate it by jumping
straight to /r/{storeId} of the first available store instead of
dead-ending on the "escanea el QR" message. Gated to non-production.
EOF
)"
```
