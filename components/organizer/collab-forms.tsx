"use client";

import { useActionState, useState } from "react";
import { adminAddPartner, applyOpenCall, createCollabPost, invitePartner, respondPartnerInvite, setPartnerBudget, type CollabActionState } from "@/lib/actions/collab";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

type OrgOption = { id: string; name: string; type: "merchant" | "community"; village: string | null };
type Ctx = { organizerId: string; typeOrg: string };

// Jawab undangan partner; merchant bisa langsung mengisi budget poin.
export function RespondInviteForm({ partnerId, isMerchant, ctx }: { partnerId: string; isMerchant: boolean; ctx: Ctx }) {
  const [state, action] = useActionState<CollabActionState, FormData>(respondPartnerInvite, {});
  if (state.success) return <SuccessMessage message={state.success} />;
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="organizer_id" value={ctx.organizerId} />
      <input type="hidden" name="type_org" value={ctx.typeOrg} />
      <ErrorMessage message={state.error} />
      {isMerchant && (
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-fg-soft">
          Budget poin yang kamu sumbangkan (opsional)
          <input name="budget" type="number" min={0} max={1000000} inputMode="numeric" placeholder="0" className={inputClass} />
        </label>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <SubmitButton size="small" variant="outline" name="decision" value="decline" pendingText="…">Tolak</SubmitButton>
        <SubmitButton size="small" variant="dark" name="decision" value="accept" pendingText="…">Terima</SubmitButton>
      </div>
    </form>
  );
}

export function PartnerBudgetForm({ partnerId, budget, ctx }: { partnerId: string; budget: number; ctx: Ctx }) {
  const [state, action] = useActionState<CollabActionState, FormData>(setPartnerBudget, {});
  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="organizer_id" value={ctx.organizerId} />
      <input type="hidden" name="type_org" value={ctx.typeOrg} />
      <label className="flex flex-1 flex-col gap-1 text-[12px] font-semibold text-fg-soft">
        Budget poin
        <input name="budget" type="number" min={0} max={1000000} inputMode="numeric" defaultValue={budget} className={inputClass} />
      </label>
      <SubmitButton size="small" variant="dark" pendingText="…">Simpan</SubmitButton>
      {(state.error || state.success) && <span className={`text-[11px] ${state.error ? "text-danger" : "text-success"}`}>{state.error ?? state.success}</span>}
    </form>
  );
}

// Host mengundang partner ke aktivitasnya.
export function InvitePartnerForm({ activityId, organizers, ctx }: { activityId: string; organizers: OrgOption[]; ctx: Ctx }) {
  const [state, action] = useActionState<CollabActionState, FormData>(invitePartner, {});
  const [role, setRole] = useState<"cohost" | "sponsor">("cohost");
  const [orgId, setOrgId] = useState(organizers[0]?.id ?? "");
  const chosen = organizers.find((o) => o.id === orgId);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="activity_id" value={activityId} />
      <input type="hidden" name="organizer_id" value={ctx.organizerId} />
      <input type="hidden" name="type_org" value={ctx.typeOrg} />
      <input type="hidden" name="role" value={role} />
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Penyelenggara</span>
        <select name="partner_organizer_id" value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputClass}>
          {organizers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {o.type === "merchant" ? "merchant" : "komunitas"}{o.village ? ` · ${o.village}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        {(["cohost", "sponsor"] as const).map((r) => (
          <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`${chipClass.base} ${role === r ? chipClass.selected : chipClass.idle}`}>
            {r === "cohost" ? "Cohost" : "Sponsor"}
          </button>
        ))}
      </div>
      {chosen?.type === "merchant" && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Usulan budget poin (opsional)</span>
          <input name="budget" type="number" min={0} max={1000000} inputMode="numeric" placeholder="0" className={inputClass} />
        </label>
      )}
      <textarea name="note" rows={2} maxLength={500} placeholder="Pesan untuk partner: apa yang kamu butuhkan dan apa yang mereka dapat." className={textareaClass} />
      <SubmitButton size="small" variant="dark" pendingText="Mengirim…" className="self-end">Kirim undangan</SubmitButton>
    </form>
  );
}

// Admin menambahkan partner langsung ke event Gasyu.
export function AdminAddPartnerForm({ activityId, organizers }: { activityId: string; organizers: OrgOption[] }) {
  const [state, action] = useActionState<CollabActionState, FormData>(adminAddPartner, {});
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="activity_id" value={activityId} />
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <select name="partner_organizer_id" className={inputClass} aria-label="Penyelenggara">
          {organizers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {o.type === "merchant" ? "merchant" : "komunitas"}
            </option>
          ))}
        </select>
        <select name="role" className={inputClass} aria-label="Peran">
          <option value="cohost">Cohost</option>
          <option value="sponsor">Sponsor</option>
        </select>
      </div>
      <input name="note" maxLength={500} placeholder="Catatan kontribusi, contoh: booth kopi di panggung utama" className={inputClass} />
      <SubmitButton size="small" variant="dark" pendingText="Menambahkan…" className="self-end">Tambah partner</SubmitButton>
    </form>
  );
}

// Buka open call baru.
export function NewPostForm({ ctx, activities, districts }: { ctx: Ctx; activities: { id: string; title: string }[]; districts: { id: string; name: string; villages: { id: string; name: string }[] }[] }) {
  const [state, action] = useActionState<CollabActionState, FormData>(createCollabPost, {});
  const [kind, setKind] = useState<"collab" | "sponsor">("collab");
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="organizer_id" value={ctx.organizerId} />
      <input type="hidden" name="type_org" value={ctx.typeOrg} />
      <input type="hidden" name="kind" value={kind} />
      <h2 className="text-[15px] font-bold">Buka open call</h2>
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <div className="flex gap-2">
        {([["collab", "Cari kolaborator"], ["sponsor", "Cari sponsor"]] as const).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={kind === v} onClick={() => setKind(v)} className={`${chipClass.base} ${kind === v ? chipClass.selected : chipClass.idle}`}>
            {l}
          </button>
        ))}
      </div>
      <input name="title" required minLength={3} maxLength={100} placeholder="Judul, contoh: Jelajah Kuliner Malam butuh 4 kedai" className={inputClass} aria-label="Judul" />
      <select name="activity_id" defaultValue="" className={inputClass} aria-label="Aktivitas terkait">
        <option value="">Tawaran umum (tanpa aktivitas tertentu)</option>
        {activities.map((a) => (
          <option key={a.id} value={a.id}>{a.title}</option>
        ))}
      </select>
      <textarea name="needs" required minLength={3} maxLength={500} rows={2} placeholder="Butuh: apa yang kamu cari dari partner" className={textareaClass} aria-label="Kebutuhan" />
      <textarea name="benefits" required minLength={3} maxLength={500} rows={2} placeholder="Partner dapat: logo di halaman aktivitas, checkpoint di outlet, dll." className={textareaClass} aria-label="Manfaat" />
      <div className="grid grid-cols-2 gap-2">
        <select name="region_id" defaultValue="" className={inputClass} aria-label="Wilayah">
          <option value="">Semua wilayah</option>
          {districts.map((d) => (
            <optgroup key={d.id} label={`Kec. ${d.name}`}>
              <option value={d.id}>Seluruh Kec. {d.name}</option>
              {d.villages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input name="deadline" type="date" className={inputClass} aria-label="Tenggat" />
      </div>
      <SubmitButton size="small" variant="dark" pendingText="Menyimpan…" className="self-end">Buka open call</SubmitButton>
    </form>
  );
}

// Ajukan diri ke open call.
export function ApplyForm({ postId, isMerchant, ctx }: { postId: string; isMerchant: boolean; ctx: Ctx }) {
  const [state, action] = useActionState<CollabActionState, FormData>(applyOpenCall, {});
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"cohost" | "sponsor">(isMerchant ? "sponsor" : "cohost");
  if (state.success) return <SuccessMessage message={state.success} />;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex h-10 items-center justify-center self-start rounded-full border border-line-strong bg-surface px-4 text-[13px] font-semibold text-fg">
        Ajukan diri
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2.5 rounded-2xl bg-bg p-3">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="organizer_id" value={ctx.organizerId} />
      <input type="hidden" name="type_org" value={ctx.typeOrg} />
      <input type="hidden" name="role" value={role} />
      <ErrorMessage message={state.error} />
      <div className="flex gap-2">
        {(["cohost", "sponsor"] as const).map((r) => (
          <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`${chipClass.base} ${role === r ? chipClass.selected : chipClass.idle}`}>
            {r === "cohost" ? "Sebagai cohost" : "Sebagai sponsor"}
          </button>
        ))}
      </div>
      {isMerchant && <input name="budget" type="number" min={0} max={1000000} inputMode="numeric" placeholder="Budget poin yang disumbangkan (opsional)" className={inputClass} aria-label="Budget poin" />}
      <input name="contribution" maxLength={500} placeholder="Kontribusi: tenaga, tempat, voucher, publikasi…" className={inputClass} aria-label="Kontribusi" />
      <textarea name="message" rows={2} maxLength={500} placeholder="Pesan untuk pembuat open call" className={textareaClass} aria-label="Pesan" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-[13px] font-semibold text-fg-soft">Batal</button>
        <SubmitButton size="small" variant="dark" pendingText="Mengirim…">Kirim pengajuan</SubmitButton>
      </div>
    </form>
  );
}
