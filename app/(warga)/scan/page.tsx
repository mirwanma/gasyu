import { Suspense } from "react";
import { Scanner } from "./scanner";
import { parseQrPayload } from "@/lib/checkin";
import { createClient } from "@/lib/supabase/server";

// Scan QR check-in. Juga menerima ?c=<checkpoint>&t=<token> dari kamera bawaan HP.
export default function ScanPage({ searchParams }: PageProps<"/scan">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
        <ScanLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ScanLoader({ searchParams }: Pick<PageProps<"/scan">, "searchParams">) {
  const sp = await searchParams;
  const c = typeof sp.c === "string" ? sp.c : "";
  const m = typeof sp.m === "string" ? sp.m : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const initial = t && c ? parseQrPayload(`gasyu:ci:${c}:${t}`) : t && m ? parseQrPayload(`gasyu:mi:${m}:${t}`) : null;
  const supabase = await createClient();
  const { data: levels } = await supabase.from("levels").select("level, name, min_xp");
  return <Scanner initial={initial} levels={levels ?? []} />;
}
