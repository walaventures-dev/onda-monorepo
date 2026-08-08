# Simular escaneo QR en pwa-client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline login/dead-end in `MisTarjetasClient.tsx` with an auto-redirect to `/r/{storeId}` (targeting "Café del Río", falling back to the first store) so the empty-state screen behaves like a simulated QR scan during local testing.

**Architecture:** `MisTarjetasClient.tsx` loses its own OTP/name steps entirely. On boot, if there's no session, or there is a session but the user has zero passes, it fetches `GET /stores`, picks the target store, and calls `router.replace('/r/{storeId}')`. That route (`StoreEntryClient.tsx`) is unmodified — it already handles session/OTP/name/existing-pass branching correctly. If the redirect can't happen (empty store list, network error), it falls back to the original "Aún no tienes tarjetas" message.

**Tech Stack:** Next.js App Router (`apps/pwa-client`), React client components, existing `api()` helper from `@onda/shared-ui`, `useRouter` from `next/navigation`.

## Global Constraints

- Simulation only runs when `process.env.NODE_ENV !== 'production'` (spec section 7).
- `StoreEntryClient.tsx` must NOT be modified — it already correctly implements all 4 real-world scenarios (spec section 5).
- No backend changes — `GET /stores` already exists, is public, and needs no query support; store selection is filtered client-side (spec section 2).
- Target store is selected by exact `name` equality against `"Café del Río"`; if not found, fall back to `stores[0]` (list is `createdAt desc`) (spec section 3).
- Use `router.replace`, not `router.push`, so "Mis tarjetas" doesn't stay in browser history (spec section 2, step 3).
- **No Playwright, no E2E tests.** Verification is `tsc` + `next build` plus showing the diff for manual review — per explicit user constraint (spec section 7).

---

### Task 1: Replace login/dead-end in MisTarjetasClient with simulated-QR redirect

**Files:**
- Modify: `apps/pwa-client/app/MisTarjetasClient.tsx` (full rewrite of the component body; imports, `Step` type, `boot()`, and JSX all change)

**Interfaces:**
- Consumes: `api<T>(path, init?)` from `@onda/shared-ui` (existing helper, already imported in this file); `loadSession()/clearSession()/type CustomerSession` from `../lib/session` (existing, already imported — note `saveSession` is dropped, see Step 1 notes); `useRouter` from `next/navigation` (new import for this file).
- Produces: nothing consumed by other tasks — this is the only task in the plan. `MisTarjetasClient` remains the named export consumed by `apps/pwa-client/app/page.tsx` (its one existing consumer; its call signature `<MisTarjetasClient />` does not change).

This is a UI-behavior change with no unit-testable pure function (the store-picking logic is a few lines inline in an async effect, and the project has no test runner for `pwa-client`, per spec section 7). Verification is via `tsc`/`next build` and manual diff review — no automated test steps are included in this task, matching the user's explicit no-E2E constraint.

- [ ] **Step 1: Rewrite `apps/pwa-client/app/MisTarjetasClient.tsx`**

Replace the entire file contents with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, PassPreview } from '@onda/shared-ui';
import { loadSession, clearSession, type CustomerSession } from '../lib/session';

type Step = 'loading' | 'cards';

const SIMULATE_QR_SCAN = process.env.NODE_ENV !== 'production';
const PREFERRED_STORE_NAME = 'Café del Río';

async function simulateQrScan(router: ReturnType<typeof useRouter>): Promise<boolean> {
  try {
    const stores = await api<{ id: string; name: string }[]>('/stores');
    const target = stores.find((s) => s.name === PREFERRED_STORE_NAME) || stores[0];
    if (target) {
      router.replace(`/r/${target.id}`);
      return true;
    }
  } catch {
    // sin negocios disponibles o falló la red: se cae al mensaje vacío normal
  }
  return false;
}

export function MisTarjetasClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [passes, setPasses] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const existing = loadSession();
      if (cancelled) return;

      if (!existing) {
        if (SIMULATE_QR_SCAN && (await simulateQrScan(router))) return;
        if (!cancelled) setStep('cards');
        return;
      }

      setSession(existing);
      let userPasses: any[] = [];
      try {
        userPasses = await api<any[]>(`/passes?userId=${existing.user.id}`);
      } catch {
        userPasses = [];
      }
      if (cancelled) return;

      if (userPasses.length === 0 && SIMULATE_QR_SCAN && (await simulateQrScan(router))) return;

      if (!cancelled) {
        setPasses(userPasses);
        setStep('cards');
      }
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
      if (SIMULATE_QR_SCAN) {
        await simulateQrScan(router);
      } else {
        setStep('cards');
      }
    }
  }

  if (step === 'loading') {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
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
                memberName={session?.user.name ?? ''}
              />
            </Link>
          ))}
          {!passes.length ? (
            <p className="text-center text-sm text-[var(--onda-muted)]">
              Aún no tienes tarjetas. Escanea el QR de un negocio para empezar.
            </p>
          ) : null}
          {session ? (
            <button type="button" className="onda-pwa-secondary" onClick={logout}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

Notes on what's removed and why, relative to the file as it exists today (which has an inline `OtpStep` + name-form login, per `apps/pwa-client/app/MisTarjetasClient.tsx:1-190` in the current working tree):

- `Step` drops `'otp'` and `'name'` — the inline login is gone entirely (spec section 3, first bullet). The `OtpStep` import (`./r/[storeId]/OtpStep`), the `onVerified`/`submitName` handlers, and the `error`/`busy`/`name` state are all deleted as dead code.
- `saveSession` import is dropped (it was only used inside the removed `onVerified`/`submitName`); `clearSession` is kept (used by `logout`).
- `logout()`: the current file sends the user back to `step: 'otp'` to show the inline login again. Since that step no longer exists, `logout()` must resolve somewhere else — it now re-runs `simulateQrScan` (same gate as `boot()`) so a logged-out user gets the same simulated-QR redirect a fresh visitor would get; outside the `NODE_ENV` gate it falls back to `step: 'cards'`, showing the empty-state message (matching the "no redirect in production" rule in spec section 7). This isn't called out explicitly in the spec's `boot()`-only description (section 3) but follows directly from removing the login step — without it the user would be stuck on a stale empty `'cards'` screen after logout with no way forward until a manual reload.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors. In particular, confirm no leftover references to `OtpStep`, `Step = 'otp' | 'name'`, or the removed `name`/`error`/`busy` state.

- [ ] **Step 3: Build**

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 4: Show the diff for manual review**

Run: `git diff -- apps/pwa-client/app/MisTarjetasClient.tsx`
Paste the output back so the change can be reviewed before committing. Per the user's explicit constraint, do not run Playwright or any E2E/browser walkthrough — this diff plus the passing build is the full verification for this task.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa-client/app/MisTarjetasClient.tsx
git commit -m "$(cat <<'EOF'
Redirect empty Mis tarjetas to simulated QR scan of Café del Río

Mis Tarjetas is an aggregator screen a real customer only reaches
after already having a card — it should never be an entry point.
Remove its inline login (OTP + name steps) and, when there's nothing
to show (no session, or a session with zero passes), auto-redirect to
/r/{storeId} of "Café del Río" (falling back to the first store),
simulating the QR scan that would bring a real user there. Gated to
non-production; StoreEntryClient.tsx is unchanged.
EOF
)"
```
