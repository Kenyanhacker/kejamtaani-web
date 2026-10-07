import Link from "next/link";

export const metadata = {
  title: "Terms of Use | Keja Mtaani",
  description: "Rules for tenants, landlords, and administrators using Keja Mtaani.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Terms of Use</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: 7 October 2026 · Draft for operator review</p>
      <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">These draft terms need review by Ceejay Creations and a qualified Kenyan legal adviser before public launch. A complete operator postal/street address must still be added.</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Using the service</h2>
        <p>Keja Mtaani provides rental-property information and tools for requesting contact or viewings. You must provide accurate information, keep your account secure, and use the service lawfully and respectfully.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Tenants</h2>
        <p>Tenants may browse listings, save properties, and contact landlords or request viewings. Verify the property, landlord, and all payment instructions independently before paying money. Do not send deposits to Keja Mtaani or rely on a listing as a guarantee of availability or ownership.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Landlords</h2>
        <p>Landlords are responsible for having authority to advertise each property and for ensuring that descriptions, ownership/authority, rent, fees, photos, location, and availability are current, accurate, lawful, and not misleading or fraudulent. Update a listing promptly when its status changes. Do not publish another person’s personal information or images without permission.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Administrators and moderation</h2>
        <p>Administrators are authorized service operators who may review listings, remove content, investigate abuse, and manage platform access. A listing is not guaranteed to be published, and publication does not verify all claims or guarantee a transaction.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Platform role and payments</h2>
        <p>Keja Mtaani is an information portal and viewing facilitator. It is not a landlord, tenant, broker, escrow provider, or payment agent, and it does not collect or hold rental deposits through this service. Users arrange any rental transaction directly and should independently verify all parties and terms. Nothing here removes rights that cannot legally be excluded.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Suspension and termination</h2>
        <p>We may restrict or suspend accounts or remove listings where reasonably necessary to address spam, rate-limit abuse, fraud, misleading content, safety concerns, unlawful activity, or breaches of these terms. Where appropriate, we will provide a reason and a way to contact the operator.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Changes and contact</h2>
        <p>We may update these terms and will update the date above. The service is operated by Ceejay Creations. Questions can be sent to <a className="text-emerald-800 underline" href="mailto:ceejaycreationofficial@gmail.com">ceejaycreationofficial@gmail.com</a>.</p>
      </section>
      <p className="mt-10 text-sm"><Link href="/privacy" className="text-emerald-800 underline">Privacy Notice</Link> · <Link href="/retention" className="text-emerald-800 underline">Data Retention Policy</Link></p>
    </main>
  );
}
