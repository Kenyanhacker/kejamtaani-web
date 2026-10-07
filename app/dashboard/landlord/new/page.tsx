import LandlordListingWizard from "@/components/LandlordListingWizard";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewLandlordListingPage() {
  if (!hasSupabaseConfig()) redirect("/auth?setup=required");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/landlord/new");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || !profile) {
    console.error("Unable to load listing creator profile.", error);
    return <main className="mx-auto max-w-3xl px-4 py-10"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your account profile could not be loaded. Confirm the database setup from the hosting checklist.</p></main>;
  }
  if (profile.role !== "landlord") redirect("/dashboard/tenant");
  return <LandlordListingWizard userId={user.id} />;
}
