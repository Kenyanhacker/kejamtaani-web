import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { LISTING_STATUSES } from "@/lib/landlord-listings";

function isListingId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function landlordListing(id: string) {
  if (!hasSupabaseConfig()) return { response: NextResponse.json({ error: "Listing storage is not configured." }, { status: 503 }) };
  if (!isListingId(id)) return { response: NextResponse.json({ error: "Invalid listing ID." }, { status: 400 }) };

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Sign in as a landlord to manage listings." }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) {
    console.error("Unable to verify landlord role.", profileError);
    return { response: NextResponse.json({ error: "Your account could not be verified." }, { status: 503 }) };
  }
  if (profile?.role !== "landlord") return { response: NextResponse.json({ error: "Only landlord accounts can manage listings." }, { status: 403 }) };
  return { supabase, userId: user.id };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await landlordListing(id);
  if ("response" in result) return result.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (body.operation === "edit") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const buildingName = typeof body.buildingName === "string" ? body.buildingName.trim() : "";
    const estate = typeof body.estate === "string" ? body.estate.trim() : "";
    const county = typeof body.county === "string" ? body.county.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const rent = Number(body.rent);
    if (title.length < 5 || title.length > 90 || description.length > 1200
      || buildingName.length > 80 || estate.length < 2 || estate.length > 80
      || county.length < 2 || county.length > 80 || address.length < 5 || address.length > 300
      || !Number.isSafeInteger(rent) || rent < 1 || rent > 100000000) {
      return NextResponse.json({ error: "Check the title, description, location, and rent fields." }, { status: 400 });
    }
    const { data, error } = await result.supabase.from("listings").update({
      title,
      description: description || null,
      building_name: buildingName || null,
      estate,
      county,
      address,
      rent_cents: rent * 100,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("id,current_status").maybeSingle();
    if (error) {
      console.error("Unable to edit landlord listing.", error);
      return NextResponse.json({ error: "Listing details could not be saved." }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    return NextResponse.json({ success: true, publicationStatus: data.current_status });
  }
  const status = LISTING_STATUSES.find((item) => item === body.status);
  if (!status) return NextResponse.json({ error: "Choose a valid availability status." }, { status: 400 });
  const availabilityDate = body.availabilityDate;
  if (status === "Soon available"
    && (typeof availabilityDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(availabilityDate)
      || !Number.isFinite(Date.parse(`${availabilityDate}T00:00:00Z`))
      || new Date(`${availabilityDate}T00:00:00Z`).toISOString().slice(0, 10) !== availabilityDate
      || availabilityDate < new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "Choose an expected availability date." }, { status: 400 });
  }
  const availabilityStatus = status === "Soon available" ? "soon_available" : status === "Taken" ? "occupied" : "available";
  const { data, error } = await result.supabase.from("listings").update({
    availability_status: availabilityStatus,
    availability_date: status === "Soon available" ? availabilityDate : null,
    last_confirmed_available_at: status === "Taken" ? null : new Date().toISOString(),
  }).eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("Unable to update listing availability.", error);
    return NextResponse.json({ error: "Listing status could not be updated." }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await landlordListing(id);
  if ("response" in result) return result.response;
  const { data: images, error: imagesError } = await result.supabase.from("listing_images").select("storage_path").eq("listing_id", id);
  if (imagesError) {
    console.error("Unable to load listing photos before deletion.", imagesError);
    return NextResponse.json({ error: "Listing photos could not be checked before removal." }, { status: 503 });
  }
  const paths = (images ?? []).map((image) => image.storage_path).filter((path): path is string => typeof path === "string" && path.startsWith(`${result.userId}/${id}/`));
  if (paths.length) {
    const { error: storageError } = await result.supabase.storage.from("listing-photos").remove(paths);
    if (storageError) {
      console.error("Unable to clean up listing photos before deletion.", storageError);
      return NextResponse.json({ error: "Listing photos could not be removed. The listing has not been deleted." }, { status: 503 });
    }
  }
  const { data, error } = await result.supabase.from("listings").delete().eq("id", id).neq("current_status", "published").select("id").maybeSingle();
  if (error) {
    console.error("Unable to delete unlisted listing.", error);
    return NextResponse.json({ error: "Listing could not be deleted." }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "Only listings that are not published can be removed." }, { status: 409 });
  return NextResponse.json({ success: true });
}
