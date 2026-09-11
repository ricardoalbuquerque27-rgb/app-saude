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
    .select("full_name, onboarded, role")
    .eq("id", user.id)
    .maybeSingle();

  const userName =
    profile?.full_name || user.user_metadata?.full_name || "Atleta";
  const role = profile?.role === "nutritionist" ? "nutritionist" : "patient";

  // Pendências só fazem sentido para o paciente.
  const pending =
    role === "patient" ? await getPending(supabase, user.id) : { hrefs: [] };

  return (
    <AppShell
      userName={userName}
      userEmail={user.email ?? ""}
      role={role}
      needsOnboarding={role === "patient" && (profile ? !profile.onboarded : false)}
      pendingHrefs={pending.hrefs}
    >
      {children}
    </AppShell>
  );
}
