import Link from "next/link";
import { Heart, PlusCircle, Search, UserRound } from "lucide-react";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { isConfiguredAdmin } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";

export default async function SiteNavigation() {
  let signedIn = false;
  let role: string | null = null;
  let isAdmin = false;

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) console.error("Unable to load navigation account.", authError);
    signedIn = Boolean(user);
    if (user) {
      isAdmin = isConfiguredAdmin(user);
      if (!isAdmin) {
        const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (error) console.error("Unable to load navigation account role.", error);
        role = profile?.role ?? null;
      }
    }
  }

  const showLandlordLink = !isAdmin && role !== "tenant";
  const accountHref = isAdmin ? "/admin" : role === "landlord" ? "/dashboard/landlord" : role === "tenant" ? "/dashboard/tenant" : "/auth";
  const accountLabel = isAdmin ? "Admin dashboard" : role === "landlord" ? "Landlord dashboard" : role === "tenant" ? "Tenant dashboard" : "Account";

  return (
    <>
      <nav className="flex flex-1 items-center justify-end gap-1 text-xs sm:flex-none sm:gap-2 sm:text-sm">
        <Link href="/favorites" className="whitespace-nowrap rounded-full px-2 py-2 font-medium hover:bg-neutral-100 sm:px-3">Saved homes</Link>
        {isAdmin && <Link href="/admin" className="whitespace-nowrap rounded-full px-2 py-2 font-semibold text-emerald-800 hover:bg-emerald-50 sm:px-3">Admin</Link>}
        {showLandlordLink && <Link href={signedIn ? "/dashboard/landlord" : "/dashboard/landlord/new"} className="whitespace-nowrap rounded-full px-2 py-2 font-medium hover:bg-neutral-100 sm:px-3">{signedIn ? "My listings" : "List Your Keja"}</Link>}
        {signedIn ? <SignOutButton /> : <Link href="/auth" className="whitespace-nowrap rounded-full px-2 py-2 font-medium hover:bg-neutral-100 sm:px-3">Sign in</Link>}
        <span className="hidden whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 md:inline-flex">Free launch</span>
      </nav>
      <nav aria-label="Quick navigation" className={`fixed inset-x-0 bottom-0 z-40 grid ${showLandlordLink ? "grid-cols-4" : "grid-cols-3"} border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] sm:hidden`}>
        <Link href="/" className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-700"><Search aria-hidden="true" className="h-5 w-5" />Search</Link>
        <Link href="/favorites" className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-700"><Heart aria-hidden="true" className="h-5 w-5" />Saved</Link>
        {showLandlordLink && <Link href={signedIn ? "/dashboard/landlord" : "/dashboard/landlord/new"} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-700"><PlusCircle aria-hidden="true" className="h-5 w-5" />{signedIn ? "Listings" : "List"}</Link>}
        {signedIn
          ? <span className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-700"><SignOutButton /></span>
          : <Link href={accountHref} aria-label={accountLabel} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-700"><UserRound aria-hidden="true" className="h-5 w-5" />Account</Link>}
      </nav>
    </>
  );
}
