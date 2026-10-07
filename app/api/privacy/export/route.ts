import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to export your account data." }, { status: 401 });

    const [profile, listings, viewingRequests, interactions, reports, savedSearches, privacyRequests, policyAcceptances] = await Promise.all([
      supabase.from("profiles").select("id,email,role,created_at").eq("id", user.id).maybeSingle(),
      fetchAll<unknown>((from, to) => supabase.from("listings").select("*").eq("landlord_id", user.id).range(from, to)),
      fetchAll<unknown>((from, to) => supabase.from("viewing_requests").select("*").range(from, to)),
      fetchAll<unknown>((from, to) => supabase.from("listing_interactions").select("*").range(from, to)),
      fetchAll<unknown>((from, to) => supabase.from("listing_reports").select("*").eq("reporter_id", user.id).range(from, to)),
      fetchAll<unknown>((from, to) => supabase.from("saved_searches").select("*").eq("user_id", user.id).range(from, to)),
      fetchAll<unknown>((from, to) => supabase.from("privacy_requests").select("id,request_type,details,status,created_at").eq("user_id", user.id).range(from, to)),
      fetchAll<unknown>((from, to) => supabase.from("account_policy_acceptances").select("terms_version,privacy_version,marketing_opt_in,recorded_at").eq("user_id", user.id).range(from, to)),
    ]);
    if (profile.error) throw profile.error;
    return new NextResponse(JSON.stringify({
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, createdAt: user.created_at },
      profile: profile.data,
      landlordListings: listings,
      viewingRequests,
      interactions,
      listingReports: reports,
      savedSearches,
      privacyRequests,
      policyAcceptances: policyAcceptances,
    }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="keja-mtaani-data-${user.id}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to export account data.", error);
    return NextResponse.json({ error: "Account data could not be exported. Please contact support." }, { status: 503 });
  }
}
