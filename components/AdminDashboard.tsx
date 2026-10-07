"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Home, RefreshCw, ShieldCheck, Users } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

type Tab = "overview" | "pending" | "reports" | "privacy" | "published";
type Listing = {
  id: string;
  title: string;
  description: string | null;
  building_name: string | null;
  address: string | null;
  estate: string | null;
  constituency: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string;
  rent_cents: number;
  deposit_months: number | null;
  garbage_fee_cents: number | null;
  water_deposit_cents: number | null;
  water_supply: string | null;
  electricity_arrangement: string | null;
  gated: boolean | null;
  cctv: boolean | null;
  security_guard: boolean | null;
  furnished: boolean | null;
  wifi_available: boolean | null;
  parking: boolean | null;
  amenities: string[];
  deposit_rule: string | null;
  tour_url: string | null;
  availability_status: string;
  availability_date: string | null;
  published_at: string | null;
  created_at: string;
  landlord_id: string | null;
  landlord: { email: string | null } | null;
};
type Report = {
  id: string;
  listing_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
  listing: { title: string | null; estate: string | null } | null;
  reporter: { email: string | null } | null;
};
type PrivacyRequest = {
  id: string;
  user_id: string;
  request_type: string;
  details: string | null;
  status: string;
  created_at: string;
  requester: { email: string | null } | null;
};
type AdminData = {
  counts: { pending: number; published: number; reports: number; privacyRequests: number };
  pending: Listing[];
  published: Array<Pick<Listing, "id" | "title" | "estate" | "county" | "property_type" | "rent_cents" | "availability_status" | "published_at" | "landlord">>;
  reports: Report[];
  privacyRequests: PrivacyRequest[];
  images: Array<{ id: string; listing_id: string; is_primary: boolean; signedUrl: string | null }>;
};

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" });
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "pending", label: "Listing review" },
  { id: "reports", label: "Reports" },
  { id: "privacy", label: "Privacy requests" },
  { id: "published", label: "Published homes" },
];

function localTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateTime.format(date);
}

function ErrorMessage({ children }: { children: string }) {
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{children}</p>;
}

export default function AdminDashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const result = await response.json() as AdminData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load moderation data.");
      setData(result);
    } catch (cause) {
      console.error("Unable to load the admin dashboard.", cause);
      setError(cause instanceof Error ? cause.message : "Could not load moderation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const moderate = async (entity: "listing" | "report" | "privacy_request", action: string, id: string) => {
    const note = notes[id]?.trim() ?? "";
    if (entity === "listing" && action === "approve"
      && !window.confirm("Approve this listing and its photos for public display?")) return;
    if (entity === "listing" && action === "reject" && !note) {
      setError("Add a short reason before rejecting a listing.");
      return;
    }
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, id, note }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The admin action could not be saved.");
      setMessage(entity === "listing"
        ? action === "approve" ? "Listing approved and published." : "Listing rejected and archived."
        : entity === "report" ? `Report ${action === "resolve" ? "resolved" : "dismissed"}.` : `Privacy request marked ${action.replace("_", " ")}.`);
      setNotes((current) => ({ ...current, [id]: "" }));
      await load();
    } catch (cause) {
      console.error("Unable to save an admin action.", cause);
      setError(cause instanceof Error ? cause.message : "The admin action could not be saved.");
    } finally {
      setBusy("");
    }
  };

  const listingImages = (listingId: string) => (data?.images ?? []).filter((image) => image.listing_id === listingId);
  const filteredPublished = (data?.published ?? []).filter((listing) => {
    const text = `${listing.title} ${listing.estate ?? ""} ${listing.county ?? ""} ${listing.landlord?.email ?? ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return <main className="mx-auto max-w-7xl px-4 py-8">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-800 p-6 text-white shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><ShieldCheck aria-hidden="true" className="h-5 w-5" /> Keja Mtaani administration</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Moderation centre</h1>
          <p className="mt-2 text-sm text-emerald-50">Review listings and user reports before they affect the public marketplace.</p>
          <p className="mt-3 break-all text-xs text-emerald-100">Signed in as {email}</p>
        </div>
        <div className="flex items-center gap-4 rounded-full bg-white/10 px-4 py-2 text-sm">
          <Link href="/" className="underline">View public site</Link><SignOutButton />
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Awaiting listing review", count: data?.counts.pending, icon: Clock3, tab: "pending" as const },
          { label: "Open user reports", count: data?.counts.reports, icon: AlertTriangle, tab: "reports" as const },
          { label: "Open privacy requests", count: data?.counts.privacyRequests, icon: Users, tab: "privacy" as const },
          { label: "Published homes", count: data?.counts.published, icon: Home, tab: "published" as const },
        ].map(({ label, count, icon: Icon, tab: target }) => <button key={target} type="button" onClick={() => setTab(target)} className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left hover:bg-white/15">
          <span className="flex items-center justify-between text-sm text-emerald-100">{label}<Icon aria-hidden="true" className="h-4 w-4" /></span>
          <span className="mt-1 block text-2xl font-bold">{loading ? "…" : count ?? 0}</span>
        </button>)}
      </div>
    </header>

    <nav aria-label="Admin sections" className="mt-6 flex gap-2 overflow-x-auto pb-2">
      {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-emerald-800 text-white" : "border bg-white text-slate-700 hover:bg-slate-50"}`}>{item.label}</button>)}
      <button type="button" onClick={() => void load()} disabled={loading} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</button>
    </nav>

    {error && <div className="mt-5"><ErrorMessage>{error}</ErrorMessage></div>}
    {message && !error && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
    {loading && !data && <p className="mt-8 text-sm text-slate-600">Loading secure moderation data…</p>}

    {data && tab === "overview" && <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">What needs attention</h2>
        <ul className="mt-4 divide-y">
          {[
            ["Listings waiting for review", data.counts.pending, "pending" as const],
            ["Reports awaiting a decision", data.counts.reports, "reports" as const],
            ["Privacy requests requiring follow-up", data.counts.privacyRequests, "privacy" as const],
          ].map(([label, count, target]) => <li key={String(target)} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>{label}</span><button type="button" onClick={() => setTab(target as Tab)} className="font-bold text-emerald-800 underline">{count} · Review</button>
          </li>)}
        </ul>
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">Review ownership, price, location, description, availability, and photos. Approving publishes the rental immediately. Rejection archives the submission and records your reason for the support team.</p>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Admin safety and operating notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>Only the verified Google email configured in the server allowlist can use admin actions.</li>
          <li>Never share or add the Supabase service-role key to browser-visible variables.</li>
          <li>Use a unique Google account with MFA; sign out on shared devices.</li>
          <li>Image previews are temporary signed links and expire automatically.</li>
          <li>Requests and reports contain personal information; view only what is needed to handle them.</li>
        </ul>
      </div>
    </section>}

    {data && tab === "pending" && <section className="mt-6 space-y-4">
      <div><h2 className="text-xl font-bold">Pending listing review</h2><p className="mt-1 text-sm text-slate-600">Oldest first. Only approve genuine, authorized rentals with complete, accurate details.</p></div>
      {data.pending.length === 0 && <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">No pending listing submissions.</p>}
      {data.pending.map((listing) => <article key={listing.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Pending review · submitted {localTime(listing.created_at)}</p><h3 className="mt-2 text-xl font-bold">{listing.title}</h3><p className="mt-1 text-sm text-slate-600">{listing.building_name} · {listing.estate}, {listing.county}</p></div>
              <Link href={`/property/${listing.id}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-800 underline">Open preview</Link>
            </div>
            <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Monthly rent</dt><dd className="font-semibold">{currency.format(Number(listing.rent_cents) / 100)}</dd></div>
              <div><dt className="text-xs text-slate-500">Home type</dt><dd>{listing.property_type}</dd></div>
              <div><dt className="text-xs text-slate-500">Address / estate</dt><dd>{listing.address || listing.estate || "Not supplied"}</dd></div>
              <div><dt className="text-xs text-slate-500">Constituency / county</dt><dd>{[listing.constituency, listing.county].filter(Boolean).join(", ") || "Not supplied"}</dd></div>
              <div><dt className="text-xs text-slate-500">Availability</dt><dd>{listing.availability_status}{listing.availability_date ? ` · ${listing.availability_date}` : ""}</dd></div>
              <div><dt className="text-xs text-slate-500">Landlord account</dt><dd className="break-all">{listing.landlord?.email ?? "Email unavailable"}<br/><span className="font-mono text-[10px] text-slate-500">{listing.landlord_id ?? "No owner ID"}</span></dd></div>
              <div><dt className="text-xs text-slate-500">Deposit</dt><dd>{listing.deposit_rule || `${listing.deposit_months ?? 1} month(s)`}</dd></div>
              <div><dt className="text-xs text-slate-500">Other charges</dt><dd>Garbage {currency.format(Number(listing.garbage_fee_cents ?? 0) / 100)} · water deposit {currency.format(Number(listing.water_deposit_cents ?? 0) / 100)}</dd></div>
              <div><dt className="text-xs text-slate-500">Water / power</dt><dd>{listing.water_supply || "Unspecified"} / {listing.electricity_arrangement || "Unspecified"}</dd></div>
              <div><dt className="text-xs text-slate-500">Coordinates</dt><dd>{listing.latitude ?? "—"}, {listing.longitude ?? "—"}</dd></div>
            </dl>
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6">{listing.description || "No description provided."}</p>
            <p className="mt-3 text-xs text-slate-600">Amenities: {listing.amenities?.length ? listing.amenities.join(", ") : "None listed"}</p>
            {listing.tour_url && <p className="mt-2 break-all text-xs"><a href={listing.tour_url} target="_blank" rel="noreferrer" className="text-emerald-800 underline">Open landlord video tour</a></p>}
          </div>
          <div>
            <h4 className="text-sm font-bold">Submitted photos ({listingImages(listing.id).length})</h4>
            {listingImages(listing.id).length ? <div className="mt-3 grid grid-cols-2 gap-2">
              {listingImages(listing.id).map((image) => image.signedUrl
                ? <a key={image.id} href={image.signedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.signedUrl} alt={`${listing.title} submitted property photo${image.is_primary ? ", cover image" : ""}`} className="h-36 w-full object-cover" />
                    <span className="block p-2 text-xs">{image.is_primary ? "Cover photo" : "Listing photo"}</span>
                  </a>
                : <p key={image.id} className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Photo unavailable; check Storage before approving.</p>)}
            </div> : <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No photos submitted. Confirm whether this meets your listing standards.</p>}
            <label className="mt-5 block text-sm font-semibold">Decision note
              <textarea value={notes[listing.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [listing.id]: event.target.value }))} maxLength={1000} rows={3} placeholder="Required when rejecting; keep a brief internal record." className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-normal" />
            </label>
            <p className="mt-1 text-right text-xs text-slate-500">{(notes[listing.id] ?? "").length}/1000</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void moderate("listing", "approve", listing.id)} disabled={busy === listing.id} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve & publish</button>
              <button type="button" onClick={() => void moderate("listing", "reject", listing.id)} disabled={busy === listing.id} className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50">Reject & archive</button>
            </div>
          </div>
        </div>
      </article>)}
      {data.counts.pending > data.pending.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Showing the oldest {data.pending.length} of {data.counts.pending}. Review these first, then refresh to load the next submissions.</p>}
    </section>}

    {data && tab === "reports" && <section className="mt-6 space-y-4">
      <div><h2 className="text-xl font-bold">Open tenant reports</h2><p className="mt-1 text-sm text-slate-600">Review the claim and listing. Resolve after taking action, or dismiss if the report is unsupported.</p></div>
      {data.reports.length === 0 && <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">No open listing reports.</p>}
      {data.reports.map((report) => <article key={report.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{report.reason}</h3><p className="mt-1 text-sm text-slate-600">{report.listing?.title ?? "Listing removed"} · {report.listing?.estate ?? "Location unavailable"}</p></div><span className="text-xs text-slate-500">{localTime(report.created_at)}</span></div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{report.details || "No further details supplied."}</p>
        <p className="mt-2 text-xs text-slate-500">Reporter: {report.reporter?.email ?? "Account unavailable"} · Report ID: {report.id}</p>
        {report.listing_id && <Link href={`/property/${report.listing_id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-emerald-800 underline">Inspect reported listing</Link>}
        <label className="mt-4 block text-sm font-semibold">Internal resolution note
          <input value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={1000} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" placeholder="Optional: record the action taken." />
        </label>
        <div className="mt-3 flex gap-2"><button type="button" onClick={() => void moderate("report", "resolve", report.id)} disabled={busy === report.id} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Resolve report</button><button type="button" onClick={() => void moderate("report", "dismiss", report.id)} disabled={busy === report.id} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Dismiss</button></div>
      </article>)}
      {data.counts.reports > data.reports.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Showing the oldest {data.reports.length} of {data.counts.reports} open reports. Resolve or dismiss these, then refresh for the next reports.</p>}
    </section>}

    {data && tab === "privacy" && <section className="mt-6 space-y-4">
      <div><h2 className="text-xl font-bold">Privacy requests</h2><p className="mt-1 text-sm text-slate-600">Handle access, correction, and deletion requests under your published policy and legal obligations. Do not mark complete until the work is actually done.</p></div>
      {data.privacyRequests.length === 0 && <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">No open privacy requests.</p>}
      {data.privacyRequests.map((request) => <article key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold capitalize">{request.request_type} request</h3><p className="mt-1 break-all text-sm text-slate-600">{request.requester?.email ?? "Account unavailable"} · {request.status}</p></div><span className="text-xs text-slate-500">{localTime(request.created_at)}</span></div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{request.details || "No additional details."}</p>
        <label className="mt-4 block text-sm font-semibold">Internal handling note
          <input value={notes[request.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} maxLength={1000} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal" placeholder="Record progress without unnecessary sensitive details." />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void moderate("privacy_request", "in_progress", request.id)} disabled={busy === request.id} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Mark in progress</button>
          <button type="button" onClick={() => void moderate("privacy_request", "completed", request.id)} disabled={busy === request.id} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark completed</button>
          <button type="button" onClick={() => void moderate("privacy_request", "rejected", request.id)} disabled={busy === request.id} className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50">Reject request</button>
        </div>
      </article>)}
      {data.counts.privacyRequests > data.privacyRequests.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Showing the oldest {data.privacyRequests.length} of {data.counts.privacyRequests} open privacy requests. Handle these, then refresh for more.</p>}
    </section>}

    {data && tab === "published" && <section className="mt-6 space-y-4">
      <div><h2 className="text-xl font-bold">Published listings</h2><p className="mt-1 text-sm text-slate-600">A quick public inventory for investigating reports. Content edits go back through moderation.</p></div>
      <label className="block max-w-xl text-sm font-semibold">Filter by title, location, county, or landlord email
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-normal" />
      </label>
      {filteredPublished.length === 0 && <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">No published listings match this filter.</p>}
      <ul className="divide-y rounded-2xl border bg-white shadow-sm">
        {filteredPublished.map((listing) => <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><h3 className="font-semibold">{listing.title}</h3><p className="text-sm text-slate-600">{listing.estate}, {listing.county} · {listing.property_type} · {currency.format(Number(listing.rent_cents) / 100)} / month</p><p className="mt-1 text-xs text-slate-500">Landlord: {listing.landlord?.email ?? "Email unavailable"} · {listing.availability_status}</p></div>
          <Link href={`/property/${listing.id}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-800 underline">View public page</Link>
        </li>)}
      </ul>
      {data.counts.published > data.published.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Showing the newest {data.published.length} of {data.counts.published} published homes. Use search or review reports to investigate older listings.</p>}
    </section>}
  </main>;
}
