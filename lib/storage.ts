import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Mengunggah berkas milik organizer ke bucket. Path: <organizer_id>/<nama>.<ext>.
// Bucket publik (logos) mengembalikan URL publik; bucket privat mengembalikan path-nya.
export async function uploadOrganizerFile(
  supabase: SupabaseClient,
  bucket: "logos" | "organizer-proofs" | "covers",
  organizerId: string,
  name: string,
  file: File,
): Promise<string | null> {
  const ext = EXT[file.type];
  if (!ext) return null;
  const path = `${organizerId}/${name}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: true });
  if (error) return null;
  if (bucket === "logos" || bucket === "covers") return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return path;
}

// URL sementara (1 jam) untuk berkas di bucket privat.
export async function signedUrl(supabase: SupabaseClient, bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
