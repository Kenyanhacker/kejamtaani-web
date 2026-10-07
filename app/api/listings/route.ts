import { NextRequest, NextResponse } from "next/server";
import { ListingFilters, searchPublishedListings } from "@/lib/listings";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const idsValue = params.get("ids");
  if (idsValue && idsValue.length > 5000) {
    return NextResponse.json({ error: "Too many saved listing IDs." }, { status: 400 });
  }
  const filters: ListingFilters = {
    q: params.get("q") ?? undefined,
    estate: params.get("estate") ?? undefined,
    type: params.get("type") ?? undefined,
    minRent: params.get("minRent") ?? undefined,
    maxRent: params.get("maxRent") ?? undefined,
    water: params.get("water") ?? undefined,
    gated: params.get("gated") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
    lat: params.get("lat") ?? undefined,
    lng: params.get("lng") ?? undefined,
    radius: params.get("radius") ?? undefined,
    ids: idsValue ? idsValue.split(",").slice(0, 60) : undefined,
  };
  const result = await searchPublishedListings(filters);
  if (result.status === "unconfigured") {
    return NextResponse.json({ error: "Live listings are not configured yet." }, { status: 503 });
  }
  if (result.status === "error") return NextResponse.json({ error: result.message }, { status: 503 });

  return NextResponse.json(
    { listings: result.listings, count: result.count },
    { headers: { "Cache-Control": idsValue ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
