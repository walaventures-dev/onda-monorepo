"use client";

import { MerchantWorkspace } from "./MerchantWorkspace";

/** Keeps the workspace mounted across route changes so filters/state survive. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MerchantWorkspace />
      <div hidden aria-hidden>
        {children}
      </div>
    </>
  );
}
