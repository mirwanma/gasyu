// Format isi QR check-in dan hasil check-in (aman untuk client dan server).

export type CheckinResult = {
  checkin_id: string;
  activity_id: string;
  activity_title: string;
  activity_type: "event" | "challenge";
  checkpoint_name: string;
  partner_name: string;
  distance_m: number | null;
  flagged: boolean;
  completed: boolean;
  target_scope: "individual" | "group";
  progress: number;
  group_progress: number | null;
  target_count: number;
  xp_base: number;
  xp_first_visit: number;
  xp_collab: number;
  xp_group: number;
  xp_total: number;
  points: number;
  points_balance: number;
  total_xp: number;
};

export type QrPayload = { kind: "checkin"; checkpointId: string; token: string } | { kind: "mission"; missionId: string; token: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Isi QR adalah URL halaman Scan supaya kamera bawaan HP juga bisa membukanya.
export function buildQrUrl(origin: string, checkpointId: string, token: string) {
  return `${origin}/scan?c=${checkpointId}&t=${token}`;
}

export function parseQrPayload(text: string): QrPayload | null {
  try {
    const url = new URL(text);
    const c = url.searchParams.get("c");
    const m = url.searchParams.get("m");
    const t = url.searchParams.get("t");
    if (t && /^[0-9a-f]{16}$/i.test(t)) {
      if (c && UUID.test(c)) return { kind: "checkin", checkpointId: c, token: t };
      if (m && UUID.test(m)) return { kind: "mission", missionId: m, token: t };
    }
  } catch {
    // bukan URL; coba format ringkas
  }
  const ci = text.match(/^ramein:ci:([0-9a-f-]{36}):([0-9a-f]{16})$/i);
  if (ci) return { kind: "checkin", checkpointId: ci[1], token: ci[2] };
  const mi = text.match(/^ramein:mi:([0-9a-f-]{36}):([0-9a-f]{16})$/i);
  return mi ? { kind: "mission", missionId: mi[1], token: mi[2] } : null;
}
