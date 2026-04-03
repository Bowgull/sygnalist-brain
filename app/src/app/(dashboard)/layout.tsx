import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import Header from "@/components/layout/header";
import BottomNav from "@/components/layout/bottom-nav";
import DesktopSidebar from "@/components/layout/desktop-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("auth_user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-dvh flex-col">
      <Header displayName={profile?.display_name} />
      <div className="flex flex-1">
        {/* Desktop sidebar — hidden on mobile */}
        <DesktopSidebar isAdmin={isAdmin} displayName={profile?.display_name} />
        {/* Main content */}
        <main className="flex-1 pb-16 lg:pb-0">
          <div className="app-container">
            {children}
          </div>
        </main>
      </div>
      {/* Mobile bottom nav — hidden on desktop */}
      <div className="lg:hidden">
        <BottomNav isAdmin={isAdmin} />
      </div>
    </div>
  );
}
