// apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@onda/shared-ui";
import {
  loadSession,
  saveSession,
  type CustomerSession,
} from "../../../lib/session";
import { PassSwipe, type PassSwipeCard } from "./PassSwipe";
import { OtpStep } from "./OtpStep";
import {
  PendingRequestWait,
  type PendingRequestDto,
} from "./PendingRequestWait";

type Step =
  | "loading"
  | "otp"
  | "name"
  | "preview"
  | "home"
  | "pendingWait"
  | "rewards";

function isAppleDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function StoreEntryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = params.storeId;

  const [step, setStep] = useState<Step>("loading");
  const [store, setStore] = useState<any>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [pass, setPass] = useState<any>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [walletLinks, setWalletLinks] = useState<{
    appleUrl?: string;
    googleUrl?: string;
  } | null>(null);
  const [pendingRequest, setPendingRequest] =
    useState<PendingRequestDto | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const s = await api<any>(`/stores/${storeId}`);
        if (cancelled) return;
        setStore(s);

        const existing = loadSession();
        if (!existing) {
          setStep("otp");
          return;
        }
        setSession(existing);
        await loadOrPreview(existing, s);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "No se pudo conectar");
          setStep("otp");
        }
      }
    }

    async function loadOrPreview(sess: CustomerSession, s: any) {
      const passes = await api<any[]>(
        `/passes?userId=${sess.user.id}&storeId=${storeId}`,
      );
      if (passes[0]) {
        setPass(passes[0]);
        setStep("home");
      } else {
        setStep("preview");
      }
      void s;
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function onOtpVerified(result: {
    token: string;
    user: CustomerSession["user"];
    isNewUser: boolean;
  }) {
    const sess: CustomerSession = { token: result.token, user: result.user };
    saveSession(sess);
    setSession(sess);
    if (result.isNewUser) {
      setStep("name");
      return;
    }
    const passes = await api<any[]>(
      `/passes?userId=${sess.user.id}&storeId=${storeId}`,
    );
    if (passes[0]) {
      setPass(passes[0]);
      setStep("home");
    } else {
      setStep("preview");
    }
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    if (!session || name.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<CustomerSession["user"]>(
        "/customer-auth/profile",
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      const sess: CustomerSession = { token: session.token, user: updated };
      saveSession(sess);
      setSession(sess);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "No se pudo guardar tu nombre");
    } finally {
      setBusy(false);
    }
  }

  async function claimCard() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<any>(`/passes/store/${storeId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      });
      setPass(created);
      setStep("home");
    } catch (err: any) {
      setError(err.message || "No se pudo reclamar tu tarjeta");
    } finally {
      setBusy(false);
    }
  }

  async function openWallet() {
    if (!pass?.id) return;
    setBusy(true);
    try {
      const links = await api<{ appleUrl?: string; googleUrl?: string }>(
        `/passes/${pass.id}/issue`,
        { method: "POST" },
      );
      setWalletLinks(links);
      const target = isAppleDevice() ? links.appleUrl : links.googleUrl;
      if (target && typeof window !== "undefined") {
        window.open(target, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setError(err.message || "No se pudo abrir Wallet");
    } finally {
      setBusy(false);
    }
  }

  async function startPendingRequest(
    type: "ACCUMULATE" | "CLAIM",
    promotionId?: string,
  ) {
    if (!session || !pass) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<PendingRequestDto>("/pending-requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ passId: pass.id, type, promotionId }),
      });
      setPendingRequest(created);
      setStep("pendingWait");
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar la solicitud");
    } finally {
      setBusy(false);
    }
  }

  async function onPendingResolved(
    status: "CONFIRMED" | "REJECTED" | "EXPIRED",
  ) {
    if (status === "CONFIRMED" && pass) {
      const refreshed = await api<any>(`/passes/${pass.id}`);
      setPass(refreshed);
    }
    setPendingRequest(null);
    setStep("home");
  }

  const promotions = useMemo(
    () => (store?.promotions || []).filter((p: any) => p.isActive),
    [store],
  );
  const milestoneStamps = useMemo(
    () => promotions.map((p: any) => p.pointsRequired as number),
    [promotions],
  );
  const claimablePromotions = useMemo(() => {
    if (!pass) return [];
    const claimed: string[] = pass.claimedPromotionIdsThisCycle || [];
    return promotions.filter(
      (p: any) => p.pointsRequired <= pass.points && !claimed.includes(p.id),
    );
  }, [pass, promotions]);
  const nextReward = useMemo(() => {
    if (!pass) return null;
    const claimed: string[] = pass.claimedPromotionIdsThisCycle || [];
    const upcoming = promotions
      .filter(
        (p: any) => !claimed.includes(p.id) && p.pointsRequired > pass.points,
      )
      .sort((a: any, b: any) => a.pointsRequired - b.pointsRequired);
    return upcoming[0] || null;
  }, [pass, promotions]);
  const promotionsWithStatus = useMemo(() => {
    if (!pass) return [];
    const claimed: string[] = pass.claimedPromotionIdsThisCycle || [];
    return [...promotions]
      .sort((a: any, b: any) => a.pointsRequired - b.pointsRequired)
      .map((p: any) => ({
        ...p,
        status: claimed.includes(p.id)
          ? "claimed"
          : p.pointsRequired <= pass.points
            ? "available"
            : "locked",
      }));
  }, [pass, promotions]);

  const storeDesign = store?.passDesign;
  const storeName = store?.name || "tu visita";
  const walletLabel = "Agregar a tu billetera digital";
  const logoUrl = storeDesign?.logoUrl as string | undefined;
  const storeInitial = (storeName.trim().charAt(0) || "O").toUpperCase();
  const userName = session?.user.name?.trim();
  const userInitial = (userName?.charAt(0) || "O").toUpperCase();
  const maxStamps = store?.maxStamps ?? 12;
  const nextRewardText = (() => {
    if (!nextReward) return null;
    const stampsRemaining = nextReward.pointsRequired - (pass?.points ?? 0);
    if (nextReward.pointsRequired === maxStamps) {
      return `Reclama ${nextReward.title} al completar todos los sellos`;
    }
    return `Te faltan ${stampsRemaining} sello${stampsRemaining === 1 ? "" : "s"} para ${nextReward.title}`;
  })();

  const swipeCards: PassSwipeCard[] = useMemo(() => {
    if (!storeDesign && !store) return [];
    return [
      {
        key: "store",
        badge: "Pase del negocio",
        design: {
          backgroundColor: storeDesign?.backgroundColor,
          foregroundColor: storeDesign?.foregroundColor,
          labelColor: storeDesign?.labelColor,
          title: storeDesign?.title || storeName,
          subtitle: storeDesign?.subtitle || "Onda Rewards",
          description: storeDesign?.description,
          logoUrl: storeDesign?.logoUrl,
        },
        points: pass?.points ?? 0,
        maxStamps: store?.maxStamps ?? 12,
        milestoneStamps,
      },
    ];
  }, [storeDesign, store, storeName, pass, milestoneStamps]);

  if (step === "loading") {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
        <p className="text-sm text-[var(--onda-muted)]">Preparando tu pase…</p>
      </div>
    );
  }

  return (
    <div className="onda-pwa-shell">
      {step !== "pendingWait" && step !== "rewards" && (
        <header
          className={`onda-pwa-hero${step === "home" && userName ? " onda-pwa-hero--split" : ""}${step === "name" ? " onda-pwa-hero--hola" : ""}`}
        >
          {step === "home" && userName ? (
            <Link
              href="/"
              className="onda-pwa-avatar onda-pwa-avatar--user no-underline"
              aria-label="Ver mis tarjetas"
            >
              <span aria-hidden>{userInitial}</span>
            </Link>
          ) : (
            <div className="onda-pwa-avatar" aria-hidden>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" />
              ) : (
                <span>{storeInitial}</span>
              )}
            </div>
          )}
          <div className="onda-pwa-hero-copy">
            {step === "home" && userName ? (
              <>
                <p className="onda-pwa-eyebrow">{getGreeting()}</p>
                <h1 className="onda-pwa-title">{userName}</h1>
              </>
            ) : (
              <>
                <p className="onda-pwa-eyebrow">Onda</p>
                <h1 className="onda-pwa-title">{storeName}</h1>
              </>
            )}
          </div>
        </header>
      )}

      <div className="onda-pwa-body onda-pwa-fade">
        {step === "otp" && <OtpStep onVerified={onOtpVerified} />}

        {step === "name" && (
          <div className="flex flex-1 flex-col">
            <div className="onda-pwa-hola-banner onda-pwa-hola-banner--merged">
              <h1>HOLA</h1>
            </div>
            <div className="onda-pwa-hola-card flex flex-1 flex-col">
              <div className="mb-1">
                <p className="onda-pwa-label">Un último detalle</p>
                <h2 className="onda-pwa-headline mt-1">¿Cómo te llamas?</h2>
                <p className="onda-pwa-sub mt-2">
                  Así te saludaremos cada vez que vuelvas.
                </p>
              </div>
              <form
                className="mt-auto flex flex-col gap-3"
                onSubmit={submitName}
              >
                <p className="onda-pwa-label">Tu nombre</p>
                <input
                  required
                  autoFocus
                  autoComplete="given-name"
                  placeholder="Escribe tu nombre"
                  className="onda-pwa-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {error ? (
                  <p className="text-sm text-[var(--onda-danger)]">{error}</p>
                ) : null}
                <button
                  type="submit"
                  className="onda-pwa-cta"
                  disabled={name.trim().length < 2 || busy}
                >
                  {busy ? "Guardando…" : "Guardar y seguir →"}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-1 flex-col">
            <PassSwipe
              cards={swipeCards}
              memberName={session?.user.name}
              compact
            />
            <div className="onda-pwa-bottom">
              {error ? (
                <p className="mb-2 text-sm text-[var(--onda-danger)]">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                className="onda-pwa-cta"
                disabled={busy}
                onClick={claimCard}
              >
                {busy ? "Reclamando…" : "Reclamar onda"}
              </button>
            </div>
          </div>
        )}

        {step === "home" && pass && (
          <div className="flex flex-1 flex-col">
            <PassSwipe
              cards={swipeCards}
              memberName={session?.user.name}
              compact={false}
            />
            <div className="onda-pwa-bottom">
              {error ? (
                <p className="mb-2 text-sm text-[var(--onda-danger)]">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                className="onda-pwa-cta"
                disabled={busy}
                onClick={openWallet}
              >
                {busy ? "Abriendo Wallet…" : walletLabel}
              </button>
              {nextRewardText ? (
                <div className="onda-pwa-next-reward">
                  <p className="onda-pwa-label">Siguiente premio</p>
                  <p className="onda-pwa-next-reward-text">{nextRewardText}</p>
                </div>
              ) : null}
              <button
                type="button"
                className="onda-pwa-secondary"
                disabled={busy}
                onClick={() => startPendingRequest("ACCUMULATE")}
              >
                Acumular onda
              </button>
              {claimablePromotions.map((promo: any) => (
                <button
                  key={promo.id}
                  type="button"
                  className="onda-pwa-secondary"
                  disabled={busy}
                  onClick={() => startPendingRequest("CLAIM", promo.id)}
                >
                  Reclamar {promo.title}
                </button>
              ))}
              {promotions.length >= 2 ? (
                <button
                  type="button"
                  className="onda-pwa-link"
                  onClick={() => setStep("rewards")}
                >
                  Ver premios del ciclo
                </button>
              ) : null}
              {walletLinks ? (
                <p className="onda-pwa-legal">
                  Si no se abrió,{" "}
                  <a
                    href={
                      isAppleDevice()
                        ? walletLinks.appleUrl
                        : walletLinks.googleUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    toca aquí
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        )}

        {step === "pendingWait" && pendingRequest && session && pass && (
          <PendingRequestWait
            request={pendingRequest}
            passId={pass.id}
            session={session}
            storeName={storeName}
            onResolved={onPendingResolved}
            onCancel={() => setStep("home")}
          />
        )}

        {step === "rewards" && pass && (
          <div className="flex flex-1 flex-col gap-6 pt-[calc(1.1rem+env(safe-area-inset-top,0))]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Volver al pase"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-lg text-[var(--onda-ink)] shadow-sm"
                onClick={() => setStep("home")}
              >
                ←
              </button>
              <span className="text-sm font-semibold text-[var(--onda-ink)]">
                Atrás
              </span>
            </div>

            <div>
              <p className="onda-pwa-label">Lo que te espera</p>
              <h2 className="onda-pwa-headline mt-1">
                Premios con buena Onda.
              </h2>
              <p className="onda-pwa-sub mt-2">
                Completa {maxStamps} sello{maxStamps === 1 ? "" : "s"} y vuelve
                a empezar.
              </p>
            </div>

            <div className="flex flex-col gap-3 pb-6">
              {promotionsWithStatus.map((p: any) => {
                const stampsRemaining = p.pointsRequired - pass.points;
                const isLit =
                  p.status === "claimed" || p.status === "available";
                const statusClasses =
                  p.status === "available"
                    ? "inline-flex items-center rounded-full bg-[var(--onda-lime)] px-2 py-0.5 text-[var(--onda-ink)]"
                    : "text-[var(--onda-muted)]";

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm"
                  >
                    <div
                      className={`flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl ${
                        isLit
                          ? "bg-[var(--onda-ink)]"
                          : "bg-[var(--onda-border)]"
                      }`}
                    >
                      <span
                        className={`text-[0.6rem] font-semibold tracking-wide ${
                          isLit
                            ? "text-[var(--onda-lime)]"
                            : "text-[var(--onda-muted)]"
                        }`}
                      >
                        SELLO
                      </span>
                      <span
                        className={`text-xl font-bold ${
                          isLit
                            ? "text-[var(--onda-lime)]"
                            : "text-[var(--onda-muted)]"
                        }`}
                      >
                        {String(p.pointsRequired).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold ${
                          isLit
                            ? "text-[var(--onda-ink)]"
                            : "text-[var(--onda-muted)]"
                        }`}
                      >
                        {p.title}
                      </p>
                      {p.description ? (
                        <p className="mt-0.5 text-sm text-[var(--onda-muted)]">
                          {p.description}
                        </p>
                      ) : null}
                      <p
                        className={`mt-2 text-[0.7rem] font-bold uppercase tracking-wide ${statusClasses}`}
                      >
                        {p.status === "claimed"
                          ? "✓ Reclamado"
                          : p.status === "available"
                            ? "Disponible"
                            : `Faltan ${stampsRemaining} sello${stampsRemaining === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
