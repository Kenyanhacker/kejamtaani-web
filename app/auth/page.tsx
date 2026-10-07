import AuthForm from "@/components/AuthForm";
import { hasSupabaseConfig } from "@/lib/supabase/server";
import { safeInternalRedirect } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; setup?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseConfig();
  const next = safeInternalRedirect(params.next, "https://keja-mtaani.invalid", "");

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">Your Keja Mtaani account</h1>
      <p className="mt-2 text-sm text-neutral-600">Sign in or create an account as a tenant or landlord.</p>
      {params.setup === "required" && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Account sign-in needs to be configured by the site owner before dashboards can be used.</p>}
      {!configured
        ? <p role="status" className="mt-5 rounded-xl border bg-white p-4 text-sm text-neutral-600">Authentication is not configured on this deployment. Ask the site owner to complete the Supabase setup in the hosting checklist.</p>
        : <AuthForm next={next} />}
    </main>
  );
}
