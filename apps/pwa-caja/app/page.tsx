export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--onda-ink)]">
        Onda Caja
      </h1>
      <p className="text-sm text-[var(--onda-muted)]">
        Abre esta app con el enlace que genera el panel del negocio. El token va
        en la URL y es la sesión de caja.
      </p>
    </main>
  );
}
