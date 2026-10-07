import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERACTION_TYPES = ["listing_view", "whatsapp_click", "phone_click", "viewing_request"] as const;
type InteractionType = (typeof INTERACTION_TYPES)[number];

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view interaction history." }, { status: 401 });
    const { data, error } = await supabase
      .from("listing_interactions")
      .select("id, listing_id, landlord_id, actor_user_id, interaction_type, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ interactions: data.map((item) => ({
      id: item.id,
      listing_id: item.listing_id,
      interaction_type: item.interaction_type,
      created_at: item.created_at,
      direction: item.landlord_id === user.id && item.actor_user_id !== user.id ? "lead" : "activity",
    })) });
  } catch (error) {
    console.error("Unable to load interaction history.", error);
    return NextResponse.json({ error: "Interaction history is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 2048) return NextResponse.json({ error: "Interaction request is too large." }, { status: 413 });
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Send a valid JSON interaction." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Invalid interaction." }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const interactionType = body.interactionType;
  const isDatabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId);
  if (!listingId || listingId.length > 80 || !INTERACTION_TYPES.includes(interactionType as InteractionType)) {
    return NextResponse.json({ error: "Invalid listing or interaction type." }, { status: 400 });
  }
  if (!isDatabaseId) {
    return NextResponse.json({ error: "That property could not be found." }, { status: 404 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to save interaction history." }, { status: 401 });

    let landlordId: string | null = null;
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("landlord_id")
      .eq("id", listingId)
      .eq("current_status", "published")
      .eq("is_demo", false)
      .maybeSingle();
    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "That property could not be found." }, { status: 404 });
    landlordId = listing.landlord_id ?? null;

    const { error } = await supabase.from("listing_interactions").insert({
      listing_id: listingId,
      actor_user_id: user.id,
      landlord_id: landlordId,
      interaction_type: interactionType,
    });
    if (error?.message === "interaction_rate_limit_exceeded") {
      return NextResponse.json({ error: "Too many interactions were recorded. Try again shortly." }, { status: 429 });
    }
    if (error) throw error;
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to record listing interaction.", error);
    return NextResponse.json({ error: "This interaction could not be saved." }, { status: 503 });
  }
}
