"use client";

import Link from "next/link";
import { useState } from "react";
import { ksh } from "@/lib/data";
import { LISTING_STATUSES, ListingStatus } from "@/lib/landlord-listings";
import InteractionHistory from "@/components/InteractionHistory";
import SignOutButton from "@/components/SignOutButton";
import EditLandlordListing from "@/components/EditLandlordListing";
import type { EditableListing } from "@/components/EditLandlordListing";

export type DashboardListing = {
  id: string;
  title: string;
  description: string;
  address: string;
  buildingName: string;
  unitType: string;
  estate: string;
  county: string;
  rent: number;
  availability: ListingStatus;
  availabilityDate: string | null;
  lastConfirmedAvailableAt: string | null;
  publicationStatus: string;
  createdAt: string;
  photos: string[];
};

function statusLabel(status: string) {
  if (status === "published") return "Live";
  if (status === "archived") return "Archived";
  if (status === "pending_review") return "Pending review";
  return "Draft";
}

export default function LandlordListings({ listings: initialListings, loadError }: { listings: DashboardListing[]; loadError?: string }) {
  const [listings, setListings] = useState(initialListings);
  const [pendingAvailability, setPendingAvailability] = useState<Record<string, { status: ListingStatus; date: string }>>(
    () => Object.fromEntries(initialListings.map((listing) => [listing.id, {
      status: listing.availability,
      date: listing.availabilityDate ?? "",
    }])),
  );
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState(loadError ?? "");
  const [message, setMessage] = useState("");
  const liveCount = listings.filter((listing) => listing.publicationStatus === "published").length;
  const pendingCount = listings.filter((listing) => listing.publicationStatus === "pending_review").length;
  const availableCount = listings.filter((listing) => listing.availability === "Available").length;

  const updateStatus = async (listing: DashboardListing, status: ListingStatus, availabilityDate?: string) => {
    setBusyId(listing.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/landlord/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, availabilityDate }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Listing status could not be updated.");
      setListings((current) => current.map((item) => item.id === listing.id ? {
        ...item,
        availability: status,
        availabilityDate: status === "Soon available" ? availabilityDate ?? null : null,
        lastConfirmedAvailableAt: status === "Taken" ? null : new Date().toISOString(),
      } : item));
      setPendingAvailability((current) => ({ ...current, [listing.id]: { status, date: availabilityDate ?? "" } }));
      setMessage("Listing availability updated.");
    } catch (cause) {
      console.error("Unable to update listing availability.", cause);
      setError(cause instanceof Error ? cause.message : "Listing status could not be updated.");
    } finally {
      setBusyId("");
    }
  };

  const deleteListing = async (listing: DashboardListing) => {
    if (!window.confirm(`Remove "${listing.title}"? This cannot be undone.`)) return;
    setBusyId(listing.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/landlord/listings/${listing.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Listing could not be removed.");
      setListings((current) => current.filter((item) => item.id !== listing.id));
      setMessage("Listing removed.");
    } catch (cause) {
      console.error("Unable to remove landlord listing.", cause);
      setError(cause instanceof Error ? cause.message : "Listing could not be removed.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-emerald-200">Landlord workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Your rentals, all in one place.</h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-50">Review every listing you’ve hosted, update availability, and keep tenants informed.</p>
          </div>
          <Link href="/dashboard/landlord/new" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">+ Add a rental</Link>
        </div>
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Your rentals", listings.length],
            ["Published for tenants", liveCount],
            ["Marked available", availableCount],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm text-emerald-100">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>)}
        </div>
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">All your rentals</h2>
          <p className="mt-1 text-sm text-neutral-500">Availability changes for published rentals appear in tenant search.</p>
        </div>
        <div className="flex items-center gap-4"><Link href="/account/privacy" className="text-sm text-emerald-800 underline">Privacy controls</Link><SignOutButton /></div>
      </div>
      <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">New listings and photos stay out of public search until reviewed and approved. Mark a rental “Taken” when it is no longer available. Never ask renters to pay a deposit to Keja Mtaani.</p>
      {pendingCount > 0 && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{pendingCount} {pendingCount === 1 ? "listing is" : "listings are"} waiting for review and won’t appear in tenant search yet.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {message && !error && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
      {!loadError && listings.length === 0 && <div className="mt-6 rounded-2xl border bg-white px-5 py-14 text-center">
        <h2 className="text-lg font-medium">Your rental list is empty</h2>
        <p className="mt-2 text-sm text-neutral-500">Add your first property to start managing its listing and availability here.</p>
        <Link href="/dashboard/landlord/new" className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Add your first rental</Link>
      </div>}
      <ul className="mt-5 grid gap-4">
        {listings.map((listing) => <li key={listing.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row">
            {listing.photos[0] ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.photos[0]} alt={`${listing.title} cover photo`} loading="lazy" className="h-48 w-full object-cover sm:h-auto sm:w-56" />
            </> : <div className="flex h-36 items-center justify-center bg-slate-100 text-sm text-slate-500 sm:w-56">No photo uploaded</div>}
            <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${listing.publicationStatus === "published" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{statusLabel(listing.publicationStatus)}</span>
                  <span className="text-xs text-neutral-500">Added {new Date(listing.createdAt).toLocaleDateString("en-KE")}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold">{listing.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{listing.unitType} · {[listing.estate, listing.county].filter(Boolean).join(", ")}</p>
                <p className="mt-2 font-semibold">{ksh(listing.rent)} <span className="text-sm font-normal text-neutral-500">/ month</span></p>
                {listing.lastConfirmedAvailableAt && <p className="mt-1 text-xs text-neutral-500">Availability confirmed {new Date(listing.lastConfirmedAvailableAt).toLocaleDateString("en-KE")}</p>}
                <div className="mt-3">
                  <EditLandlordListing listing={{
                    id: listing.id,
                    title: listing.title,
                    description: listing.description,
                    buildingName: listing.buildingName,
                    estate: listing.estate,
                    county: listing.county,
                    address: listing.address,
                    rent: listing.rent,
                  }} onSaved={(updated: EditableListing, publicationStatus) => {
                    setListings((current) => current.map((item) => item.id === listing.id ? {
                      ...item,
                      ...updated,
                      publicationStatus: publicationStatus ?? item.publicationStatus,
                    } : item));
                    setMessage("Listing updated. If it was published, your edits are queued for moderation.");
                  }} />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 sm:w-56 sm:flex-col sm:items-stretch">
                <label className="flex-1 text-xs font-semibold text-neutral-600">Tenant-visible availability
                  <select aria-label={`Availability for ${listing.title}`} disabled={busyId === listing.id} value={pendingAvailability[listing.id]?.status ?? listing.availability} onChange={(event) => {
                    const status = LISTING_STATUSES.find((item) => item === event.target.value);
                    if (!status) return;
                    const current = pendingAvailability[listing.id] ?? { status: listing.availability, date: listing.availabilityDate ?? "" };
                    setPendingAvailability((items) => ({ ...items, [listing.id]: { ...current, status } }));
                    if (status !== "Soon available") void updateStatus(listing, status);
                    else if (current.date) void updateStatus(listing, status, current.date);
                  }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900">
                    {LISTING_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                {(pendingAvailability[listing.id]?.status ?? listing.availability) === "Soon available" && <label className="w-full text-xs font-semibold text-neutral-600">Expected available date
                  <input type="date" required aria-label={`Expected availability date for ${listing.title}`} disabled={busyId === listing.id} value={pendingAvailability[listing.id]?.date ?? listing.availabilityDate ?? ""} onChange={(event) => {
                    const date = event.target.value;
                    setPendingAvailability((items) => ({ ...items, [listing.id]: { status: "Soon available", date } }));
                    if (date) void updateStatus(listing, "Soon available", date);
                  }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900" />
                </label>}
                {listing.publicationStatus !== "published" && <button type="button" disabled={busyId === listing.id} onClick={() => void deleteListing(listing)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50">Remove listing</button>}
              </div>
            </div>
          </div>
        </li>)}
      </ul>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Interaction history</h2>
        <p className="mt-1 text-sm text-neutral-500">See recorded property views and contact actions for homes associated with your account.</p>
        <InteractionHistory />
      </section>
    </main>
  );
}
