import Link from "next/link";
import { redirect } from "next/navigation";
import InteractionHistory from "@/components/InteractionHistory";
import SignOutButton from "@/components/SignOutButton";
import ViewingRequests from "@/components/ViewingRequests";
import SavedSearches from "@/components/SavedSearches";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TenantDashboardPage() {
  if (!hasSupabaseConfig()) redirect("/auth?setup=required");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/tenant");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || !profile) {
    console.error("Unable to load tenant profile.", error);
    return <main className="mx-auto max-w-5xl px-4 py-10"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your account profile could not be loaded. Confirm the database setup from the hosting checklist.</p></main>;
  }
  if (profile.role !== "tenant") redirect("/dashboard/landlord");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Tenant dashboard</h1><p className="mt-1 text-sm text-neutral-500">Your property activity is private to your account.</p></div>
        <div className="flex items-center gap-4"><Link href="/favorites" className="underline">Saved properties</Link><Link href="/account/privacy" className="underline">Privacy controls</Link><SignOutButton /></div>
      </div>
      <SavedSearches />
      <p className="mt-6 text-sm"><Link href="/account/privacy" className="text-emerald-800 underline">Export account data or submit a privacy request</Link></p>
      <section className="mt-8">
        <ViewingRequests />
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Interaction history</h2>
        <p className="mt-1 text-sm text-neutral-500">Property views and contact actions made while signed in appear here.</p>
        <InteractionHistory />
      </section>
    </main>
  );
}
