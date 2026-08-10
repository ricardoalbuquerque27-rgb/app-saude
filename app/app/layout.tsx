import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { getPending } from "@/lib/pending";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, onboarded")
    .eq("id", user.id)
    .maybeSingle();

  const userName =
    profile?.full_name || user.user_metadata?.full_name || "Atleta";

  const pending = await getPending(supabase, user.id);

  return (
    <AppShell
      userName={userName}
      userEmail={user.email ?? ""}
      needsOnboarding={profile ? !profile.onboarded : false}
      pendingHrefs={pending.hrefs}
    >
      {children}
    </AppShell>
  );
}
