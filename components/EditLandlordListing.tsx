"use client";

import { FormEvent, useState } from "react";

export type EditableListing = {
  id: string;
  title: string;
  description: string;
  buildingName: string;
  estate: string;
  county: string;
  address: string;
  rent: number;
};

export default function EditLandlordListing({ listing, onSaved }: { listing: EditableListing; onSaved: (listing: EditableListing, publicationStatus?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(listing);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key: keyof EditableListing, value: string) => {
    setValues((current) => ({ ...current, [key]: key === "rent" ? Number(value) : value }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/landlord/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "edit", ...values }),
      });
      const result = await response.json() as { error?: string; publicationStatus?: string };
      if (!response.ok) throw new Error(result.error ?? "Listing could not be updated.");
      onSaved(values, result.publicationStatus);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Listing could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return <div>
    <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50">Edit details</button>
    {open && <form onSubmit={save} className="mt-3 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
      <label className="text-xs font-semibold sm:col-span-2">Title<input required minLength={5} maxLength={90} value={values.title} onChange={(event) => update("title", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">Neighbourhood<input required minLength={2} maxLength={80} value={values.estate} onChange={(event) => update("estate", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">County<input required minLength={2} maxLength={80} value={values.county} onChange={(event) => update("county", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">Directions / address<textarea required minLength={5} maxLength={300} value={values.address} onChange={(event) => update("address", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">Description<textarea maxLength={1200} value={values.description} onChange={(event) => update("description", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">Building / estate name<input maxLength={80} value={values.buildingName} onChange={(event) => update("buildingName", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">Monthly rent (KSh)<input required type="number" min={1} max={100000000} step={1} value={values.rent} onChange={(event) => update("rent", event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
        {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
        <p className="mt-2 text-xs text-slate-600">Changes to a published listing send it back for review before tenants can see it again.</p>
      </div>
    </form>}
  </div>;
}
