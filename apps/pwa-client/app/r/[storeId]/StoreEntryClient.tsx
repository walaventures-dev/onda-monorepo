// apps/pwa-client/app/r/[storeId]/StoreEntryClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Button, Chip, OndaIcons, promoTypeIcon } from "@onda/shared-ui";
import { cartillaDeadlineLabel, formatCartillaDay, loyaltyProgressCopy, pickLoyaltyReward } from "@onda/shared-utils";
import {
  loadSession,
  saveSession,
  replaceLoginHistory,
  type CustomerSession,
} from "../../../lib/session";
import {
  issueWalletPass,
  walletInstallUrl,
} from "../../../lib/wallet";
import { PassSwipe, type PassSwipeCard } from "./PassSwipe";
import { OtpStep } from "./OtpStep";
import {
  PendingRequestWait,
  type PendingRequestDto,
} from "./PendingRequestWait";

type Step = "loading" | "otp" | "name" | "home" | "pendingWait";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function StoreEntryPage() {
  const params = useParams<{ storeId: string }>();
  const storeKey = params.storeId;

  const [step, setStep] = useState<Step>("loading");
  const [store, setStore] = useState<any>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [pass, setPass] = useState<any>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRequest, setPendingRequest] =
    useState<PendingRequestDto | null>(null);

  const stepRef = useRef(step);
  const storeIdRef = useRef(store?.id as string | undefined);
  const storeKeyRef = useRef(storeKey);
  const preparingWalletRef = useRef<string | null>(null);
  stepRef.current = step;
  storeIdRef.current = store?.id;
  storeKeyRef.current = storeKey;

  async function loadOrClaim(sess: CustomerSession, resolvedStoreId: string) {
    try {
      const passes = await api<any[]>(
        `/passes?userId=${sess.user.id}&storeId=${resolvedStoreId}`,
      );
      if (passes[0]) {
        setPass(passes[0]);
      } else {
        const created = await api<any>(
          `/passes/store/${resolvedStoreId}/claim`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${sess.token}` },
          },
        );
        setPass(created);
      }
    } catch (err: any) {
      setError(err.message || "No se pudo cargar tu tarjeta");
    } finally {
      setStep("home");
      replaceLoginHistory();
    }
  }

  const loadOrClaimRef = useRef(loadOrClaim);
  loadOrClaimRef.current = loadOrClaim;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const s = await api<any>(`/stores/${storeKey}`);
        if (cancelled) return;
        setStore(s);

        const existing = loadSession();
        if (!existing) {
          setStep("otp");
          return;
        }
        setSession(existing);
        await loadOrClaim(existing, s.id);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "No se pudo conectar");
          setStep("otp");
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [storeKey]);

  useEffect(() => {
    const passId = pass?.id;
    if (!passId || step !== "home") return;

    async function refreshWalletStatus() {
      if (document.visibilityState !== "visible") return;
      try {
        const fresh = await api<any>(`/passes/${passId}`);
        setPass((prev: any) =>
          prev
            ? {
                ...fresh,
                appleUrl: fresh.appleUrl || prev.appleUrl,
                googleUrl: fresh.googleUrl || prev.googleUrl,
              }
            : fresh,
        );
      } catch {
        /* ignore */
      }
    }

    document.addEventListener("visibilitychange", refreshWalletStatus);
    window.addEventListener("focus", refreshWalletStatus);
    return () => {
      document.removeEventListener("visibilitychange", refreshWalletStatus);
      window.removeEventListener("focus", refreshWalletStatus);
    };
  }, [pass?.id, step]);

  useEffect(() => {
    if (step !== "home" || !pass?.id) return;
    if (preparingWalletRef.current === pass.id) return;
    preparingWalletRef.current = pass.id;
    let cancelled = false;
    void issueWalletPass(pass.id)
      .then((links) => {
        if (cancelled) return;
        setPass((prev: any) => (prev ? { ...prev, ...links } : prev));
      })
      .catch((err: any) => {
        preparingWalletRef.current = null;
        if (!cancelled) {
          setError(err.message || "No se pudo preparar Wallet");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [step, pass?.id]);

  useEffect(() => {
    function pathIsThisStore() {
      const path = window.location.pathname;
      const key = storeKeyRef.current;
      const id = storeIdRef.current;
      return path === `/r/${key}` || (Boolean(id) && path === `/r/${id}`);
    }

    function resumeIfAuthed() {
      const existing = loadSession();
      if (!existing || !pathIsThisStore()) return;

      replaceLoginHistory();

      const current = stepRef.current;
      if (current !== "otp" && current !== "name") return;

      setSession(existing);
      if (!existing.user.name.trim()) {
        setStep("name");
        return;
      }
      if (storeIdRef.current) {
        void loadOrClaimRef.current(existing, storeIdRef.current);
      } else {
        setStep("home");
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) resumeIfAuthed();
    }

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", resumeIfAuthed);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", resumeIfAuthed);
    };
  }, []);

  async function onOtpVerified(result: {
    token: string;
    user: CustomerSession["user"];
    isNewUser: boolean;
  }) {
    const sess: CustomerSession = { token: result.token, user: result.user };
    saveSession(sess);
    replaceLoginHistory();
    setSession(sess);
    if (result.isNewUser) {
      setStep("name");
      return;
    }
    if (!store?.id) return;
    await loadOrClaim(sess, store.id);
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
      replaceLoginHistory();
      setSession(sess);
      if (!store?.id) return;
      await loadOrClaim(sess, store.id);
    } catch (err: any) {
      setError(err.message || "No se pudo guardar tu nombre");
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

  const promotions = useMemo(() => {
    if (pass?.promotions?.length) return pass.promotions;
    return [];
  }, [pass]);
  const milestoneStamps = useMemo(
    () => promotions.map((p: any) => p.pointsRequired as number),
    [promotions],
  );
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

  const storeDesign = pass?.passDesign || pass?.cartilla?.passDesign || store?.passDesign;
  const storeName = store?.name || "tu visita";
  const deadlineLabel = cartillaDeadlineLabel(
    pass?.cartilla?.endsAt,
    pass?.cartilla?.isDefault,
  );
  const logoUrl = storeDesign?.logoUrl as string | undefined;
  const storeInitial = (storeName.trim().charAt(0) || "O").toUpperCase();
  const userName = session?.user.name?.trim();
  const userInitial = (userName?.charAt(0) || "O").toUpperCase();
  const installUrl = walletInstallUrl(pass);
  const progressLabel = useMemo(() => {
    if (!pass) return null;
    const claimed = pass.claimedPromotionIdsThisCycle || [];
    const reward = pickLoyaltyReward({
      points: pass.points ?? 0,
      claimedPromotionIds: claimed,
      rewards: promotions.map((p: any) => ({
        title: p.title,
        pointsRequired: p.pointsRequired,
        id: p.id,
      })),
    });
    return loyaltyProgressCopy(
      pass.points ?? 0,
      pass.maxStamps ?? pass.cartilla?.maxStamps ?? store?.maxStamps ?? 12,
      reward,
    ).value;
  }, [pass, promotions, store?.maxStamps]);

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
        maxStamps: pass?.maxStamps ?? pass?.cartilla?.maxStamps ?? store?.maxStamps ?? 12,
        milestoneStamps,
        inWallet: Boolean(pass?.walletActive),
        walletUrl: installUrl,
        deadlineLabel,
        progressLabel,
      },
    ];
  }, [storeDesign, store, storeName, pass, milestoneStamps, installUrl, deadlineLabel, progressLabel]);

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
      {step !== "pendingWait" && (
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
                <p className="onda-pwa-eyebrow">
                  <img
                    src="/brand/onda-wordmark.png"
                    alt="Onda"
                    className="h-4 w-auto"
                  />
                </p>
                <h1 className="onda-pwa-title">{storeName}</h1>
              </>
            )}
          </div>
        </header>
      )}

      <div className="onda-pwa-body onda-pwa-fade">
        {step === "otp" && !session && !loadSession() && (
          <OtpStep onVerified={onOtpVerified} />
        )}

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

        {step === "home" && (
          <div className="flex flex-1 flex-col">
            <PassSwipe
              cards={swipeCards}
              memberName={session?.user.name}
              compact={false}
            />
            {pass?.cartilla?.endsAt ? (
              <p className="mt-3 text-center text-sm text-[var(--onda-muted)]">
                Tienes hasta el {formatCartillaDay(pass.cartilla.endsAt)} para
                acumular y redimir.
              </p>
            ) : pass?.cartilla?.isDefault ? (
              <p className="mt-3 text-center text-sm text-[var(--onda-muted)]">
                Cartilla vigente hasta nuevo aviso.
              </p>
            ) : null}
            {pass && promotionsWithStatus.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3">
                {promotionsWithStatus.map((p: any) => {
                  const stampsRemaining = p.pointsRequired - pass.points;
                  const isAvailable = p.status === "available";
                  const isLocked = p.status === "locked";
                  const isClaimed = p.status === "claimed";

                  return (
                    <div
                      key={p.id}
                      role={isAvailable ? "button" : undefined}
                      tabIndex={isAvailable ? 0 : undefined}
                      onClick={
                        isAvailable && !busy
                          ? () => startPendingRequest("CLAIM", p.id)
                          : undefined
                      }
                      onKeyDown={
                        isAvailable
                          ? (e) => {
                              if (
                                (e.key === "Enter" || e.key === " ") &&
                                !busy
                              ) {
                                e.preventDefault();
                                startPendingRequest("CLAIM", p.id);
                              }
                            }
                          : undefined
                      }
                      className={`flex items-center gap-3 rounded-2xl p-4 shadow-sm ${
                        isLocked ? "bg-[var(--onda-violet-soft)]" : "bg-white"
                      } ${isAvailable ? "cursor-pointer active:scale-[0.99]" : ""} ${busy ? "opacity-60" : ""}`}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full ${
                            isLocked
                              ? "bg-[var(--onda-border)] text-[var(--onda-muted)]"
                              : "bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
                          }`}
                        >
                          {promoTypeIcon(p.type)}
                        </div>
                        {isLocked ? (
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--onda-muted)] shadow-sm">
                            {OndaIcons.lock}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-semibold ${
                            isLocked
                              ? "text-[var(--onda-muted)]"
                              : "text-[var(--onda-ink)]"
                          }`}
                        >
                          {p.title}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--onda-muted)]">
                          Por alcanzar {p.pointsRequired} onda
                          {p.pointsRequired === 1 ? "" : "s"}
                        </p>
                        <div className="mt-2">
                          {isClaimed ? (
                            <Chip size="sm">✓ Reclamado</Chip>
                          ) : isAvailable ? (
                            <Chip color="success" size="sm">
                              Disponible
                            </Chip>
                          ) : (
                            <Chip size="sm">Próximo premio</Chip>
                          )}
                        </div>
                      </div>
                      {isAvailable ? (
                        <div
                          className="ml-auto shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="primary"
                            size="sm"
                            isDisabled={busy}
                            onPress={() => startPendingRequest("CLAIM", p.id)}
                          >
                            Reclamar
                          </Button>
                        </div>
                      ) : null}
                      {isLocked ? (
                        <div className="ml-auto shrink-0 rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                          <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
                            Falta
                          </p>
                          <p className="text-sm font-bold text-[var(--onda-violet)]">
                            {stampsRemaining} onda
                            {stampsRemaining === 1 ? "" : "s"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
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
                onClick={() => startPendingRequest("ACCUMULATE")}
              >
                Acumular una onda
              </button>
            </div>
          </div>
        )}

        {step === "pendingWait" && pendingRequest && session && pass && (
          <PendingRequestWait
            request={pendingRequest}
            passId={pass.id}
            session={session}
            storeName={storeName}
            serialNumber={pass.serialNumber}
            onResolved={onPendingResolved}
            onCancel={() => setStep("home")}
          />
        )}
      </div>
    </div>
  );
}
