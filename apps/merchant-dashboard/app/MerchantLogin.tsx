"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { GradientButton, OndaLogo, OndaScriptMark, PasswordInput } from "@onda/shared-ui";
import { useMerchantAuth, mapFirebaseAuthError } from "../lib/MerchantAuth";
import { GoogleSignInButton } from "./GoogleSignInButton";

type Mode = "login" | "reset" | "reset-sent";

export function MerchantLogin() {
  const {
    signIn,
    signInWithGoogle,
    resetPassword,
    firebaseEnabled,
    googleRedirectError,
  } = useMerchantAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title =
      mode === "login"
        ? "Onda - Iniciar sesión"
        : "Onda - Cambiar contraseña";
  }, [mode]);

  useEffect(() => {
    if (googleRedirectError) setError(googleRedirectError);
  }, [googleRedirectError]);

  function goTo(next: Mode) {
    setError("");
    setMode(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        mapFirebaseAuthError(
          err,
          "No se pudo iniciar sesión. Revisa los datos e intenta de nuevo.",
        ) || "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await resetPassword(email.trim());
      goTo("reset-sent");
    } catch (err) {
      const fromApi =
        err instanceof Error && err.message && !err.message.startsWith('auth/')
          ? err.message
          : null;
      setError(
        fromApi ||
          mapFirebaseAuthError(
            err,
            "No se pudo enviar el enlace. Revisa el email e intenta de nuevo.",
          ) ||
          "",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        mapFirebaseAuthError(
          err,
          "No se pudo continuar con Google. Intenta de nuevo.",
        ) || "",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-dvh max-h-dvh overflow-hidden bg-[var(--onda-bg)]">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--onda-sky)]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-[var(--onda-primary-500)]/10 blur-3xl"
        aria-hidden
      />
      <OndaScriptMark className="pointer-events-none absolute -bottom-4 -left-6 h-40 w-auto -rotate-12 opacity-[0.05] sm:h-52 md:h-60" />
      <OndaScriptMark className="pointer-events-none absolute -right-8 top-[8%] h-28 w-auto rotate-[16deg] opacity-[0.04] sm:h-40 md:h-48" />

      <div className="relative mx-auto flex h-full max-w-6xl min-h-0 flex-col items-center justify-center px-4 py-8">
        <header className="mb-20 flex shrink-0 justify-center">
          <OndaLogo />
        </header>

        <div className="grid w-full min-h-0 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
          <aside className="relative hidden min-h-0 flex-col items-center text-center lg:flex">
            <p className="font-display text-4xl font-semibold leading-[1.12] tracking-tight text-[var(--onda-ink)] xl:text-[2.75rem]">
              {mode === "login" ? "Hola de nuevo" : "Cambia tu contraseña"}
            </p>
            <img
              src="/brand/login.jpg"
              alt=""
              className="mt-6 h-auto w-full max-w-md max-h-[min(62vh,36rem)] rounded-2xl object-contain ring-1 ring-[var(--onda-border)]"
            />
          </aside>

          <main className="flex min-h-0 justify-center">
            <div className="onda-card w-full max-w-md p-5 text-center sm:p-8 duration-300 ease-out animate-[fadeIn_0.28s_ease-out]">
              {mode === "login" ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                    Entra a tu cuenta
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--onda-muted)]">
                    {firebaseEnabled
                      ? "Con Google o con tu email."
                      : "Entra con el email de tu negocio."}
                  </p>

                  <form
                    className="mt-5 flex flex-col gap-3.5 text-left"
                    onSubmit={onSubmit}
                  >
                    <label className="onda-field">
                      <span className="onda-field__label">Email</span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="onda-input"
                        placeholder="dueno@negocio.com"
                      />
                    </label>
                    <label className="onda-field">
                      <span className="flex items-center justify-between gap-2">
                        <span className="onda-field__label">Contraseña</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--onda-primary-500)]"
                          onClick={() => goTo("reset")}
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </span>
                      <PasswordInput
                        required
                        minLength={6}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    {error ? (
                      <p className="text-sm text-[var(--onda-danger)]">{error}</p>
                    ) : null}
                    <GradientButton
                      type="submit"
                      disabled={busy}
                      className="mt-1 w-full"
                    >
                      {busy ? "Entrando…" : "Entrar"}
                    </GradientButton>
                  </form>

                  {firebaseEnabled ? (
                    <>
                      <div className="my-4 flex items-center gap-3">
                        <span className="h-px flex-1 bg-[var(--onda-border)]" />
                        <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--onda-muted)]">
                          o
                        </span>
                        <span className="h-px flex-1 bg-[var(--onda-border)]" />
                      </div>

                      <GoogleSignInButton
                        busy={busy}
                        onClick={() => void onGoogle()}
                      />
                    </>
                  ) : null}

                  <p className="mt-5 text-center text-sm text-[var(--onda-muted)]">
                    ¿Primera vez en Onda?{" "}
                    <Link
                      href="/onboarding"
                      className="font-medium text-[var(--onda-primary-500)]"
                    >
                      Crear cuenta
                    </Link>
                  </p>
                </>
              ) : null}

              {mode === "reset" ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                    Cambiar contraseña
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--onda-muted)]">
                    Te enviaremos un enlace a tu email para elegir una nueva.
                  </p>

                  <form
                    className="mt-5 flex flex-col gap-3.5 text-left"
                    onSubmit={onReset}
                  >
                    <label className="onda-field">
                      <span className="onda-field__label">Email</span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="onda-input"
                        placeholder="dueno@negocio.com"
                      />
                    </label>
                    {error ? (
                      <p className="text-sm text-[var(--onda-danger)]">{error}</p>
                    ) : null}
                    <GradientButton
                      type="submit"
                      disabled={busy}
                      className="mt-1 w-full"
                    >
                      {busy ? "Enviando…" : "Enviar enlace"}
                    </GradientButton>
                  </form>

                  <p className="mt-5 text-center text-sm text-[var(--onda-muted)]">
                    <button
                      type="button"
                      className="font-medium text-[var(--onda-primary-500)]"
                      onClick={() => goTo("login")}
                    >
                      Volver a iniciar sesión
                    </button>
                  </p>
                </>
              ) : null}

              {mode === "reset-sent" ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                    Revisa tu email
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--onda-muted)]">
                    Si existe una cuenta con{" "}
                    <span className="font-medium text-[var(--onda-ink)]">
                      {email.trim()}
                    </span>
                    , te enviamos un enlace para cambiar la contraseña. Revisa
                    también spam.
                  </p>
                  <GradientButton
                    type="button"
                    className="mt-6 w-full"
                    onClick={() => goTo("login")}
                  >
                    Volver a iniciar sesión
                  </GradientButton>
                  <p className="mt-4 text-center text-sm text-[var(--onda-muted)]">
                    ¿No llegó?{" "}
                    <button
                      type="button"
                      className="font-medium text-[var(--onda-primary-500)]"
                      onClick={() => goTo("reset")}
                    >
                      Reenviar enlace
                    </button>
                  </p>
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
