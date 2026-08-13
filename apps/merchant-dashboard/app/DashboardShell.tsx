"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ToastProvider } from "@onda/shared-ui";
import { MerchantWorkspace } from "./MerchantWorkspace";
import { MerchantOnboarding } from "./MerchantOnboarding";
import { MerchantLogin } from "./MerchantLogin";
import { MerchantAuthProvider, useMerchantAuth } from "../lib/MerchantAuth";

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
  const isOnboarding =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const { ready, firebaseEnabled, user } = useMerchantAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--onda-muted)]">
        Cargando…
      </div>
    );
  }

  const showLogin = firebaseEnabled && !user && !isOnboarding;

  return (
    <>
      {showLogin ? (
        <MerchantLogin />
      ) : isOnboarding ? (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center text-sm text-[var(--onda-muted)]">
              Cargando…
            </div>
          }
        >
          <MerchantOnboarding />
        </Suspense>
      ) : (
        <MerchantWorkspace />
      )}
      <ToastProvider placement="bottom" />
      <div hidden aria-hidden>
        {children}
      </div>
    </>
  );
}
