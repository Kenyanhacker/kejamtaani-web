"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Interaction = {
  id: string;
  listing_id: string;
  landlord_id: string | null;
  interaction_type: string;
  created_at: string;
  direction: "lead" | "activity";
};

const LABELS: Record<string, string> = {
  listing_view: "Viewed property",
  whatsapp_click: "Opened WhatsApp enquiry",
  phone_click: "Tapped landlord phone",
  viewing_request: "Requested a viewing on WhatsApp",
};

export default function InteractionHistory() {
  const [items, setItems] = useState<Interaction[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/interactions")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load interaction history.");
        setItems(result.interactions as Interaction[]);
      })
      .catch((cause: unknown) => {
        console.error("Unable to load interaction history.", cause);
        setError(cause instanceof Error ? cause.message : "Interaction history is temporarily unavailable.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p role="status" className="mt-6 text-sm text-neutral-500">Loading interaction history…</p>;
  if (error) return <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>;
  if (items.length === 0) return <p className="mt-6 rounded-xl border bg-white p-5 text-sm text-neutral-600">No interactions recorded yet. Open a property and contact its landlord while signed in to save an activity here.</p>;

  return (
    <ul className="mt-6 divide-y rounded-2xl border bg-white">
      {items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <span><b>{item.direction === "lead" ? "Lead" : "You"}:</b> {LABELS[item.interaction_type] ?? "Property interaction"} · <Link href={`/property/${encodeURIComponent(item.listing_id)}`} className="underline">Property details</Link></span>
        <time dateTime={item.created_at} className="text-xs text-neutral-500">{new Date(item.created_at).toLocaleString("en-KE")}</time>
      </li>)}
    </ul>
  );
}
