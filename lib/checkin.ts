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
  xp_base: number;
  xp_first_visit: number;
  xp_collab: number;
  xp_total: number;
  total_xp: number;
};

export type QrPayload = { checkpointId: string; token: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Isi QR adalah URL halaman Scan supaya kamera bawaan HP juga bisa membukanya.
export function buildQrUrl(origin: string, checkpointId: string, token: string) {
  return `${origin}/scan?c=${checkpointId}&t=${token}`;
}

export function parseQrPayload(text: string): QrPayload | null {
  try {
    const url = new URL(text);
    const c = url.searchParams.get("c");
    const t = url.searchParams.get("t");
    if (c && t && UUID.test(c) && /^[0-9a-f]{16}$/i.test(t)) return { checkpointId: c, token: t };
  } catch {
    // bukan URL; coba format ringkas
  }
  const m = text.match(/^ramein:ci:([0-9a-f-]{36}):([0-9a-f]{16})$/i);
  return m ? { checkpointId: m[1], token: m[2] } : null;
}
