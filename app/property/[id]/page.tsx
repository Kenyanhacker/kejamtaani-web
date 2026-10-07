import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, Droplets, MapPin, MessageCircle, ShieldCheck, Wifi, Zap } from "lucide-react";
import BookViewing from "@/components/BookViewing";
import ReportListing from "@/components/ReportListing";
import RecordListingView from "@/components/RecordListingView";
import InteractiveMap from "@/components/InteractiveMap";
import { ksh } from "@/lib/data";
import { searchPublishedListings } from "@/lib/listings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await searchPublishedListings({ ids: [id] });
  if (result.status !== "ready" || !result.listings[0]) return { title: "Rental home | Keja Mtaani" };
  const listing = result.listings[0];
  const description = `${listing.type} in ${listing.estate}, ${listing.county}. ${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(listing.rent)} per month.`;
  return {
    title: `${listing.title} | Keja Mtaani`,
    description,
    openGraph: { title: listing.title, description, type: "article", images: listing.photos.slice(0, 1).map((url) => ({ url })) },
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await searchPublishedListings({ ids: [id] });
  if (result.status === "ready" && result.listings.length === 0) notFound();
  const listing = result.status === "ready" ? result.listings[0] : null;

  if (!listing) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="text-sm text-emerald-800 underline">← Back to search</Link>
        <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {result.status === "unconfigured"
            ? "Live property details are not connected yet."
            : result.status === "error" ? result.message : "This home is no longer available."}
        </p>
      </main>
    );
  }

  const photos = listing.photos;
  const security = [listing.gated && "Gated community", listing.cctv && "CCTV", listing.guard && "Security guard"].filter(Boolean);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RecordListingView listingId={listing.id} />
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Back to homes</Link>
      <h1 className="mt-3 text-2xl font-semibold">{listing.title}</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600"><MapPin aria-hidden="true" className="h-4 w-4" />{[listing.estate, listing.constituency, listing.county].filter(Boolean).join(", ")}</p>
      {listing.availabilityStatus === "soon_available"
        ? <p className="mt-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-950">Soon available{listing.availabilityDate ? ` from ${new Date(`${listing.availabilityDate}T00:00:00`).toLocaleDateString("en-KE")}` : ""} — confirm the date with the landlord</p>
        : listing.availabilityStatus === "under_negotiation" && <p className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-950">Under negotiation — availability may change</p>}
      {listing.lastConfirmedAvailableAt && <p className="mt-2 text-xs text-neutral-500">Availability last confirmed {new Date(listing.lastConfirmedAvailableAt).toLocaleDateString("en-KE")}</p>}

      {photos.length > 0 ? (
        <div className="mt-5 grid gap-2 overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-3">
          {photos.slice(0, 5).map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo} src={photo} alt={`${listing.title} property photo ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} className={`max-h-[420px] min-h-48 w-full object-cover ${index === 0 ? "sm:col-span-2 lg:row-span-2" : ""}`} />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl bg-slate-100 text-slate-500">
          <Building2 aria-hidden="true" className="h-12 w-12" /><span>Landlord photos are not available yet.</span>
        </div>
      )}

      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section><h2 className="mb-2 text-lg font-semibold">{listing.type} in {listing.estate}</h2><p className="whitespace-pre-line text-neutral-600">{listing.description || "No description provided yet."}</p>{listing.address && <p className="mt-3 text-sm text-neutral-600">Directions: {listing.address}</p>}{listing.buildingName && <p className="mt-2 text-sm text-neutral-600">Building: {listing.buildingName}</p>}</section>
          <section id="move-in-costs">
            <h2 className="mb-3 text-lg font-semibold">Move-in costs</h2>
            <dl className="divide-y rounded-xl border text-sm">
              {[["Monthly rent", ksh(listing.rent)], ["Initial terms", listing.depositRule || `${listing.depositMonths} month${listing.depositMonths === 1 ? "" : "s"} security deposit`], ["Garbage fee", ksh(listing.garbage)], ["Water deposit", listing.waterDeposit ? ksh(listing.waterDeposit) : "Not specified"]].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 p-3"><dt className="text-neutral-500">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
              ))}
            </dl>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Utilities & amenities</h2>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2"><Droplets aria-hidden="true" className="h-4 w-4" /> Water: {listing.water}</li>
              <li className="flex items-center gap-2"><Zap aria-hidden="true" className="h-4 w-4" /> Electricity: {listing.power}</li>
              <li className="flex items-center gap-2"><Wifi aria-hidden="true" className="h-4 w-4" /> {listing.wifi.length ? listing.wifi.join(", ") : "Wi-Fi not specified"}</li>
              <li className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-4 w-4" /> {security.length ? security.join(", ") : "Security details not specified"}</li>
              {listing.parking && <li>Parking available</li>}
              {listing.amenities.filter((amenity) => !["Wi-Fi", "Parking", "Security/CCTV"].includes(amenity)).map((amenity) => <li key={amenity}>{amenity}</li>)}
            </ul>
          </section>
          {listing.latitude !== null && listing.longitude !== null && <section>
            <h2 className="mb-2 text-lg font-semibold">Approximate location</h2>
            <InteractiveMap
              listings={[{ id: listing.id, title: listing.title, estate: listing.estate, rent: listing.rent, lat: listing.latitude, lng: listing.longitude }]}
              heightClassName="h-72"
              zoom={14}
            />
            <p className="mt-2 text-xs text-neutral-500">The pin is approximate. Confirm exact directions with the landlord before visiting.</p>
          </section>}
          {listing.tourUrl && <section><h2 className="mb-2 text-lg font-semibold">Virtual tour</h2><a href={listing.tourUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-800 underline">Open the landlord’s tour link</a></section>}
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-xs text-amber-900"><AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />View the property and verify the landlord before paying a deposit. Keja Mtaani does not collect or hold deposits.</p>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border bg-white p-5 shadow-sm md:sticky md:top-6">
          <div>
            <p><span className="text-2xl font-bold">{ksh(listing.rent)}</span> <span className="text-neutral-500">/ month</span></p>
            <p className="mt-1 text-xs text-neutral-500">Monthly rent. One-time move-in terms are listed below.</p>
            <a href="#move-in-costs" className="mt-1 inline-block text-xs font-medium text-emerald-800 underline">See move-in costs</a>
          </div>
          <BookViewing title={listing.title} listingId={listing.id} />
          <ReportListing listingId={listing.id} />
          <a href={`https://wa.me/254758934463?text=${encodeURIComponent(`Hi Keja Mtaani customer care, I want to ask about "${listing.title}" (listing ${listing.id}).`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border py-3 font-medium hover:bg-neutral-50"><MessageCircle aria-hidden="true" className="h-4 w-4" /> Ask customer care</a>
          <p className="text-center text-xs text-neutral-500">Customer care: 0758 934 463</p>
        </aside>
      </div>
    </main>
  );
}
