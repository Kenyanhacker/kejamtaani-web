"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SearchItem = { id: string; name: string; filters: Record<string, string>; created_at: string };

export default function SavedSearches() {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/saved-searches").then(async (response) => {
      const result = await response.json() as { error?: string; searches?: SearchItem[] };
      if (!response.ok) throw new Error(result.error ?? "Saved searches could not be loaded.");
      setItems(result.searches ?? []);
    }).catch((cause: unknown) => {
      console.error("Unable to load saved searches.", cause);
      setError(cause instanceof Error ? cause.message : "Saved searches could not be loaded.");
    }).finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    setError("");
    try {
      const response = await fetch(`/api/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Saved search could not be removed.");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved search could not be removed.");
    }
  };

  if (loading) return <p role="status" className="mt-4 text-sm text-neutral-500">Loading saved searches…</p>;
  return <section className="mt-8">
    <h2 className="text-lg font-semibold">Saved searches</h2>
    <p className="mt-1 text-xs text-neutral-500">Email alerts are not configured yet; revisit a saved filter any time.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
    {items.length === 0
      ? <p className="mt-3 rounded-xl border bg-white p-4 text-sm text-neutral-600">You have not saved a search yet.</p>
      : <ul className="mt-3 grid gap-3 sm:grid-cols-2">{items.map((item) => {
        const params = new URLSearchParams(item.filters);
        return <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <div>
            <Link href={`/?${params.toString()}`} className="font-semibold text-emerald-900 underline">{item.name}</Link>
            <p className="mt-1 text-xs text-slate-500">Saved {new Date(item.created_at).toLocaleDateString("en-KE")}</p>
          </div>
          <button type="button" onClick={() => void remove(item.id)} aria-label={`Remove saved search ${item.name}`} className="text-sm text-rose-800 underline">Remove</button>
        </li>;
      })}</ul>}
  </section>;
}
