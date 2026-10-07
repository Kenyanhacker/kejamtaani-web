"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const REASONS = ["Incorrect details", "Suspicious or fraudulent", "Already taken", "Inappropriate content", "Other"];

export default function ReportListing({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/listing-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, reason, details }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Report could not be submitted.");
      setMessage("Thank you. Your report has been sent for moderator review.");
      setOpen(false);
      setDetails("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border p-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="text-sm font-medium text-rose-800 underline">Report this listing</button>
      {open && <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="block text-xs font-semibold">Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">
            {REASONS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">Details (optional)
          <textarea rows={3} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send report"}</button>
      </form>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error} {error.startsWith("Sign in") && <Link href={`/auth?next=${encodeURIComponent(`/property/${listingId}`)}`} className="underline">Sign in</Link>}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
      <p className="mt-2 text-xs text-neutral-500">Reports are reviewed by the site operator; they are not an emergency service.</p>
    </section>
  );
}
