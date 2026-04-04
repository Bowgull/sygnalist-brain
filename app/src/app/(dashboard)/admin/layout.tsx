import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AdminSubTabs from "@/components/layout/admin-sub-tabs";

export default async function AdminLayout({
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
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/inbox");
  }

  return (
    <div>
      <AdminSubTabs />
      <div className="px-4 py-4 lg:px-6">{children}</div>
    </div>
  );
}
