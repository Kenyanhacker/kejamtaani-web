import Link from "next/link";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import SignOutButton from "@/components/SignOutButton";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { isConfiguredAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!hasSupabaseConfig()) redirect("/auth?setup=required");
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) console.error("Unable to verify administrator session.", error.message);
  if (!user) redirect("/auth?next=/admin");

  if (!isConfiguredAdmin(user)) {
    return <main className="mx-auto max-w-2xl px-4 py-16">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-bold text-amber-950">Administrator access required</h1>
        <p className="mt-3 text-sm leading-6 text-amber-900">This signed-in Google account is not on the server-configured administrator allowlist. Sign out and use an authorized account.</p>
        <p className="mt-2 break-all text-sm text-amber-900">Current account: {user.email ?? "Email unavailable"}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link href="/" className="font-semibold text-emerald-900 underline">Return to the website</Link>
          <SignOutButton />
        </div>
      </section>
    </main>;
  }

  return <AdminDashboard email={user.email ?? ""} />;
}
