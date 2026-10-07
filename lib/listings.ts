import { createClient } from "@supabase/supabase-js";
import { TYPES } from "@/lib/data";

export type Listing = {
  id: string;
  title: string;
  estate: string;
  constituency: string;
  county: string;
  type: string;
  rent: number;
  depositMonths: number;
  garbage: number;
  waterDeposit: number;
  water: string;
  power: string;
  gated: boolean;
  cctv: boolean;
  guard: boolean;
  wifi: string[];
  parking: boolean;
  description: string;
  photos: string[];
  createdAt: string;
  availabilityDate: string | null;
  lastConfirmedAvailableAt: string | null;
  availabilityStatus: "available" | "soon_available" | "under_negotiation";
  buildingName: string;
  address: string;
  amenities: string[];
  depositRule: string;
  tourUrl: string;
  latitude: number | null;
  longitude: number | null;
};

export type ListingFilters = {
  q?: string;
  estate?: string;
  type?: string;
  minRent?: string;
  maxRent?: string;
  water?: string;
  gated?: string;
  sort?: string;
  ids?: string[];
  page?: string;
  lat?: string;
  lng?: string;
  radius?: string;
};

export type ListingSearchResult =
  | { status: "ready"; listings: Listing[]; count: number; neighborhoods: string[] }
  | { status: "unconfigured"; listings: []; count: 0; neighborhoods: [] }
  | { status: "error"; listings: []; count: 0; neighborhoods: []; message: string };

const COLUMNS = "id,title,building_name,address,estate,constituency,county,property_type,rent_cents,deposit_months,garbage_fee_cents,water_deposit_cents,water_supply,electricity_arrangement,gated,cctv,security_guard,wifi_available,parking,description,created_at,availability_status,availability_date,last_confirmed_available_at,expires_at,amenities,deposit_rule,tour_url,latitude,longitude";
const PAGE_SIZE = 24;
const MAX_RESULTS = 60;

function publicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function positiveAmount(value: string | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function safeSearchText(value: string | undefined) {
  return (value ?? "").normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().slice(0, 80);
}

function validCoordinate(value: string | undefined, min: number, max: number) {
  if (!value || value.length > 20) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function validRadius(value: string | undefined) {
  return value === "2" || value === "5" || value === "10" ? Number(value) : null;
}

function approximateCoordinate(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

export async function searchPublishedListings(filters: ListingFilters = {}): Promise<ListingSearchResult> {
  const supabase = publicSupabaseClient();
  if (!supabase) return { status: "unconfigured", listings: [], count: 0, neighborhoods: [] };

  try {
    const ids = (filters.ids ?? []).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)).slice(0, MAX_RESULTS);
    if (filters.ids && ids.length === 0) return { status: "ready", listings: [], count: 0, neighborhoods: [] };
    const page = filters.ids ? 0 : Math.min(10000, Math.max(0, Number.parseInt(filters.page ?? "0", 10) || 0));
    const centerLat = validCoordinate(filters.lat, -90, 90);
    const centerLng = validCoordinate(filters.lng, -180, 180);
    const radiusKm = validRadius(filters.radius);
    if ((filters.lat || filters.lng || filters.radius)
      && (centerLat === null || centerLng === null || radiusKm === null)) {
      return { status: "error", listings: [], count: 0, neighborhoods: [], message: "The map location is invalid. Pick a point on the map and choose a 2, 5, or 10 km radius." };
    }

    let query = supabase
      .from("listings")
      .select(COLUMNS, { count: "exact" })
      .eq("current_status", "published")
      .eq("is_demo", false)
      .neq("availability_status", "occupied")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (ids.length) query = query.in("id", ids);

    const estate = safeSearchText(filters.estate);
    const searchText = safeSearchText(filters.q);
    if (estate) query = query.ilike("estate", estate);
    if (searchText) query = query.or(`title.ilike.%${searchText}%,estate.ilike.%${searchText}%,county.ilike.%${searchText}%,constituency.ilike.%${searchText}%,description.ilike.%${searchText}%`);
    if (TYPES.includes(filters.type ?? "")) query = query.eq("property_type", filters.type!);
    const min = positiveAmount(filters.minRent);
    const max = positiveAmount(filters.maxRent);
    if (min !== null) query = query.gte("rent_cents", min);
    if (max !== null) query = query.lte("rent_cents", max);
    if (filters.water && filters.water.length <= 40) query = query.eq("water_supply", filters.water);
    if (filters.gated === "1") query = query.eq("gated", true);

    let data: Awaited<typeof query>["data"] = null;
    let count: number | null = null;
    if (!filters.ids && centerLat !== null && centerLng !== null && radiusKm !== null) {
      const { data: nearby, error } = await supabase.rpc("search_listings_within_radius", {
        center_lat: centerLat,
        center_lng: centerLng,
        radius_km: radiusKm,
        search_text: searchText || null,
        estate_filter: estate || null,
        type_filter: TYPES.includes(filters.type ?? "") ? filters.type! : null,
        minimum_rent_cents: min,
        maximum_rent_cents: max,
        water_filter: filters.water && filters.water.length <= 40 ? filters.water : null,
        gated_only: filters.gated === "1",
        sort_order: filters.sort === "price-asc" || filters.sort === "price-desc" ? filters.sort : "newest",
        page_number: page,
        page_size: PAGE_SIZE,
      }).single();
      if (error) throw error;
      if (!nearby || typeof nearby !== "object" || !("listing_ids" in nearby) || !("total_count" in nearby)
        || !Array.isArray(nearby.listing_ids)
        || !nearby.listing_ids.every((id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) {
        throw new Error("Nearby search returned an invalid result.");
      }
      const nearbyIds = nearby.listing_ids;
      count = Number(nearby.total_count);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Nearby search returned an invalid result count.");
      if (nearbyIds.length) {
        const { data: foundRows, error: listingError } = await query.in("id", nearbyIds);
        if (listingError) throw listingError;
        const positions = new Map(nearbyIds.map((id, index) => [id, index]));
        data = [...(foundRows ?? [])].sort((left, right) => (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0));
      } else {
        data = [];
      }
    } else {
      if (filters.sort === "price-asc") query = query.order("rent_cents", { ascending: true }).order("id", { ascending: true });
      else if (filters.sort === "price-desc") query = query.order("rent_cents", { ascending: false }).order("id", { ascending: true });
      else query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
      const response = await (filters.ids ? query.limit(MAX_RESULTS) : query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1));
      if (response.error) throw response.error;
      data = response.data;
      count = response.count;
    }

    const locations = filters.ids
      ? { data: [], error: null }
      : await supabase.from("listings").select("estate").eq("current_status", "published").eq("is_demo", false).not("estate", "is", null).limit(500);
    if (locations.error) throw locations.error;

    const rows = data ?? [];
    const rowIds = rows.map((row) => row.id);
    const imagesResult = rowIds.length
      ? await supabase.from("listing_images").select("id,listing_id,url,is_primary").in("listing_id", rowIds).eq("is_approved", true).order("is_primary", { ascending: false })
      : { data: [], error: null };
    if (imagesResult.error) throw imagesResult.error;

    const photosByListing = new Map<string, string[]>();
    for (const image of imagesResult.data ?? []) {
      const photos = photosByListing.get(image.listing_id) ?? [];
      photos.push(`/api/listing-images/${image.id}`);
      photosByListing.set(image.listing_id, photos);
    }

    const neighborhoods = Array.from(new Set((locations.data ?? [])
      .map((row) => row.estate)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
      .sort((a, b) => a.localeCompare(b));

    const listings: Listing[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      estate: row.estate ?? "Location not provided",
      constituency: row.constituency ?? "",
      county: row.county ?? "",
      type: row.property_type,
      rent: Math.round(Number(row.rent_cents) / 100),
      depositMonths: row.deposit_months ?? 1,
      garbage: Math.round(Number(row.garbage_fee_cents ?? 0) / 100),
      waterDeposit: Math.round(Number(row.water_deposit_cents ?? 0) / 100),
      water: row.water_supply ?? "Not specified",
      power: row.electricity_arrangement ?? "Not specified",
      gated: row.gated ?? false,
      cctv: row.cctv ?? false,
      guard: row.security_guard ?? false,
      wifi: row.wifi_available ? ["Wi-Fi"] : [],
      parking: row.parking ?? false,
      description: row.description ?? "",
      photos: photosByListing.get(row.id) ?? [],
      createdAt: row.created_at,
      availabilityDate: row.availability_date ?? null,
      lastConfirmedAvailableAt: row.last_confirmed_available_at ?? null,
      availabilityStatus: row.availability_status === "soon_available"
        ? "soon_available"
        : row.availability_status === "under_negotiation" ? "under_negotiation" : "available",
      buildingName: row.building_name ?? "",
      address: row.address ?? "",
      amenities: Array.isArray(row.amenities) ? row.amenities : [],
      depositRule: row.deposit_rule ?? "",
      tourUrl: row.tour_url ?? "",
      latitude: approximateCoordinate(row.latitude),
      longitude: approximateCoordinate(row.longitude),
    }));

    return { status: "ready", listings, count: count ?? listings.length, neighborhoods };
  } catch (error) {
    console.error("Unable to search published listings.", error);
    return {
      status: "error",
      listings: [],
      count: 0,
      neighborhoods: [],
      message: "Listings are temporarily unavailable. Please try again shortly.",
    };
  }
}
