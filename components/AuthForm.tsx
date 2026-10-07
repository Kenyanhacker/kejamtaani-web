"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { isUserRole, UserRole } from "@/lib/supabase/roles";

export default function AuthForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<UserRole>("tenant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google") setError("Google sign-in could not start. Check the configured Google OAuth provider and try again.");
    if (params.get("error") === "confirmation") setError("That confirmation link could not be verified. Request a new link and try again.");
    if (params.get("error") === "role") setError("Choose whether you are signing in as a tenant or landlord.");
    if (params.get("error") === "consent") setError("Please agree to the Terms of Use and acknowledge the Privacy Notice before continuing with Google.");
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "signup" && !acceptedPolicies) {
      setError("Please agree to the Terms of Use and acknowledge the Privacy Notice to create an account.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password, role, next, acceptedPolicies, marketingOptIn }),
      });
      const result: { error?: string; message?: string; redirectTo?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Account request failed.");
      if (result.message) {
        setMessage(result.message);
      } else {
        window.location.assign(result.redirectTo ?? "/");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete your account request.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = () => {
    if (!acceptedPolicies) {
      setError("Please agree to the Terms of Use and acknowledge the Privacy Notice before continuing with Google.");
      return;
    }
    const query = new URLSearchParams({
      role,
      acceptedPolicies: "true",
      marketingOptIn: String(marketingOptIn),
      ...(next ? { next } : {}),
    });
    window.location.assign(`/api/auth/google?${query.toString()}`);
  };

  return (
    <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
        <button type="button" onClick={() => { setMode("signin"); setError(""); setMessage(""); }} aria-pressed={mode === "signin"} className={`rounded-lg py-2 ${mode === "signin" ? "bg-white font-semibold shadow-sm" : "text-neutral-600"}`}>Sign in</button>
        <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} aria-pressed={mode === "signup"} className={`rounded-lg py-2 ${mode === "signup" ? "bg-white font-semibold shadow-sm" : "text-neutral-600"}`}>Create account</button>
      </div>
      <label className="mt-5 block text-sm font-medium">I am a
        <select value={role} onChange={(event) => { if (isUserRole(event.target.value)) setRole(event.target.value); }} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="tenant">Tenant</option>
          <option value="landlord">Landlord</option>
        </select>
      </label>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">Email address
          <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">Password
          <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          {mode === "signup" && <span className="mt-1 block text-xs font-normal text-neutral-500">Use at least 8 characters.</span>}
        </label>
        <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} className="-mt-2 text-xs text-emerald-800 underline">{showPassword ? "Hide password" : "Show password"}</button>
        {mode === "signin" && <Link href="/auth/reset" className="block text-sm text-emerald-800 underline">Forgot password?</Link>}
        <fieldset className="space-y-3 rounded-xl bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <input type="checkbox" checked={acceptedPolicies} onChange={(event) => setAcceptedPolicies(event.target.checked)} className="mt-0.5" />
            <span>I agree to the <Link href="/terms" className="text-emerald-800 underline">Terms of Use</Link> and acknowledge the <Link href="/privacy" className="text-emerald-800 underline">Privacy Notice</Link>. Required to create an account or continue with Google.</span>
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} className="mt-0.5" />
            <span>Optional: opt in to email updates about new property listings. This is separate from essential account and viewing messages; the app does not currently send marketing emails.</span>
          </label>
        </fieldset>
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "Please wait…" : mode === "signin" ? "Sign in with email" : "Create account with email"}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-neutral-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>
      <button type="button" onClick={googleSignIn} className="w-full rounded-xl border py-3 text-sm font-medium hover:bg-slate-50">Continue with Google</button>
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
      <p className="mt-5 text-xs leading-relaxed text-neutral-500">By continuing, you agree to use accurate account details. Keep viewing and deposit payments off-platform until you have independently verified the property.</p>
    </div>
  );
}
