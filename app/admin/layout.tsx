import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminSidebar } from "./sidebar";
import { getCurrentUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";

// Dashboard admin: web, desktop-first, tema terang. Hanya akun is_admin.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="theme-light flex min-h-screen flex-1 flex-col md:flex-row">
      <Suspense fallback={<aside className="w-full border-b border-line bg-surface p-6 md:w-[260px] md:border-b-0 md:border-r" />}>
        <AdminGuard />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-5 md:p-8">{children}</main>
    </div>
  );
}

async function AdminGuard() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/profil?akses=admin");
  const supabase = await createClient();
  const { count: pendingOrganizers } = await supabase
    .from("organizers")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return <AdminSidebar pendingOrganizers={pendingOrganizers ?? 0} nickname={user.nickname} />;
}
