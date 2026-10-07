import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { LISTING_STATUSES, ListingStatus } from "@/lib/landlord-listings";
import { TYPES } from "@/lib/data";

const AMENITIES = ["Wi-Fi", "Borehole", "Token Meter", "Parking", "Security/CCTV", "Balcony"];
const MAX_PHOTOS = 5;

function safeTourUrl(value: unknown) {
  if (value === "") return null;
  if (typeof value !== "string" || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function cleanText(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length <= maxLength && (!required || text.length > 0) ? text : undefined;
}

function availabilityStatus(value: ListingStatus) {
  if (value === "Soon available") return "soon_available";
  if (value === "Taken") return "occupied";
  return "available";
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Listing storage is not configured." }, { status: 503 });

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return NextResponse.json({ error: "Listing request is too large." }, { status: 413 });
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid listing details." }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;

  const id = typeof body.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)
    ? body.id
    : undefined;
  const title = cleanText(body.title, 90, true);
  const buildingName = cleanText(body.buildingName, 80);
  const estate = cleanText(body.estate, 80, true);
  const county = cleanText(body.county, 80, true);
  const address = cleanText(body.address, 300, true);
  const description = cleanText(body.description, 1200);
  const depositRule = cleanText(body.depositRule, 180);
  const unitType = cleanText(body.unitType, 80, true);
  const tourUrl = safeTourUrl(body.tourUrl);
  const rent = Number(body.rent);
  const latitude = body.latitude === "" ? null : Number(body.latitude);
  const longitude = body.longitude === "" ? null : Number(body.longitude);
  const status = LISTING_STATUSES.find((item) => item === body.status);
  const availabilityDate = body.availabilityDate;
  const amenities = Array.isArray(body.amenities) && body.amenities.length <= AMENITIES.length
    && body.amenities.every((item): item is string => typeof item === "string" && AMENITIES.includes(item))
    ? body.amenities
    : undefined;
  const photoPaths = Array.isArray(body.photoPaths) && body.photoPaths.length <= MAX_PHOTOS
    && body.photoPaths.every((item): item is string => typeof item === "string")
    ? body.photoPaths
    : undefined;

  if (!id || !title || !buildingName && body.buildingName !== "" || !estate || !county || !address || !description && body.description !== ""
    || !depositRule || !unitType || !TYPES.includes(unitType) || tourUrl === undefined || !status || !amenities || !photoPaths
    || !Number.isSafeInteger(rent) || rent < 1 || rent > 100000000
    || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    || latitude === null || longitude === null) {
    return NextResponse.json({ error: "Check the listing details and try again." }, { status: 400 });
  }
  if (status === "Soon available"
    && (typeof availabilityDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(availabilityDate)
      || !Number.isFinite(Date.parse(`${availabilityDate}T00:00:00Z`))
      || new Date(`${availabilityDate}T00:00:00Z`).toISOString().slice(0, 10) !== availabilityDate
      || availabilityDate < new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "Choose a valid expected availability date." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in as a landlord to save a listing." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) {
    console.error("Unable to verify landlord role.", profileError);
    return NextResponse.json({ error: "Your account could not be verified." }, { status: 503 });
  }
  if (profile?.role !== "landlord") return NextResponse.json({ error: "Only landlord accounts can create listings." }, { status: 403 });

  const expectedPrefix = `${user.id}/${id}/`;
  if (photoPaths.some((path) => !path.startsWith(expectedPrefix) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(path.slice(expectedPrefix.length)))
    || new Set(photoPaths).size !== photoPaths.length) {
    return NextResponse.json({ error: "One or more photo paths are invalid." }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("listings").insert({
    id,
    landlord_id: user.id,
    title,
    building_name: buildingName || null,
    estate,
    county,
    address,
    latitude,
    longitude,
    property_type: unitType,
    rent_cents: rent * 100,
    availability_status: availabilityStatus(status),
    availability_date: status === "Soon available" ? availabilityDate : null,
    amenities,
    wifi_available: amenities.includes("Wi-Fi"),
    parking: amenities.includes("Parking"),
    cctv: amenities.includes("Security/CCTV"),
    gated: false,
    deposit_rule: depositRule,
    description: description || null,
    tour_url: tourUrl,
    current_status: "pending_review",
    is_demo: false,
  });
  if (insertError) {
    console.error("Unable to save landlord listing.", insertError);
    return NextResponse.json({ error: "The listing could not be saved. Please try again." }, { status: 503 });
  }

  if (photoPaths.length) {
    const images = photoPaths.map((path, index) => {
      const imageId = crypto.randomUUID();
      return {
        id: imageId,
        listing_id: id,
        url: `/api/listing-images/${imageId}`,
        storage_path: path,
        is_primary: index === 0,
        is_approved: false,
      };
    });
    const { error: imageError } = await supabase.from("listing_images").insert(images);
    if (imageError) {
      console.error("Unable to attach listing photos.", imageError);
      const { error: rollbackError } = await supabase.from("listings").delete().eq("id", id);
      if (rollbackError) console.error("Unable to roll back listing after photo failure.", rollbackError);
      const { error: storageError } = await supabase.storage.from("listing-photos").remove(photoPaths);
      if (storageError) console.error("Unable to clean up listing photos after failure.", storageError);
      return NextResponse.json({ error: "Photos could not be attached. Please submit the listing again." }, { status: 503 });
    }
  }

  return NextResponse.json({ id }, { status: 201 });
}
