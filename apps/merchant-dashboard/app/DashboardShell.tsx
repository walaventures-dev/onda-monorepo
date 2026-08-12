"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { MerchantWorkspace } from "./MerchantWorkspace";
import { MerchantOnboarding } from "./MerchantOnboarding";
import { ToastProvider } from "@onda/shared-ui";

/** Keeps the workspace mounted across route changes so filters/state survive. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  return (
    <>
      {isOnboarding ? (
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
