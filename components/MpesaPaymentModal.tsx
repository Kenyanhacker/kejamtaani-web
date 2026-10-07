"use client";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Smartphone, X } from "lucide-react";
import { ksh } from "@/lib/data";

export function normalizePhone(s: string): string | null {
  const d = s.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return "254" + d.slice(1);
  return null;
}

type Phase = "form" | "waiting" | "success" | "failed";

export default function MpesaPaymentModal({ open, onClose, amount, description }: { open: boolean; onClose: () => void; amount: number; description: string }) {
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [err, setErr] = useState("");
  const [receipt, setReceipt] = useState("");
  if (!open) return null;

  async function pay() {
    const msisdn = normalizePhone(phone);
    if (!msisdn) return setErr("Enter a valid Safaricom number, e.g. 0712 345 678");
    setErr(""); setPhase("waiting");
    try {
      const r = await fetch("/api/mpesa/stkpush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: msisdn, amount, description }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setReceipt(d.receipt); setPhase("success");
    } catch (e) { setErr(e instanceof Error ? e.message : "Payment failed"); setPhase("failed"); }
  }

  const close = () => { if (phase !== "waiting") { setPhase("form"); onClose(); } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} className="absolute right-4 top-4" aria-label="Close"><X className="h-5 w-5" /></button>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Smartphone className="h-5 w-5 text-emerald-700" /> Pay with M-Pesa</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>

        {phase === "form" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-neutral-50 p-4 text-center"><p className="text-sm text-neutral-500">Amount</p><p className="text-3xl font-bold">{ksh(amount)}</p></div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XX XXX XXX" className="w-full rounded-lg border px-3 py-2" />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button onClick={pay} className="w-full rounded-lg bg-emerald-700 py-2.5 font-medium text-white hover:bg-emerald-800">Send M-Pesa prompt</button>
          </div>
        )}
        {phase === "waiting" && <div className="flex flex-col items-center gap-3 py-8"><Loader2 className="h-10 w-10 animate-spin text-emerald-700" /><p className="font-medium">Check your phone and enter your PIN</p></div>}
        {phase === "success" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" /><p className="text-lg font-semibold">Payment received</p>
            <div className="w-full rounded-xl border p-3 text-sm"><div className="flex justify-between"><span className="text-neutral-500">M-Pesa code</span><b className="font-mono">{receipt}</b></div></div>
            <button onClick={close} className="w-full rounded-lg bg-neutral-900 py-2.5 text-white">Done</button>
          </div>
        )}
        {phase === "failed" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle className="h-12 w-12 text-red-500" /><p className="text-sm text-neutral-600">{err}</p>
            <button onClick={() => setPhase("form")} className="w-full rounded-lg bg-emerald-700 py-2.5 text-white">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
