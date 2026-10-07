"use client";

import Link from "next/link";
import { useState } from "react";

type Filters = Record<string, string | undefined>;

export default function SaveSearchButton({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))) as Record<string, string>;

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: cleanFilters }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Search could not be saved.");
      setMessage("Search saved to your account. Email alerts are not active yet.");
      setOpen(false);
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="mt-3">
    <button type="button" onClick={() => setOpen((current) => !current)} className="text-sm font-medium text-emerald-900 underline">Save these filters</button>
    {open && <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
      <label className="min-w-48 flex-1 text-xs font-semibold">Search name
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Bedsitters near Umoja" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
      </label>
      <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save search"}</button>
      <p className="w-full text-xs text-slate-500">This saves your filters only. Email alerts are not yet configured.</p>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error} {error.startsWith("Sign in") && <Link href="/auth?next=/dashboard/tenant" className="underline">Sign in</Link>}</p>}
    {message && <p role="status" className="mt-2 text-sm text-emerald-800">{message}</p>}
  </div>;
}
