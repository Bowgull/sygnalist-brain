import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import Header from "@/components/layout/header";
import BottomNav from "@/components/layout/bottom-nav";
import TopTabs from "@/components/layout/top-tabs";
import MetricsSidebar from "@/components/layout/metrics-sidebar";
import MobileMetrics from "@/components/layout/mobile-metrics";

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
      <Header displayName={profile?.display_name} role={profile?.role} />

      {/* Mobile metrics strip */}
      <MobileMetrics />

      <div className="mx-auto w-full max-w-[var(--layout-max-width)] flex-1 px-3 md:px-6 py-3 md:py-5">
        {/* Desktop: 2-column grid */}
        <div className="md:grid md:grid-cols-[minmax(0,2fr)_var(--sidebar-width)] md:gap-8">
          {/* Content bay */}
          <div className="min-w-0">
            <TopTabs isAdmin={isAdmin} />
            <div className="md:mt-1 rounded-[var(--radius-md)] md:rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.06)] md:border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#151C24] to-[#11181F] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden">
              {children}
            </div>
          </div>

          {/* Desktop metrics sidebar */}
          <MetricsSidebar />
        </div>
      </div>

      {/* Mobile bottom nav + safe area padding */}
      <div className="pb-16 md:pb-0" />
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
