import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import InteractiveMap from "@/components/InteractiveMap";
import SearchFilterBar from "@/components/SearchFilterBar";
import { ListingFilters, searchPublishedListings } from "@/lib/listings";

type SearchParams = ListingFilters & { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function validBudget(value: string | undefined) {
  if (!value || !/^\d{1,7}$/.test(value)) return undefined;
  return String(Math.min(Number(value), 1000000));
}

function validPage(value: string | undefined) {
  if (!value || !/^\d{1,5}$/.test(value)) return undefined;
  return String(Math.min(Number(value), 10000));
}

function validCoordinate(value: string | undefined, min: number, max: number) {
  if (!value || value.length > 20) return undefined;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? String(coordinate) : undefined;
}

function validRadius(value: string | undefined) {
  return value === "2" || value === "5" || value === "10" ? value : undefined;
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters: ListingFilters = {
    q: first(params.q)?.slice(0, 80),
    estate: first(params.estate)?.slice(0, 60),
    type: first(params.type),
    minRent: validBudget(first(params.minRent)),
    maxRent: validBudget(first(params.maxRent)),
    water: first(params.water),
    gated: first(params.gated),
    sort: first(params.sort),
    page: validPage(first(params.page)),
    lat: validCoordinate(first(params.lat), -90, 90),
    lng: validCoordinate(first(params.lng), -180, 180),
    radius: validRadius(first(params.radius)),
  };
  if (Boolean(filters.lat) !== Boolean(filters.lng) || (filters.lat && !filters.radius) || (!filters.lat && filters.radius)) {
    filters.lat = undefined;
    filters.lng = undefined;
    filters.radius = undefined;
  }
  if (filters.minRent && filters.maxRent && Number(filters.minRent) > Number(filters.maxRent)) {
    filters.minRent = undefined;
    filters.maxRent = undefined;
  }
  const result = await searchPublishedListings(filters);
  const hasFilters = [filters.q, filters.estate, filters.type, filters.minRent, filters.maxRent, filters.water, filters.gated === "1" ? "gated" : "", filters.lat].some(Boolean);
  const currentPage = Number.parseInt(filters.page ?? "0", 10) || 0;
  const pageCount = result.status === "ready" ? Math.ceil(result.count / 24) : 0;
  const pageLink = (page: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "page" && typeof value === "string" && value) search.set(key, value);
    }
    if (page > 0) search.set("page", String(page));
    const query = search.toString();
    return query ? `/?${query}` : "/";
  };
  if (result.status === "ready" && currentPage > 0 && (pageCount === 0 || currentPage >= pageCount)) {
    redirect(pageLink(Math.max(0, pageCount - 1)));
  }
  const activeFilters = [
    filters.q && `“${filters.q}”`,
    filters.estate,
    filters.type,
    filters.minRent && `Min KSh ${Number(filters.minRent).toLocaleString("en-KE")}`,
    filters.maxRent && `Max KSh ${Number(filters.maxRent).toLocaleString("en-KE")}`,
    filters.water,
    filters.gated === "1" && "Gated community",
    filters.lat && `Within ${filters.radius} km of map pin`,
  ].filter((value): value is string => Boolean(value));
  const mapListings = result.status === "ready"
    ? result.listings.flatMap((listing) => listing.latitude !== null && listing.longitude !== null
      ? [{ id: listing.id, title: listing.title, estate: listing.estate, rent: listing.rent, lat: listing.latitude, lng: listing.longitude }]
      : [])
    : [];
  const browseTypes = [
    { type: "Single Room", label: "Single rooms" },
    { type: "Bedsitter", label: "Bedsitters" },
    { type: "Studio", label: "Studios" },
    { type: "One-bedroom apartment", label: "1 bedroom" },
    { type: "Two-bedroom apartment", label: "2 bedrooms" },
    { type: "Three-bedroom and larger units", label: "3+ bedrooms" },
    { type: "Servant quarters", label: "Servant quarters" },
    { type: "Maisonette", label: "Maisonettes" },
    { type: "House with own compound", label: "Own compound" },
  ];
  const browseLink = (type: string) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "type" && key !== "page" && typeof value === "string" && value) search.set(key, value);
    }
    search.set("type", type);
    return `/?${search.toString()}`;
  };

  return (
    <main>
      <section className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-4 pb-10 pt-10 text-white sm:pb-14 sm:pt-14">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-emerald-200">Find a place that feels like home</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Find your next keja.</h1>
          <p className="mt-3 max-w-2xl text-sm text-emerald-50 sm:text-base">Choose an area, set your budget, and explore real homes published by landlords.</p>
          <div className="mt-7">
            <SearchFilterBar p={filters} neighborhoods={result.status === "ready" ? result.neighborhoods : []} mapListings={mapListings} />
          </div>
          <nav aria-label="Browse by home type" className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Browse home types</h2>
              <Link href="/" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-100 underline underline-offset-2">All homes <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="noscroll flex gap-2 overflow-x-auto pb-1">
              {browseTypes.map(({ type, label }) => <Link
                key={type}
                href={browseLink(type)}
                aria-current={filters.type === type ? "page" : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${filters.type === type ? "border-white bg-white text-emerald-950" : "border-white/25 bg-white/10 text-white hover:border-white/60 hover:bg-white/20"}`}
              >{label}</Link>)}
            </div>
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Available homes</h2>
            {result.status === "ready" && <p className="mt-1 text-sm text-slate-500">{result.count} {result.count === 1 ? "home" : "homes"}{hasFilters ? " match your search" : " currently listed"}</p>}
          </div>
          {hasFilters && <Link href="/" className="text-sm font-medium text-emerald-800 underline underline-offset-2">Clear all filters</Link>}
        </div>

        {result.status === "unconfigured" && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <h3 className="font-semibold">Live home search isn’t connected yet</h3>
            <p className="mt-1">The demo rentals have been removed. Published homes will appear here after the site owner connects Supabase and adds real listings.</p>
          </div>
        )}
        {result.status === "error" && <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{result.message}</p>}

        {result.status === "ready" && result.listings.length > 0 && <>
          {activeFilters.length > 0 && <ul aria-label="Active filters" className="mt-4 flex flex-wrap gap-2">
            {activeFilters.map((filter) => <li key={filter} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900">{filter}</li>)}
          </ul>}
          {filters.lat && <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="h-[360px] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
              <InteractiveMap
                selectedPoint={{ lat: Number(filters.lat), lng: Number(filters.lng) }}
                radiusKm={Number(filters.radius)}
                listings={mapListings}
                selectable={false}
                heightClassName="h-full"
                zoom={12}
              />
            </div>
            <div className="grid content-start gap-x-5 gap-y-8 sm:grid-cols-2">
              {result.listings.map((listing) => <ListingCard key={listing.id} l={listing} />)}
            </div>
          </div>}
          {!filters.lat && <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.listings.map((listing) => <ListingCard key={listing.id} l={listing} />)}
          </div>}
          {pageCount > 1 && <nav aria-label="Search result pages" className="mt-8 flex items-center justify-center gap-4">
            <Link aria-disabled={currentPage === 0} tabIndex={currentPage === 0 ? -1 : undefined} className={`rounded-xl border px-4 py-2 text-sm ${currentPage === 0 ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={pageLink(Math.max(0, currentPage - 1))}>Previous</Link>
            <span className="text-sm text-slate-600">Page {currentPage + 1} of {pageCount}</span>
            <Link aria-disabled={currentPage + 1 >= pageCount} tabIndex={currentPage + 1 >= pageCount ? -1 : undefined} className={`rounded-xl border px-4 py-2 text-sm ${currentPage + 1 >= pageCount ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={pageLink(Math.min(pageCount - 1, currentPage + 1))}>Next</Link>
          </nav>}
        </>}

        {result.status === "ready" && result.listings.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <Search aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{hasFilters ? "No homes match those filters" : "No homes have been published yet"}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{hasFilters ? "Try a wider budget, another area, or a different home type." : "Check back soon. New homes will appear here once landlords publish them."}</p>
            {hasFilters && <Link href="/" className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Show all available homes</Link>}
          </div>
        )}
      </section>
    </main>
  );
}
