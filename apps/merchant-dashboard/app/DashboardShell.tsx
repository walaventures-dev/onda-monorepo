"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { ToastProvider, api, SkeletonScreen } from "@onda/shared-ui";
import { MerchantWorkspace } from "./MerchantWorkspace";
import { MerchantOnboarding } from "./MerchantOnboarding";
import { MerchantLogin } from "./MerchantLogin";
import { MerchantChangePassword } from "./MerchantChangePassword";
import { MerchantInviteAccept } from "./MerchantInviteAccept";
import { MerchantAuthProvider, useMerchantAuth } from "../lib/MerchantAuth";
import {
  isSetupAllowedPath,
  merchantHomePath,
  type StoreSetupFields,
} from "./setupStatus";

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isInvitePath(pathname: string) {
  return (
    pathname === '/login/invitacion' ||
    pathname.startsWith('/login/invitacion/')
  );
}

function isChangePasswordPath(pathname: string) {
  return (
    pathname === "/login/cambiar-contrasena" ||
    pathname.startsWith("/login/cambiar-contrasena/")
  );
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

function onboardingPathFromSearch(): string {
  const params = new URLSearchParams(window.location.search);
  params.delete("next");
  const qs = params.toString();
  return qs ? `/onboarding?${qs}` : "/onboarding";
}

function destForLoggedInMerchant(
  stores: StoreSetupFields[],
  next: string | null
): string {
  if (!stores.length) return onboardingPathFromSearch();
  const home = merchantHomePath(stores);
  if (home === "/completar") {
    return next && isSetupAllowedPath(next) ? next : "/completar";
  }
  return next || home;
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
  const isChangePassword = isChangePasswordPath(pathname);
  const isInvite = isInvitePath(pathname);
  const { ready, firebaseEnabled, user } = useMerchantAuth();

  useEffect(() => {
    if (!ready) return;

    // Cambio de contraseña: sesión = oobCode en el URL; no redirigir.
    if (isChangePassword || isInvite) return;

    if (firebaseEnabled && !user) {
      if (!isOnboarding && !isLogin) {
        const next = safeReturnPath(pathname);
        router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
      }
      return;
    }

    if (!user) return;
    if (!isOnboarding && !isLogin) return;

    let cancelled = false;
    void (async () => {
      let stores: StoreSetupFields[] | null = null;
      try {
        const list = await api<StoreSetupFields[]>("/auth/merchant/stores");
        stores = Array.isArray(list) ? list : [];
      } catch {
        /* sin listado no hay perfil de negocio: no entrar al panel vacío */
      }
      if (cancelled) return;

      if (isOnboarding) {
        if (stores && stores.length > 0) {
          router.replace(merchantHomePath(stores));
        }
        return;
      }

      if (!stores || stores.length === 0) {
        router.replace(onboardingPathFromSearch());
        return;
      }

      const raw = new URLSearchParams(window.location.search).get("next");
      router.replace(destForLoggedInMerchant(stores, safeReturnPath(raw)));
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    firebaseEnabled,
    user,
    isOnboarding,
    isLogin,
    isChangePassword,
    pathname,
    router,
  ]);

  if (!ready) {
    return <SkeletonScreen />;
  }

  let screen: ReactNode;
  if (isChangePassword) {
    screen = (
      <Suspense fallback={<SkeletonScreen />}>
        <MerchantChangePassword />
      </Suspense>
    );
  } else if (isInvite) {
    screen = (
      <Suspense fallback={<SkeletonScreen />}>
        <MerchantInviteAccept />
      </Suspense>
    );
  } else if (!user && isLogin) {
    screen = <MerchantLogin />;
  } else if (firebaseEnabled && !user && !isOnboarding) {
    screen = <SkeletonScreen />;
  } else if (user && isLogin) {
    screen = <SkeletonScreen />;
  } else if (isOnboarding) {
    screen = (
      <Suspense fallback={<SkeletonScreen />}>
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
