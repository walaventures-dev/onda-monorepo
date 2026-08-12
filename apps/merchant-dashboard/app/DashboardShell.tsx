"use client";

import { MerchantWorkspace } from "./MerchantWorkspace";
import { ToastProvider } from "@onda/shared-ui";

/** Keeps the workspace mounted across route changes so filters/state survive. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  return (
    <>
      <MerchantWorkspace />
      <ToastProvider placement="bottom" />
      <div hidden aria-hidden>
        {children}
      </div>
    </>
  );
}
