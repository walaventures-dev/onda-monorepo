"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GradientButton, OndaLogo, OndaScriptMark, PasswordInput } from "@onda/shared-ui";
import { useMerchantAuth, mapFirebaseAuthError } from "../lib/MerchantAuth";

type Phase = "loading" | "form" | "done" | "invalid";

export function MerchantChangePassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = (searchParams.get("oobCode") || "").trim();
  const {
    verifyPasswordResetCode,
    confirmPasswordReset,
    firebaseEnabled,
  } = useMerchantAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmTouched = confirm.length > 0;
  const passwordsMatch = password === confirm;
  const mismatch = confirmTouched && !passwordsMatch;
  const canSubmit =
    password.length >= 6 && confirmTouched && passwordsMatch && !busy;

  useEffect(() => {
    document.title = "Onda - Cambiar contraseña";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!firebaseEnabled) {
        setPhase("invalid");
        setError("El inicio de sesión no está disponible en este entorno.");
        return;
      }
      if (!oobCode) {
        setPhase("invalid");
        setError(
          "Falta el enlace de recuperación. Solicita uno nuevo desde el login.",
        );
        return;
      }
      try {
        const info = await verifyPasswordResetCode(oobCode);
        if (cancelled) return;
        setEmail(info.email);
        setPhase("form");
      } catch (err) {
        if (cancelled) return;
        setPhase("invalid");
        setError(
          mapFirebaseAuthError(
            err,
            "Este enlace no es válido o ya expiró. Solicita uno nuevo.",
          ) || "Este enlace no es válido o ya expiró. Solicita uno nuevo.",
        );
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [oobCode, firebaseEnabled]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(oobCode, password);
      setPhase("done");
    } catch (err) {
      setError(
        mapFirebaseAuthError(
          err,
          "No se pudo cambiar la contraseña. Intenta de nuevo.",
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
              Nueva contraseña
            </p>
            <img
              src="/brand/login.jpg"
              alt=""
              className="mt-6 h-auto w-full max-w-md max-h-[min(62vh,36rem)] rounded-2xl object-contain ring-1 ring-[var(--onda-border)]"
            />
          </aside>

          <main className="flex min-h-0 justify-center">
            <div className="onda-card w-full max-w-md p-5 text-center sm:p-8 duration-300 ease-out animate-[fadeIn_0.28s_ease-out]">
              {phase === "loading" ? (
                <p className="text-sm text-[var(--onda-muted)]">
                  Validando enlace…
                </p>
              ) : null}

              {phase === "invalid" ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                    Enlace no válido
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--onda-danger)]">
                    {error}
                  </p>
                  <p className="mt-5 text-center text-sm text-[var(--onda-muted)]">
                    <Link
                      href="/login"
                      className="font-medium text-[var(--onda-primary-500)]"
                    >
                      Volver al inicio de sesión
                    </Link>
                  </p>
                </>
              ) : null}

              {phase === "form" ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                    Elige tu nueva contraseña
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--onda-muted)]">
                    {email ? (
                      <>
                        Para{" "}
                        <span className="font-medium text-[var(--onda-ink)]">
                          {email}
                        </span>
                      </>
                    ) : (
                      "Escribe y confirma tu nueva contraseña."
                    )}
                  </p>

                  <form
                    className="mt-5 flex flex-col gap-3.5 text-left"
                    onSubmit={onSubmit}
                  >
                    <label className="onda-field">
                      <span className="onda-field__label">Nueva contraseña</span>
                      <PasswordInput
                        required
                        minLength={6}
                        autoComplete="new-password"
                        autoFocus
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                        }}
                        aria-invalid={
                          password.length > 0 && password.length < 6
                            ? true
                            : undefined
                        }
                      />
                      {password.length > 0 && password.length < 6 ? (
                        <span className="onda-field__hint text-[var(--onda-danger)]">
                          Mínimo 6 caracteres
                        </span>
                      ) : null}
                    </label>
                    <label className="onda-field">
                      <span className="onda-field__label">
                        Confirmar contraseña
                      </span>
                      <PasswordInput
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.value);
                          setError("");
                        }}
                        aria-invalid={mismatch ? true : undefined}
                        aria-describedby={
                          confirmTouched ? "password-match-hint" : undefined
                        }
                      />
                      {confirmTouched ? (
                        <span
                          id="password-match-hint"
                          className={`onda-field__hint ${
                            mismatch
                              ? "text-[var(--onda-danger)]"
                              : "text-[var(--onda-success)]"
                          }`}
                          role={mismatch ? "alert" : undefined}
                        >
                          {mismatch
                            ? "Las contraseñas no coinciden"
                            : "Las contraseñas coinciden"}
                        </span>
                      ) : null}
                    </label>
                    {error ? (
                      <p className="text-sm text-[var(--onda-danger)]">{error}</p>
                    ) : null}
                    <GradientButton
                      type="submit"
                      disabled={!canSubmit}
                      className="mt-1 w-full"
                    >
                      {busy ? "Guardando…" : "Guardar contraseña"}
                    </GradientButton>
                  </form>
                </>
              ) : null}

              {phase === "done" ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--onda-ink)] sm:text-3xl">
                    Contraseña actualizada
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--onda-muted)]">
                    Ya puedes entrar con tu nueva contraseña.
                  </p>
                  <GradientButton
                    type="button"
                    className="mt-6 w-full"
                    onClick={() => router.push("/login")}
                  >
                    Ir a iniciar sesión
                  </GradientButton>
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
