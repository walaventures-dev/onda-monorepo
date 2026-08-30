import type { Metadata } from "next";
import Image from "next/image";
import { CalendarIcon as Calendar } from "@phosphor-icons/react/dist/ssr/Calendar";
import { HouseIcon as House } from "@phosphor-icons/react/dist/ssr/House";
import { SignInIcon as SignIn } from "@phosphor-icons/react/dist/ssr/SignIn";
import { StorefrontIcon as Storefront } from "@phosphor-icons/react/dist/ssr/Storefront";
import { OndaLogo } from "@onda/shared-ui";
import { demoUrl, loginUrl, onboardingUrl } from "./lib/pricing";

export const metadata: Metadata = {
  title: "Página no encontrada — Onda",
  description: "Este enlace no existe o se mudó. Vuelve al inicio de Onda.",
  robots: { index: false, follow: false },
};

const TREE_LINK =
  "inline-flex w-fit items-center gap-2.5 text-white/90 underline-offset-4 transition hover:text-white hover:underline";

const LINKS = [
  { href: "/", label: "Inicio", Icon: House },
  { href: demoUrl(), label: "Demo", Icon: Calendar },
  { href: loginUrl(), label: "Iniciar sesión", Icon: SignIn },
  {
    href: onboardingUrl(),
    label: "Poner mi negocio en la Onda",
    Icon: Storefront,
  },
] as const;

export default function NotFound() {
  return (
    <main className="onda-404-studio relative flex min-h-dvh flex-col overflow-hidden text-white">
      <div className="onda-404-glow" aria-hidden>
        <span className="onda-404-focus onda-404-focus--nw" />
        <span className="onda-404-focus onda-404-focus--ne" />
        <span className="onda-404-focus onda-404-focus--e" />
        <span className="onda-404-focus onda-404-focus--sw" />
        <span className="onda-404-focus onda-404-focus--s" />
      </div>

      <header className="relative z-10 flex shrink-0 items-center justify-center px-6 py-5">
        <a href="/" className="shrink-0" aria-label="Onda inicio">
          <OndaLogo variant="onPrimary" />
        </a>
      </header>

      <div className="relative grid min-h-0 flex-1 md:grid-cols-[1.1fr_1fr] md:items-stretch">
        <div className="relative order-2 min-h-[38vh] md:order-1 md:min-h-0">
          <Image
            src="/brand/404-not-found.png"
            alt="Persona encogiéndose de hombros"
            fill
            priority
            sizes="(min-width: 768px) 55vw, 100vw"
            className="onda-404-photo object-cover object-[center_72%]"
          />
        </div>

        <div className="relative z-10 order-1 flex flex-col justify-center px-6 py-8 md:order-2 md:px-12 lg:px-16">
          <div className="max-w-md">
            <p className="font-display text-[clamp(3.5rem,12vw,6.5rem)] font-bold leading-none tracking-tight">
              404
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.35rem,3.4vw,1.875rem)] font-semibold leading-tight">
              Esta página no está en la Onda.
            </h1>
            <p className="mt-2 text-sm leading-[1.4] text-white/80 sm:text-base">
              El enlace no existe o se mudó. Elige a dónde ir:
            </p>

            <nav
              aria-label="Ir a"
              className="mt-7 border-l border-white/30 pl-4 text-sm sm:text-base"
            >
              <ul className="flex flex-col gap-3">
                {LINKS.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <a
                      href={href}
                      className={`${TREE_LINK} ${label === "Inicio" ? "font-semibold" : ""}`}
                    >
                      <Icon
                        size={16}
                        weight="regular"
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </main>
  );
}
