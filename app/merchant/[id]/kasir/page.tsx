import { Suspense } from "react";
import { KasirForm } from "./kasir-form";
import { OrganizerShell } from "@/components/organizer/shell";
import { cardClass } from "@/components/styles";
import { listMerchantRedemptions } from "@/lib/data/rewards";
import { createClient } from "@/lib/supabase/server";

export default function Page({ params }: PageProps<"/merchant/[id]/kasir">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[16px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/merchant/[id]/kasir">, "params">) {
  const { id } = await params;
  return (
    <OrganizerShell organizerId={id} type="merchant" active="Kasir">
      {() => <Body id={id} />}
    </OrganizerShell>
  );
}

async function Body({ id }: { id: string }) {
  const supabase = await createClient();
  const [{ data: outlets }, used] = await Promise.all([
    supabase.from("merchant_outlets").select("id, name").eq("organizer_id", id).eq("is_active", true).order("name"),
    listMerchantRedemptions(id, { usedToday: true }),
  ]);
  const time = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

  if (!outlets?.length) {
    return <p className={`${cardClass} p-4 text-[16px] text-fg-soft`}>Tambahkan outlet aktif dulu di menu Lainnya → Outlet untuk memakai mode kasir.</p>;
  }
  return (
    <>
      <KasirForm organizerId={id} outlets={outlets as { id: string; name: string }[]} />
      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-bold">Dipakai hari ini · {used.length}</h2>
        {used.length === 0 && <p className={`${cardClass} p-4 text-[16px] text-fg-soft`}>Belum ada voucher dipakai hari ini.</p>}
        {used.map((u) => (
          <div key={u.id} className={`${cardClass} flex h-[52px] items-center justify-between px-3.5 text-[16px]`}>
            <span>
              <b>{u.nickname}</b> · {u.title}
            </span>
            <span className="text-fg-soft">
              {u.used_at ? time.format(new Date(u.used_at)) : ""}
              {u.outlet_name ? ` · ${u.outlet_name}` : ""}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
