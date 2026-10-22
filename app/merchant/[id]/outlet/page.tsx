import { Suspense } from "react";
import { OutletForm } from "./outlet-form";
import { Icon } from "@/components/icons";
import { OrganizerShell } from "@/components/organizer/shell";
import { cardClass, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { toggleOutlet } from "@/lib/actions/organizer";
import { getVillageOptions } from "@/lib/data/organizers";
import { createClient } from "@/lib/supabase/server";

const DAY_LABELS: Record<string, string> = { mon: "Sen", tue: "Sel", wed: "Rab", thu: "Kam", fri: "Jum", sat: "Sab", sun: "Min" };

export default function Page({ params }: PageProps<"/merchant/[id]/outlet">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[16px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/merchant/[id]/outlet">, "params">) {
  const { id } = await params;
  return (
    <OrganizerShell organizerId={id} type="merchant" active="Lainnya" title="Outlet">
      {() => <OutletBody id={id} />}
    </OrganizerShell>
  );
}

function describeHours(hours: Record<string, [string, string]> | null) {
  if (!hours) return "Jam buka belum diisi";
  const days = Object.keys(DAY_LABELS).filter((d) => hours[d]);
  if (days.length === 0) return "Jam buka belum diisi";
  const [open, close] = hours[days[0]];
  const label = days.length === 7 ? "Setiap hari" : days.map((d) => DAY_LABELS[d]).join(", ");
  return `${label} · ${open.replace(":", ".")}–${close.replace(":", ".")}`;
}

async function OutletBody({ id }: { id: string }) {
  const supabase = await createClient();
  const [{ data: outlets }, districts] = await Promise.all([
    supabase
      .from("merchant_outlets")
      .select("id, name, address, lat, lng, opening_hours, is_active, village:regions(name)")
      .eq("organizer_id", id)
      .order("created_at"),
    getVillageOptions(),
  ]);

  return (
    <>
      <section className="flex flex-col gap-2.5">
        {(outlets ?? []).map((outlet) => {
          const village = (Array.isArray(outlet.village) ? outlet.village[0] : outlet.village) as { name: string } | null;
          return (
            <div key={outlet.id} className={`${cardClass} flex flex-col gap-2 p-4`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[17px] font-semibold">{outlet.name}</span>
                <span className={`${tagClass.base} ${outlet.is_active ? tagClass.success : tagClass.neutral}`}>
                  {outlet.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <span className="text-[16px] text-fg-soft">
                {outlet.address}
                {village ? ` · Kel. ${village.name}` : ""}
              </span>
              <span className="text-[16px] text-fg-soft">{describeHours(outlet.opening_hours as Record<string, [string, string]> | null)}</span>
              <div className="flex items-center justify-between">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${outlet.lat}&mlon=${outlet.lng}#map=17/${outlet.lat}/${outlet.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[14px] font-semibold text-link"
                >
                  <Icon name="pin" size={14} stroke={2} />
                  Cek titik di peta
                </a>
                <form action={toggleOutlet}>
                  <input type="hidden" name="organizer_id" value={id} />
                  <input type="hidden" name="outlet_id" value={outlet.id} />
                  <input type="hidden" name="active" value={outlet.is_active ? "false" : "true"} />
                  <SubmitButton size="small" variant="outline" pendingText="…">
                    {outlet.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </SubmitButton>
                </form>
              </div>
            </div>
          );
        })}
      </section>
      <OutletForm organizerId={id} districts={districts} />
    </>
  );
}
