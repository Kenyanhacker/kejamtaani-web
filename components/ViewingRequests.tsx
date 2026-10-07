"use client";

import { useEffect, useState } from "react";

type RequestItem = {
  id: string;
  listing_id: string | null;
  tenant_name: string;
  tenant_phone: string;
  preferred_date: string | null;
  preferred_time: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

export default function ViewingRequests({ titles = {} }: { titles?: Record<string, string> }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = () => fetch("/api/viewing-requests").then(async (response) => {
    const result = await response.json() as { error?: string; requests?: RequestItem[]; role?: string };
    if (!response.ok) throw new Error(result.error ?? "Viewing requests could not be loaded.");
    setRequests(result.requests ?? []);
    setRole(result.role ?? "");
  }).catch((cause: unknown) => {
    console.error("Unable to load viewing requests.", cause);
    setError(cause instanceof Error ? cause.message : "Viewing requests could not be loaded.");
  }).finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const update = async (id: string, status: string) => {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/viewing-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Request status could not be updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request status could not be updated.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) return <p role="status" className="mt-4 text-sm text-neutral-500">Loading viewing requests…</p>;
  return <section className="mt-8">
    <h2 className="text-lg font-semibold">Viewing requests</h2>
    {error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {requests.length === 0
      ? <p className="mt-3 rounded-xl border bg-white p-4 text-sm text-neutral-600">No viewing requests yet.</p>
      : <ul className="mt-3 grid gap-3">{requests.map((item) => <li key={item.id} className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <h3 className="font-semibold">{item.listing_id ? titles[item.listing_id] ?? "Rental listing" : "Removed listing"}</h3>
            <p className="mt-1 text-sm text-neutral-600">{role === "landlord" ? <>{item.tenant_name} · <a href={`tel:${item.tenant_phone}`} className="text-emerald-800 underline">{item.tenant_phone}</a></> : `Preferred ${item.preferred_date ?? "date not specified"} · ${item.preferred_time ?? ""}`}</p>
            {role === "landlord" && <p className="mt-1 text-sm text-neutral-600">Preferred {item.preferred_date ?? "date not specified"} · {item.preferred_time ?? ""}</p>}
            {item.message && <p className="mt-2 text-sm">{item.message}</p>}
          </div>
          <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{STATUS_LABELS[item.status] ?? item.status}</span>
        </div>
        {role === "landlord" && item.status === "pending" && <div className="mt-3 flex gap-2">
          <button type="button" disabled={busyId === item.id} onClick={() => void update(item.id, "accepted")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept</button>
          <button type="button" disabled={busyId === item.id} onClick={() => void update(item.id, "declined")} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Decline</button>
        </div>}
        {role === "landlord" && item.status === "accepted" && <button type="button" disabled={busyId === item.id} onClick={() => void update(item.id, "completed")} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Mark completed</button>}
        {role === "tenant" && (item.status === "pending" || item.status === "accepted") && <button type="button" disabled={busyId === item.id} onClick={() => void update(item.id, "cancelled")} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Cancel request</button>}
      </li>)}</ul>}
  </section>;
}
