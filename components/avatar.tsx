// Inisial berwarna untuk warga atau penyelenggara (logo dipakai jika ada).

import { safeImageUrl } from "@/lib/safe-url";

const ORGANIZER_COLORS = {
  merchant: "bg-accent-merchant",
  community: "bg-accent-komunitas",
  platform: "bg-accent-warga",
} as const;

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function OrganizerAvatar({
  name,
  type,
  logoUrl,
  size = 40,
  radius = 12,
}: {
  name: string;
  type: keyof typeof ORGANIZER_COLORS;
  logoUrl?: string | null;
  size?: number;
  radius?: number;
}) {
  const style = { width: size, height: size, borderRadius: radius, fontSize: Math.round(size / 3) };
  const logo = safeImageUrl(logoUrl);
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" style={{ ...style, objectFit: "cover" }} className="shrink-0" />;
  }
  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center font-bold text-fg ${ORGANIZER_COLORS[type]}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function UserAvatar({ nickname, size = 48, avatarUrl }: { nickname: string; size?: number; avatarUrl?: string | null }) {
  const avatar = safeImageUrl(avatarUrl);
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto profil dari bucket publik avatars
      <img
        src={avatar}
        alt=""
        style={{ width: size, height: size, objectFit: "cover" }}
        className="shrink-0 rounded-full border-2 border-avatar-ring bg-avatar"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-avatar-ring bg-avatar font-display font-semibold uppercase text-link"
      aria-hidden="true"
    >
      {nickname.slice(0, 2)}
    </span>
  );
}
