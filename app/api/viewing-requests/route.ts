import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view viewing requests." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const { data, error } = await supabase.from("viewing_requests")
      .select("id,listing_id,tenant_id,tenant_name,tenant_phone,preferred_date,preferred_time,message,status,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ requests: data, role: profile?.role });
  } catch (error) {
    console.error("Unable to load viewing requests.", error);
    return NextResponse.json({ error: "Viewing requests are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid viewing request." }, { status: 400 });
  }
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const preferredDate = body.preferredDate;
  const preferredDateText = typeof preferredDate === "string" ? preferredDate : "";
  const preferredTime = typeof body.preferredTime === "string" ? body.preferredTime.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)
    || name.length < 2 || name.length > 100
    || phone.length < 7 || phone.length > 30 || !/^[+0-9() -]+$/.test(phone)
    || !validDate(preferredDate)
    || !/^(morning|afternoon|evening)$/.test(preferredTime)
    || message.length > 500) {
    return NextResponse.json({ error: "Check your name, phone, preferred date/time, and message." }, { status: 400 });
  }
  if (preferredDateText < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "Choose today or a future viewing date." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in as a tenant to request a viewing." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "tenant") return NextResponse.json({ error: "Only tenant accounts can request a viewing." }, { status: 403 });
    const { data: listing, error: listingError } = await supabase.from("listings").select("id")
      .eq("id", listingId).eq("current_status", "published").eq("is_demo", false)
      .neq("availability_status", "occupied").maybeSingle();
    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "This listing is no longer available for viewing requests." }, { status: 404 });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await supabase.from("viewing_requests")
      .select("id", { count: "exact", head: true }).eq("tenant_id", user.id).gte("created_at", since);
    if (rateError) throw rateError;
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "You’ve reached the daily viewing request limit. Try again tomorrow." }, { status: 429 });

    const { data, error } = await supabase.from("viewing_requests").insert({
      listing_id: listingId,
      tenant_id: user.id,
      tenant_name: name,
      tenant_phone: phone,
      preferred_date: preferredDateText,
      preferred_time: preferredTime,
      message: message || null,
    }).select("id").single();
    if (error?.message.includes("viewing_request_rate_limit_exceeded")) {
      return NextResponse.json({ error: "You’ve reached the daily viewing request limit. Try again tomorrow." }, { status: 429 });
    }
    if (error) throw error;
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to create viewing request.", error);
    return NextResponse.json({ error: "Your viewing request could not be saved. Please try again." }, { status: 503 });
  }
}
