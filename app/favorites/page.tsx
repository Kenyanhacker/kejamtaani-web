"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ListingCard from "@/components/ListingCard";
import { Listing } from "@/lib/listings";
import { getFavoriteIds, subscribeToFavorites } from "@/lib/favorites";

export default function FavoritesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setFavoriteIds(getFavoriteIds());
    sync();
    return subscribeToFavorites(sync);
  }, []);

  useEffect(() => {
    let active = true;
    if (favoriteIds.length === 0) {
      setListings([]);
      setError("");
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    const params = new URLSearchParams({ ids: favoriteIds.join(",") });
    fetch(`/api/listings?${params.toString()}`)
      .then(async (response) => {
        const result: { listings?: Listing[]; error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Saved homes could not be loaded.");
        if (active) {
          setListings(result.listings ?? []);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        console.error("Unable to load saved listings.", cause);
        if (active) setError(cause instanceof Error ? cause.message : "Saved homes could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [favoriteIds]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Saved properties</h1>
      <p className="mt-1 text-sm text-neutral-500">Your saved homes stay on this device.</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      {loading && <p role="status" className="mt-6 text-sm text-neutral-500">Loading saved homes…</p>}
      {!loading && !error && listings.length > 0 && <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing) => <ListingCard key={listing.id} l={listing} />)}
      </div>}
      {!loading && !error && listings.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-lg font-medium text-neutral-800">No saved homes yet.</p>
          <p className="mt-2 text-neutral-500">Save an available listing with the heart button and it will appear here.</p>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800">Explore homes</Link>
        </div>
      )}
    </main>
  );
}
