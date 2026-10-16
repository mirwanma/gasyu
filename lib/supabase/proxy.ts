import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";

// Halaman yang boleh dibuka tanpa login.
const PUBLIC_PATHS = ["/masuk", "/auth"];
const ONBOARDING_PATH = "/onboarding";

function matches(path: string, base: string) {
  return path === base || path.startsWith(`${base}/`);
}

// Memperbarui sesi Supabase di setiap request, lalu:
// - belum login → ke /masuk
// - sudah login tapi belum onboarding → ke /onboarding
// - sudah onboarding tapi membuka /masuk atau /onboarding → ke tujuan (`next`) atau beranda
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Jangan menaruh kode lain di antara createServerClient dan getClaims().
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const { pathname, search } = request.nextUrl;
  const here = `${pathname}${search}`;

  // Redirect sambil membawa cookie sesi yang baru diperbarui.
  const redirectTo = (target: string) => {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Dashboard admin dilayani lewat subdomain admin.* (mis. admin.gasyu.id):
  // halaman depan di host itu langsung ke /admin.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("admin.") && pathname === "/") return redirectTo("/admin");

  const isPublic = PUBLIC_PATHS.some((base) => matches(pathname, base));
  const isOnboarding = matches(pathname, ONBOARDING_PATH);

  if (!userId) {
    if (isPublic) return response;
    return redirectTo(`/masuk?next=${encodeURIComponent(here)}`);
  }

  // Callback login selalu dibiarkan lewat supaya sesi sempat dibuat.
  if (matches(pathname, "/auth")) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, is_admin, deleted_at")
    .eq("id", userId)
    .maybeSingle();
  // Akun yang sudah dihapus: keluarkan sesinya dan tampilkan pesan di halaman masuk.
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    return pathname === "/masuk" ? response : redirectTo("/masuk?akun=dihapus");
  }

  const onboarded = Boolean(profile?.onboarded_at);

  // Dashboard admin hanya untuk akun is_admin (dicek lagi di layout dan RLS).
  if (matches(pathname, "/admin") && !profile?.is_admin) {
    return redirectTo("/profil?akses=admin");
  }
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  if (!onboarded) {
    if (isOnboarding) return response;
    const target = isPublic ? next : here;
    return redirectTo(`${ONBOARDING_PATH}?next=${encodeURIComponent(target)}`);
  }

  if (isOnboarding || isPublic) return redirectTo(next);

  return response;
}
