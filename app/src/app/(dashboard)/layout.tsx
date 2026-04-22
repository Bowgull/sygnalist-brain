import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import Header from "@/components/layout-ds/header";
import BottomNav from "@/components/layout-ds/bottom-nav";
import TopTabs from "@/components/layout-ds/top-tabs";
import MetricsSidebar from "@/components/layout/metrics-sidebar";
import { ViewAsProvider } from "@/components/view-as/view-as-context";

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
    <Suspense>
      <ViewAsProvider>
        <div className="flex min-h-dvh flex-col bg-[var(--ds-bg-0)] text-[var(--ds-text-1)]">
          <Header displayName={profile?.display_name} role={profile?.role} />

          <div className="mx-auto w-full max-w-[var(--layout-max-width)] flex-1 px-3 md:px-6 py-3 md:py-6 pb-24 md:pb-6">
            {/* Desktop: 2-column grid with sidebar. Mobile: single column. */}
            <div className="md:grid md:grid-cols-[minmax(0,2fr)_var(--sidebar-width)] md:gap-8">
              <div className="min-w-0">
                <TopTabs isAdmin={isAdmin} />
                <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-1)] bg-[var(--ds-bg-1)] overflow-hidden shadow-[var(--ds-shadow-raise)]">
                  {children}
                </div>
              </div>

              {/* Desktop metrics sidebar — Phase 5 territory, kept as-is for now */}
              <MetricsSidebar />
            </div>
          </div>

          <BottomNav isAdmin={isAdmin} />
        </div>
      </ViewAsProvider>
    </Suspense>
  );
}
