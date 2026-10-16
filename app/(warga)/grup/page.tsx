import { Suspense } from "react";
import Link from "next/link";
import { GroupEntryForms, InviteResponse, ShareCode } from "./group-forms";
import { UserAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, smallButton, tagClass } from "@/components/styles";
import { leaveGroup, regenerateInviteCode, removeGroupMember, transferGroupLeader } from "@/lib/actions/groups";
import { listGroupInvites, listGroupProgress, listMyGroups } from "@/lib/data/groups";
import { getCurrentUser } from "@/lib/data/user";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Halaman Grup warga, mengikuti artboard "Warga · Grup".
export default function GrupPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Groups />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="" />
    </>
  );
}

async function Groups() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const [groups, invites, { data: settings }] = await Promise.all([
    listMyGroups(user.id),
    listGroupInvites(user.id),
    supabase.from("app_settings").select("key, value").in("key", ["group.max_groups_per_user", "group.max_size", "xp.group_bonus_pct", "xp.group_bonus_min_members"]),
  ]);
  const setting = (key: string, fallback: number) => Number((settings ?? []).find((s) => s.key === key)?.value ?? fallback);
  const maxGroups = setting("group.max_groups_per_user", 3);
  const maxSize = setting("group.max_size", 10);
  const progress = groups.length ? await listGroupProgress({ groupIds: groups.map((g) => g.id) }) : [];
  const { data: titles } = progress.length ? await supabase.from("v_activity_cards").select("id, title, status").in("id", [...new Set(progress.map((p) => p.activity_id))]) : { data: [] };
  const titleOf = new Map((titles ?? []).map((t) => [t.id as string, t as { title: string; status: string }]));

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/profil" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
          <Icon name="back" stroke={2} />
        </Link>
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="font-display text-[26px] font-bold">Grup</h1>
          <span className="text-[13px] text-fg-soft">
            {groups.length} dari maksimal {maxGroups} grup
          </span>
        </div>
      </div>

      {invites.map((inv) => (
        <section key={inv.participation_id} className="flex flex-col gap-3 rounded-[20px] border border-[#4B3A8A] bg-[#2A1F4A] p-4 text-[#F3F4FA]">
          <span className="text-[11px] font-bold tracking-[0.05em] text-[#C9C3EE]">UNDANGAN IKUT AKTIVITAS</span>
          <span className="text-[15px] leading-[1.45]">
            <b>{inv.leader_nickname}</b> mendaftarkan {inv.group_name} ke{" "}
            <Link href={`/aktivitas/${inv.activity_id}`} className="font-bold text-[#F3F4FA] underline">
              {inv.title}
            </Link>
          </span>
          <span className="text-[12px] text-[#C9C3EE]">Jawab sebelum {inv.starts_at ? formatDateTime(inv.starts_at) : "aktivitas mulai"}, kursimu dilepas kalau tidak dijawab</span>
          <InviteResponse participationId={inv.participation_id} activityId={inv.activity_id} />
        </section>
      ))}

      <GroupEntryForms canCreate={groups.length < maxGroups} />

      {groups.map((g) => {
        const rows = progress.filter((p) => p.group_id === g.id && titleOf.get(p.activity_id)?.status !== "cancelled");
        return (
          <section key={g.id} className={`${cardClass} flex flex-col gap-3.5 p-4`}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-[3px]">
                <span className="font-display text-[19px] font-semibold">{g.name}</span>
                <span className="text-[12px] text-fg-soft">
                  {g.members.length} dari {maxSize} anggota · ketua {g.members.find((m) => m.role === "leader")?.nickname ?? "-"}
                </span>
              </div>
              <span className={`${tagClass.base} ${g.isLeader ? tagClass.warn : tagClass.success}`}>{g.isLeader ? "Ketua" : "Anggota"}</span>
            </div>
            <div className="flex">
              {g.members.slice(0, 8).map((m) => (
                <span key={m.user_id} className="-mr-2 rounded-full border-[3px] border-surface">
                  <UserAvatar nickname={m.nickname} size={40} />
                </span>
              ))}
              {g.members.length > 8 && <span className="ml-3 self-center text-[12px] text-fg-soft">+{g.members.length - 8}</span>}
            </div>
            {rows.map((p) => (
              <Link key={p.activity_id} href={`/aktivitas/${p.activity_id}`} className="flex flex-col gap-2 rounded-[14px] bg-bg p-3 text-fg">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold">{titleOf.get(p.activity_id)?.title ?? "Challenge"} · target grup</span>
                  <span className="font-semibold text-xp">
                    {p.progress}/{p.target_count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-lg bg-track">
                  <div className="h-full bg-xp" style={{ width: `${Math.min(100, Math.round((p.progress / p.target_count) * 100))}%` }} />
                </div>
                <span className="text-[12px] text-fg-muted">
                  {p.contributors} anggota sudah berkontribusi · peringkat grup #{p.rank}
                </span>
              </Link>
            ))}
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong font-display text-[18px] font-semibold tracking-[0.2em]">{g.invite_code}</span>
              <ShareCode code={g.invite_code} groupName={g.name} />
            </div>
            <details className="group">
              <summary className="cursor-pointer list-none text-[13px] font-semibold text-link">Kelola grup…</summary>
              <div className="mt-3 flex flex-col gap-2">
                {g.members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2.5 text-[13px]">
                    <UserAvatar nickname={m.nickname} size={28} />
                    <span className="flex flex-1 flex-col">
                      <span className="font-semibold">
                        {m.nickname}
                        {m.user_id === user.id ? " (kamu)" : ""}
                      </span>
                      <span className="text-[11px] text-fg-soft">
                        {m.role === "leader" ? "Ketua" : "Anggota"} · {m.village_name ?? "Luar Cimahi"}
                      </span>
                    </span>
                    {g.isLeader && m.user_id !== user.id && (
                      <>
                        <form action={transferGroupLeader}>
                          <input type="hidden" name="group_id" value={g.id} />
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <button type="submit" className="text-[12px] font-semibold text-link">Jadikan ketua</button>
                        </form>
                        <form action={removeGroupMember}>
                          <input type="hidden" name="group_id" value={g.id} />
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <button type="submit" className="text-[12px] font-semibold text-danger">Keluarkan</button>
                        </form>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  {g.isLeader && (
                    <form action={regenerateInviteCode}>
                      <input type="hidden" name="group_id" value={g.id} />
                      <button type="submit" className={smallButton.outline}>Kode baru</button>
                    </form>
                  )}
                  <form action={leaveGroup} className="ml-auto">
                    <input type="hidden" name="group_id" value={g.id} />
                    <button type="submit" className={smallButton.danger}>Keluar dari grup</button>
                  </form>
                </div>
              </div>
            </details>
          </section>
        );
      })}

      <p className="text-[12px] leading-[1.55] text-fg-muted">
        Bonus grup +{setting("xp.group_bonus_pct", 20)}% XP saat minimal {setting("xp.group_bonus_min_members", 3)} anggota check-in di aktivitas yang sama di hari yang sama.
        Grup bisa mendaftar ke aktivitas bermode grup lewat halaman aktivitasnya; hanya ketua yang mendaftarkan.
      </p>
    </>
  );
}
