import { Suspense } from "react";
import { cardClass, inputClass, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { setCityActive } from "@/lib/actions/moderation";
import { listCityStats, type CityStats } from "@/lib/data/regions";
import { formatNumber } from "@/lib/format";

// Admin: buka atau tutup kota. Warga dan penyelenggara dari kota mana pun bisa mendaftar;
// kota yang dibuka tampil di Jelajah, bisa dipakai sebagai cakupan aktivitas, dan punya peringkat.
export default function WilayahPage({ searchParams }: PageProps<"/admin/wilayah">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Wilayah</h1>
        <span className="text-[15px] text-fg-soft">
          Buka kota supaya tampil di Jelajah, bisa dipakai sebagai cakupan aktivitas, dan punya peringkat kota serta kecamatan.
        </span>
      </div>
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/admin/wilayah">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const hasil = typeof sp.hasil === "string" ? sp.hasil : undefined;
  const errorMsg = typeof sp.error === "string" ? sp.error : undefined;
  const back = q ? `/admin/wilayah?q=${encodeURIComponent(q)}` : "/admin/wilayah";
  const rows = await listCityStats({ q: q || undefined });
  const open = rows.filter((r) => r.is_active);
  const waiting = rows.filter((r) => !r.is_active);

  return (
    <>
      {hasil === "kota_dibuka" && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">Kota dibuka.</p>}
      {hasil === "kota_ditutup" && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">Kota ditutup.</p>}
      {errorMsg && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[15px] font-semibold text-danger">{errorMsg}</p>}

      <form className="flex max-w-xl gap-2">
        <input name="q" defaultValue={q} placeholder="Cari kota/kabupaten, mis. Bandung" aria-label="Cari kota" className={`${inputClass} h-10 text-[15px]`} />
        <button type="submit" className="h-10 rounded-xl bg-fg px-4 text-[15px] font-semibold text-bg">
          Cari
        </button>
      </form>

      {q ? (
        <CityTable title={`Hasil pencarian "${q}"`} rows={rows} back={back} empty="Kota tidak ditemukan." />
      ) : (
        <>
          <CityTable title="Kota yang sudah dibuka" rows={open} back={back} empty="Belum ada kota yang dibuka." />
          <CityTable
            title="Belum dibuka, sudah ada pengguna"
            rows={waiting.sort((a, b) => b.pending_organizers - a.pending_organizers || b.citizens + b.organizers - (a.citizens + a.organizers))}
            back={back}
            empty="Belum ada warga atau penyelenggara dari kota lain."
          />
        </>
      )}
    </>
  );
}

function CityTable({ title, rows, back, empty }: { title: string; rows: CityStats[]; back: string; empty: string }) {
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <h2 className="border-b border-line px-5 py-4 font-display text-[18px] font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-5 text-[15px] text-fg-soft">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[15px]">
            <thead className="text-left text-[13px] text-fg-soft">
              <tr>
                <th className="px-5 py-3 font-bold">Kota/kabupaten</th>
                <th className="px-3 py-3 font-bold">Warga</th>
                <th className="px-3 py-3 font-bold">Penyelenggara</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.city_id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="flex flex-col">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-[13px] text-fg-soft">{c.province_name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">{formatNumber(c.citizens)}</td>
                  <td className="px-3 py-3">
                    {formatNumber(c.organizers)}
                    {c.pending_organizers > 0 && <span className="text-fg-soft"> ({c.pending_organizers} menunggu verifikasi)</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`${tagClass.base} ${c.is_active ? tagClass.success : tagClass.neutral}`}>{c.is_active ? "Dibuka" : "Belum dibuka"}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <form action={setCityActive}>
                      <input type="hidden" name="city_id" value={c.city_id} />
                      <input type="hidden" name="active" value={c.is_active ? "false" : "true"} />
                      <input type="hidden" name="back" value={back} />
                      <SubmitButton size="small" variant={c.is_active ? "outline" : "dark"} pendingText="Menyimpan…">
                        {c.is_active ? "Tutup" : "Buka kota"}
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
