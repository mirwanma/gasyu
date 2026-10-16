import { createBrowserClient } from "@supabase/ssr";
import type { AppDatabase as Database } from "./types";

// Client Supabase untuk komponen yang jalan di browser.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
