import Link from "next/link";

export const metadata = {
  title: "How Keja Mtaani works",
  description: "How tenants can find homes and request viewings, and how landlords submit rental listings.",
};

export default function HowItWorksPage() {
  return <main className="mx-auto max-w-4xl px-4 py-10">
    <h1 className="text-3xl font-bold">How Keja Mtaani works</h1>
    <p className="mt-3 max-w-2xl text-slate-600">Find rental homes, review the costs, and request a viewing. Browsing and viewing requests are free.</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">For tenants</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
          <li>Search by neighbourhood, home type, budget, or approximate map location.</li>
          <li>Review rent, stated move-in costs, photos, and availability before contacting anyone.</li>
          <li>Request a viewing. Your request and contact details are shared with that listing’s landlord.</li>
          <li>See request status from your tenant dashboard and report suspicious or inaccurate listings.</li>
        </ol>
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">Visit and independently verify the property and landlord before paying a deposit. Keja Mtaani does not collect or hold deposits.</p>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">For landlords</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
          <li>Create a landlord account and submit accurate property information and consented photos.</li>
          <li>Your listing stays private while awaiting review. Submission does not guarantee publication.</li>
          <li>Manage all your rentals and respond to viewing requests from your dashboard.</li>
          <li>Keep availability current. Editing published details sends the listing back for review.</li>
        </ol>
      </section>
    </div>
    <p className="mt-8 text-sm text-slate-600">Read the <Link href="/terms" className="text-emerald-800 underline">Terms</Link> and <Link href="/privacy" className="text-emerald-800 underline">Privacy Notice</Link>. Need help? Contact <a href="mailto:ceejaycreationofficial@gmail.com" className="text-emerald-800 underline">Ceejay Creations</a>.</p>
  </main>;
}
