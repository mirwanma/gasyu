import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { sessionCookieOptions } from "./cookies";
import type { AppDatabase as Database } from "./types";

// Client Supabase untuk Server Component, Server Action, dan Route Handler.
export async function createClient() {
  // Sesi selalu per-permintaan; ini memberi tahu Cache Components supaya
  // pemeriksaan kedaluwarsa token (Date.now) tidak dianggap bagian prerender.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Dipanggil dari Server Component: aman diabaikan,
            // sesi tetap diperbarui oleh proxy.ts.
          }
        },
      },
    },
  );
}
