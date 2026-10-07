"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function PrivacyTools({ initialMarketingOptIn }: { initialMarketingOptIn: boolean }) {
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);

  const exportData = async () => {
    setError("");
    try {
      const response = await fetch("/api/privacy/export");
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Data export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "keja-mtaani-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data export failed.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, details }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Privacy request could not be submitted.");
      setMessage("Your request has been recorded. The operator must review it manually; deletion is not automatic yet.");
      setDetails("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Privacy request could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  const updateMarketing = async (optIn: boolean) => {
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/privacy/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn }),
      });
      const result = await response.json() as { error?: string; optIn?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Email preference could not be saved.");
      setMarketingOptIn(Boolean(result.optIn));
      setMessage("Your email preference has been saved. Listing marketing emails are not currently being sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email preference could not be saved.");
    }
  };

  return <main className="mx-auto max-w-2xl px-4 py-10">
    <h1 className="text-3xl font-bold">Your privacy controls</h1>
    <p className="mt-2 text-sm text-neutral-600">Export account data or send an access, correction, or deletion request. See the <Link href="/privacy" className="text-emerald-800 underline">Privacy Notice</Link>.</p>
    <button type="button" onClick={() => void exportData()} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800">Download my account data</button>
    <section className="mt-6 rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">Optional listing updates</h2>
      <p className="mt-1 text-sm text-slate-600">You can change this choice at any time. No marketing emails are currently sent.</p>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={marketingOptIn} onChange={(event) => void updateMarketing(event.target.checked)} />I opt in to optional new-listing email updates.</label>
    </section>
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Submit a privacy request</h2>
      <label className="block text-sm font-medium">Request type
        <select value={requestType} onChange={(event) => setRequestType(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
          <option value="access">Access my data</option>
          <option value="correction">Correct my data</option>
          <option value="deletion">Request account/data deletion</option>
        </select>
      </label>
      <label className="block text-sm font-medium">Details (optional)
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={4} maxLength={1000} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <p className="text-xs text-amber-900">Requests are queued for manual handling. Submitting a deletion request does not immediately remove your account or data.</p>
      <button type="submit" disabled={busy} className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Submitting…" : "Submit request"}</button>
    </form>
    {error && <p role="alert" className="mt-4 text-sm text-rose-800">{error} {error.startsWith("Sign in") && <Link href="/auth?next=/account/privacy" className="underline">Sign in</Link>}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-900">{message}</p>}
  </main>;
}
