"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, Heart, MapPin } from "lucide-react";
import { Listing } from "@/lib/listings";
import { ksh } from "@/lib/data";
import { getFavoriteIds, setFavoriteIds, subscribeToFavorites } from "@/lib/favorites";

export default function ListingCard({ l }: { l: Listing }) {
  const ref = useRef<HTMLDivElement>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    const syncFavorite = () => setFavorite(getFavoriteIds().includes(l.id));
    syncFavorite();
    return subscribeToFavorites(syncFavorite);
  }, [l.id]);

  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const movePhoto = (direction: number) => (event: React.MouseEvent) => {
    stop(event);
    const next = Math.max(0, Math.min(l.photos.length - 1, imageIndex + direction));
    setImageIndex(next);
    ref.current?.scrollTo({ left: next * ref.current.clientWidth, behavior: "smooth" });
  };
  const toggleFavorite = (event: React.MouseEvent) => {
    stop(event);
    const favorites = getFavoriteIds();
    setFavoriteIds(favorites.includes(l.id) ? favorites.filter((id) => id !== l.id) : [...favorites, l.id]);
  };

  return (
    <article className="group min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
        {l.photos.length > 0 ? (
          <div ref={ref} onScroll={(event) => setImageIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))} className="noscroll flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth">
            {l.photos.map((photo, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo} src={photo} alt={`${l.title} property photo ${index + 1}`} loading="lazy" className="h-full w-full shrink-0 snap-center object-cover" />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400" aria-label="No property photos available">
            <Building2 aria-hidden="true" className="h-10 w-10" />
            <span className="text-xs">Photos coming soon</span>
          </div>
        )}
        <Link href={`/property/${l.id}`} className="absolute inset-0 z-0" aria-label={`${l.title}, ${l.estate}, ${ksh(l.rent)} per month`} />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">{l.type}</span>
        {l.availabilityStatus !== "available" && <span className={`pointer-events-none absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${l.availabilityStatus === "soon_available" ? "bg-sky-100 text-sky-950" : "bg-amber-100 text-amber-950"}`}>{l.availabilityStatus === "soon_available" ? "Soon available" : "Under negotiation"}</span>}
        <button type="button" onClick={toggleFavorite} aria-label={favorite ? "Remove from saved properties" : "Save property"} aria-pressed={favorite} className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 shadow-sm hover:scale-105">
          <Heart aria-hidden="true" className={`h-5 w-5 ${favorite ? "fill-rose-500 stroke-rose-500" : "stroke-slate-700"}`} />
        </button>
        {l.photos.length > 1 && <>
          <button type="button" onClick={movePhoto(-1)} disabled={imageIndex === 0} aria-label="Previous property photo" className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={movePhoto(1)} disabled={imageIndex === l.photos.length - 1} aria-label="Next property photo" className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </>}
      </div>
      <Link href={`/property/${l.id}`} className="mt-3 block space-y-1.5 focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
          <h2 className="line-clamp-1 font-semibold text-slate-900">{l.title}</h2>
          <p className="flex items-center gap-1 text-sm text-slate-600"><MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{[l.estate, l.constituency, l.county].filter(Boolean).join(", ")}</p>
          <p className="text-sm text-slate-500">{l.type}{l.gated ? " · Gated" : ""}{l.parking ? " · Parking" : ""}</p>
          <p className="pt-1"><b className="text-slate-900">{ksh(l.rent)}</b> <span className="text-sm text-slate-500">/ month</span></p>
          {l.availabilityStatus === "soon_available" && l.availabilityDate && <p className="text-xs font-medium text-sky-900">Expected available {new Date(`${l.availabilityDate}T00:00:00`).toLocaleDateString("en-KE")}</p>}
          {l.availabilityStatus !== "under_negotiation" && l.lastConfirmedAvailableAt && <p className="text-xs text-slate-500">Availability confirmed {new Date(l.lastConfirmedAvailableAt).toLocaleDateString("en-KE")}</p>}
      </Link>
    </article>
  );
}
