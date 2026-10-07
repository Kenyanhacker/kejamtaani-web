"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [recoveringSession, setRecoveringSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const code = query.get("code");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const isRecovery = hash.get("type") === "recovery" || query.get("type") === "recovery" || Boolean(code);
    if (!isRecovery) return;
    setRecovery(true);
    setRecoveringSession(true);
    if (code || accessToken || refreshToken) window.history.replaceState({}, "", "/auth/reset");
    const establishRecoverySession = async () => {
      if (code) {
        const response = await fetch("/api/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "This recovery link is invalid or expired.");
      } else if (accessToken && refreshToken) {
        const response = await fetch("/api/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "This recovery link is invalid or expired.");
      }
    };
    void establishRecoverySession().catch((cause: unknown) => {
      console.error("Unable to establish password recovery session.", cause);
      setError(cause instanceof Error ? cause.message : "This recovery link is invalid or expired.");
      setRecovery(false);
    }).finally(() => setRecoveringSession(false));
  }, []);

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "A reset link could not be sent.");
      setMessage(result.message ?? "Check your email for password recovery instructions.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A reset link could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The password could not be updated.");
      setMessage("Your password has been updated. You can now sign in.");
      setRecovery(false);
      window.history.replaceState({}, "", "/auth/reset");
    } catch (cause) {
      console.error("Unable to update account password.", cause);
      setError(cause instanceof Error ? cause.message : "The password could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">{recovery ? "Choose a new password" : "Reset your password"}</h1>
      <p className="mt-2 text-sm text-neutral-600">{recovery ? "Choose a secure password with at least 8 characters." : "We will send a password recovery link if an account exists for your email."}</p>
      {recovery ? (
        <form onSubmit={updatePassword} className="mt-6 space-y-4 rounded-2xl border bg-white p-5">
          <label className="block text-sm font-medium">New password
            <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          {recoveringSession && <p role="status" className="text-sm text-neutral-600">Verifying your recovery link…</p>}
          <button disabled={busy || recoveringSession} className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>
        </form>
      ) : (
        <form onSubmit={submitEmail} className="mt-6 space-y-4 rounded-2xl border bg-white p-5">
          <label className="block text-sm font-medium">Email address
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
      <p className="mt-5 text-sm"><Link href="/auth" className="text-emerald-800 underline">Return to sign in</Link></p>
    </main>
  );
}
