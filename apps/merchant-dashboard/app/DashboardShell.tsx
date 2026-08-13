"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { ToastProvider, api } from "@onda/shared-ui";
import { MerchantWorkspace } from "./MerchantWorkspace";
import { MerchantOnboarding } from "./MerchantOnboarding";
import { MerchantLogin } from "./MerchantLogin";
import { MerchantAuthProvider, useMerchantAuth } from "../lib/MerchantAuth";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[var(--onda-muted)]">
      Cargando…
    </div>
  );
}

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isOnboardingPath(pathname: string) {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

/** Destino interno seguro para volver después del login. */
function safeReturnPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  const first = path.split("/").filter(Boolean)[0];
  if (!first || first === "login" || first === "onboarding") return null;
  return path;
}

/** Keeps the workspace mounted across route changes so filters/state survive. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <MerchantAuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </MerchantAuthProvider>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = isOnboardingPath(pathname);
  const isLogin = isLoginPath(pathname);
  const { ready, firebaseEnabled, user } = useMerchantAuth();

  useEffect(() => {
    if (!ready) return;

    if (firebaseEnabled && !user) {
      if (!isOnboarding && !isLogin) {
        const next = safeReturnPath(pathname);
        router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
      }
      return;
    }

    if (user && isLogin) {
      const raw = new URLSearchParams(window.location.search).get("next");
      let dest = safeReturnPath(raw) || "/resumen";
      let cancelled = false;
      void (async () => {
        try {
          const stores = await api<unknown[]>("/auth/merchant/stores");
          if (!Array.isArray(stores) || stores.length === 0) {
            dest = "/onboarding";
          }
        } catch {
          /* si falla el listado, entra al panel */
        }
        if (!cancelled) router.replace(dest);
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [ready, firebaseEnabled, user, isOnboarding, isLogin, pathname, router]);

  if (!ready) {
    return <LoadingScreen />;
  }

  let screen: ReactNode;
  if (firebaseEnabled && !user && !isOnboarding) {
    screen = isLogin ? <MerchantLogin /> : <LoadingScreen />;
  } else if (user && isLogin) {
    screen = <LoadingScreen />;
  } else if (isOnboarding) {
    screen = (
      <Suspense fallback={<LoadingScreen />}>
        <MerchantOnboarding />
      </Suspense>
    );
  } else {
    screen = <MerchantWorkspace />;
  }

  return (
    <>
      {screen}
      <ToastProvider placement="bottom" />
      <div hidden aria-hidden>
        {children}
      </div>
    </>
  );
}
