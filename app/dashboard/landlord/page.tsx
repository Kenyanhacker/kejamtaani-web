import LandlordListings, { DashboardListing } from "@/components/LandlordListings";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ViewingRequests from "@/components/ViewingRequests";

export const dynamic = "force-dynamic";

export default async function LandlordDashboardPage() {
  if (!hasSupabaseConfig()) redirect("/auth?setup=required");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/dashboard/landlord");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || !profile) {
    console.error("Unable to load landlord profile.", error);
    return <main className="mx-auto max-w-5xl px-4 py-10"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your account profile could not be loaded. Confirm the database setup from the hosting checklist.</p></main>;
  }
  if (profile.role !== "landlord") redirect("/dashboard/tenant");
  const { data: rows, error: listingsError } = await supabase
    .from("listings")
    .select("id,title,description,address,building_name,property_type,estate,county,rent_cents,availability_status,availability_date,last_confirmed_available_at,current_status,created_at")
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: false });
  if (listingsError) {
    console.error("Unable to load landlord listings.", listingsError);
    return <LandlordListings listings={[]} loadError="Your listings could not be loaded. Confirm the database schema is current, then try again." />;
  }
  const ids = (rows ?? []).map((row) => row.id);
  const { data: images, error: imagesError } = ids.length
    ? await supabase.from("listing_images").select("listing_id,url,is_primary").in("listing_id", ids).order("is_primary", { ascending: false })
    : { data: [], error: null };
  if (imagesError) {
    console.error("Unable to load landlord listing images.", imagesError);
    return <LandlordListings listings={[]} loadError="Your listing photos could not be loaded. Confirm the database schema is current, then try again." />;
  }
  const photosByListing = new Map<string, string[]>();
  for (const image of images ?? []) {
    const photos = photosByListing.get(image.listing_id) ?? [];
    photos.push(image.url);
    photosByListing.set(image.listing_id, photos);
  }
  const listings: DashboardListing[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    address: row.address ?? "",
    buildingName: row.building_name ?? "",
    unitType: row.property_type,
    estate: row.estate ?? "",
    county: row.county ?? "",
    rent: Math.round(Number(row.rent_cents) / 100),
    availability: row.availability_status === "soon_available" || row.availability_status === "under_negotiation"
      ? "Soon available"
      : row.availability_status === "occupied" ? "Taken" : "Available",
    availabilityDate: row.availability_date,
    lastConfirmedAvailableAt: row.last_confirmed_available_at,
    publicationStatus: row.current_status,
    createdAt: row.created_at,
    photos: photosByListing.get(row.id) ?? [],
  }));
  return <>
    <LandlordListings listings={listings} />
    <div className="mx-auto max-w-5xl px-4"><ViewingRequests titles={Object.fromEntries(listings.map((listing) => [listing.id, listing.title]))} /></div>
  </>;
}
