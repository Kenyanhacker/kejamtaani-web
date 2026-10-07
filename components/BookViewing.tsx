"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function BookViewing({ title, listingId }: { title: string; listingId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("afternoon");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/viewing-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, name, phone, preferredDate, preferredTime, message }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Viewing request could not be sent.");
      setStatus("Your viewing request was sent to the landlord. You can follow its status from your tenant dashboard.");
      setName("");
      setPhone("");
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Viewing request could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-4">
      <div>
        <h2 className="font-semibold">Request a viewing</h2>
        <p className="mt-1 text-xs text-neutral-600">Free to request. The landlord will follow up using your phone number.</p>
      </div>
      <label className="block text-xs font-medium">Your name
        <input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      </label>
      <label className="block text-xs font-medium">Phone number
        <input required minLength={7} maxLength={30} inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium">Preferred date
          <input required type="date" min={today} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium">Time
          <select value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm">
            <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option>
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium">Message (optional)
        <textarea rows={2} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`I’m interested in ${title}`} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "Sending…" : "Send viewing request"}</button>
      <p className="text-center text-xs text-neutral-500">Your name and phone are shared with this listing’s landlord for this request.</p>
      {error && <p role="alert" className="text-sm text-rose-800">{error} {error.startsWith("Sign in") && <Link href={`/auth?next=${encodeURIComponent(`/property/${listingId}`)}`} className="underline">Sign in</Link>}</p>}
      {status && <p role="status" className="text-sm text-emerald-900">{status}</p>}
    </form>
  );
}
