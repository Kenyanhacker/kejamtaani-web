import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REASONS = ["Incorrect details", "Suspicious or fraudulent", "Already taken", "Inappropriate content", "Other"] as const;

export async function POST(request: NextRequest) {
  let body: { listingId?: unknown; reason?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid listing report." }, { status: 400 });
  }
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const reason = body.reason;
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)
    || !REASONS.includes(reason as (typeof REASONS)[number]) || details.length > 500) {
    return NextResponse.json({ error: "Choose a report reason and keep details under 500 characters." }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in as a tenant to report a listing." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "tenant") return NextResponse.json({ error: "Only tenant accounts can report listings." }, { status: 403 });
    const { data: listing, error: listingError } = await supabase.from("listings").select("id")
      .eq("id", listingId).eq("current_status", "published").eq("is_demo", false).maybeSingle();
    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "This listing is no longer available to report." }, { status: 404 });
    const { error } = await supabase.from("listing_reports").insert({
      listing_id: listingId,
      reporter_id: user.id,
      reason,
      details: details || null,
    });
    if (error?.message.includes("listing_report_rate_limit_exceeded")) {
      return NextResponse.json({ error: "You’ve reached the daily report limit. Contact support if this is urgent." }, { status: 429 });
    }
    if (error) throw error;
    return NextResponse.json({ submitted: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to submit listing report.", error);
    return NextResponse.json({ error: "The report could not be saved. Please try again." }, { status: 503 });
  }
}
