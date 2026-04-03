import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AdminNav from "@/components/layout/admin-nav";

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
    .select("role, display_name")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/inbox");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AdminNav displayName={profile.display_name} />
      <main className="flex-1 px-4 py-4 pb-20 lg:px-8">{children}</main>
    </div>
  );
}
