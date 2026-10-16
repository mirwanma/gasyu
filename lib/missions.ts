// Tipe dan label misi yang aman dipakai di server maupun client.

export type MissionVerification = "qr_scan" | "secret_code" | "photo" | "manual";
export type MissionReveal = "on_publish" | "scheduled" | "manual" | "after_mission";
export type CompletionStatus = "pending_review" | "approved" | "rejected";

export const VERIFICATION_LABELS: Record<MissionVerification, string> = {
  qr_scan: "Scan QR",
  secret_code: "Kode rahasia",
  photo: "Foto",
  manual: "Manual",
};

export const VERIFICATION_HOW: Record<MissionVerification, string> = {
  qr_scan: "Scan QR misi di lokasi",
  secret_code: "Ketik kode rahasia",
  photo: "Kirim foto bukti",
  manual: "Ditandai panitia",
};

export const REVEAL_OPTIONS: [MissionReveal, string, string][] = [
  ["on_publish", "Saat aktivitas terbit", "Misi utama yang perlu diketahui sejak awal"],
  ["scheduled", "Pada jam tertentu", "Terbuka otomatis, misalnya misi malam pukul 19.00"],
  ["manual", "Dibuka panitia", "Misi kejutan yang diumumkan saat acara"],
  ["after_mission", "Setelah misi lain selesai", "Rute bertahap: selesai pos 1 baru terbuka pos 2"],
];

// Misi dari sudut pandang warga (hasil get_activity_missions).
export type CitizenMission =
  | {
      id: string;
      open: true;
      title: string;
      description: string | null;
      icon: string | null;
      verification: MissionVerification;
      xp_reward: number;
      is_required: boolean;
      available_from: string | null;
      available_until: string | null;
      checkpoint_name: string | null;
      partner_name: string | null;
      my_status: CompletionStatus | null;
      my_note: string | null;
      my_submitted_at: string | null;
      can_work: boolean;
    }
  | { id: string; open: false; xp_reward: number; is_required: boolean; hint: string };

export type CitizenMissionList = {
  missions: CitizenMission[];
  required_total: number;
  required_done: number;
  can_work: boolean;
  participation_status: string | null;
  payment_status: string | null;
};

// Hasil complete_mission.
export type MissionResult = {
  status: "approved" | "pending_review" | "wrong_code";
  completion_id?: string;
  mission_title: string;
  mission_xp?: number;
  xp?: number;
  points?: number;
  completed?: boolean;
  newly_completed?: boolean;
  flagged?: boolean;
  distance_m?: number | null;
  attempts_left?: number;
  required_total?: number;
  required_done?: number;
  activity_id?: string;
  activity_title?: string;
  activity_type?: "event" | "challenge";
  points_balance?: number;
  total_xp?: number;
};

// Isi QR misi: URL halaman Scan dengan parameter m (misi) dan t (token).
export function buildMissionQrUrl(origin: string, missionId: string, token: string) {
  return `${origin}/scan?m=${missionId}&t=${token}`;
}
