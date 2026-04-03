import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import Header from "@/components/layout/header";
import BottomNav from "@/components/layout/bottom-nav";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <Header displayName={profile?.display_name} />
      <main className="flex-1 pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
