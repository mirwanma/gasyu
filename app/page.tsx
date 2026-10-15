// Halaman sementara. Irisan 1 akan menggantinya dengan alur masuk dan onboarding.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex gap-2">
        <span className="rounded-full bg-merchant-tint px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-merchant-text">
          Merchant
        </span>
        <span className="rounded-full bg-komunitas-tint px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-komunitas-text">
          Komunitas
        </span>
        <span className="rounded-full bg-warga-tint px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-warga">
          Warga
        </span>
      </div>
      <h1 className="text-[40px] font-extrabold leading-[44px] tracking-[-0.03em]">ramein</h1>
      <p className="text-[15px] leading-[22px] text-ink-soft">
        Bikin kota makin rame, bareng-bareng. Pilot Kota Cimahi sedang disiapkan.
      </p>
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-4 text-[13px] leading-[18px] text-ink-soft">
        Fondasi proyek siap. Langkah berikutnya: Irisan 1 (login, onboarding, wilayah Cimahi).
      </div>
    </main>
  );
}
