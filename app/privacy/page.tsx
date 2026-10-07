import Link from "next/link";

export const metadata = {
  title: "Privacy Notice | Keja Mtaani",
  description: "How Keja Mtaani handles account, property, and viewing activity information.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Privacy Notice</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: 7 October 2026 · Draft for operator review</p>
      <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Before public launch, provide a complete postal/street address and confirm the operator details, processors, and legal wording with a qualified Kenyan privacy adviser.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Who operates the service</h2>
        <p>Ceejay Creations operates the Keja Mtaani service. The address supplied is Umoja, Nairobi, Kenya; a full street or postal address is still required. Contact: <a className="text-emerald-800 underline" href="mailto:ceejaycreationofficial@gmail.com">ceejaycreationofficial@gmail.com</a>.</p>
        <p>For privacy requests or concerns, email that address with “Privacy request” in the subject. Do not email passwords, identity documents, or other unnecessary sensitive information.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Information we handle</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Account details, including email, chosen account role, and account identifiers.</li>
          <li>Records of the Terms of Use and Privacy Notice versions acknowledged at sign-up, and your optional marketing preference.</li>
          <li>Information tenants submit in a viewing request, such as name, phone number, preferred date/time, and message.</li>
          <li>Landlord listing details, including property description, rent, availability, photos, and location. Public map locations are approximate; the precise coordinates are used for nearby search.</li>
          <li>Saved search filters, including search terms, rent ranges, and approximate map-search coordinates when you choose to save a map-based search.</li>
          <li>When you are signed in, listing views and contact actions can be recorded with the listing, account, and time. These records support account history, landlord listing activity, service operation, and abuse prevention.</li>
          <li>Technical information needed to operate and secure the service may be processed by the hosting and authentication providers.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Purposes and lawful basis</h2>
        <p>We use information to create and secure accounts, publish and manage rental listings, facilitate requested contact/viewings, provide account activity features, and prevent abuse. The intended lawful bases include taking steps requested by you or performing a service you request, and consent where the law requires it. Optional marketing messages, if introduced, will have a separate opt-in. A Kenyan privacy professional should confirm the final lawful-basis wording for each purpose before launch.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Service providers and sharing</h2>
        <p>Supabase is used for database and authentication services. Transactional email is sent through the provider configured for Supabase Auth; this may be Resend if the operator has configured it. The operator must verify and name the actual email provider before launch. The app may also use its hosting provider and OpenStreetMap map tiles to provide the service.</p>
        <p>Listing information you submit may be visible publicly after review and publication. Viewing-request details are shared with the relevant landlord to respond to your request. We do not sell personal information.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Retention, access, and deletion</h2>
        <p>Our proposed retention schedule is described in the <Link href="/retention" className="text-emerald-800 underline">Data Retention Policy</Link>. Signed-in users can export account data. Privacy requests are queued for manual handling; account deletion and automated cleanup are not yet implemented, and the schedule is not a promise that deletion currently runs automatically.</p>
        <p>You may request access to or correction/deletion of your information by emailing <a className="text-emerald-800 underline" href="mailto:ceejaycreationofficial@gmail.com">ceejaycreationofficial@gmail.com</a>. We may need to verify your identity and may retain information where required by law or to resolve a dispute.</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Security incidents</h2>
        <p>Interim incident-response owner: Ceejay Creations, contact <a className="text-emerald-800 underline" href="mailto:ceejaycreationofficial@gmail.com">ceejaycreationofficial@gmail.com</a>. The operator must formally designate a named individual as Data Protection Lead before launch. Report suspected account compromise, data exposure, or misuse promptly using that address.</p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Contain the incident, restrict access, preserve relevant records, and promptly rotate exposed Supabase/database/API credentials.</li>
          <li>Review relevant hosting, Supabase, and email-provider audit/security logs; document scope, affected data, timeline, and decisions.</li>
          <li>Contact affected processors and require prompt cooperation. A 48-hour processor notice is a contractual target to negotiate, not a claim that every provider is already bound to it.</li>
          <li>Notify affected people and the Office of the Data Protection Commissioner when and within the periods required by applicable Kenyan law. The operator’s proposed 72-hour escalation target must be verified with qualified counsel before launch.</li>
        </ol>
        <p>We use access controls and service-provider security features, but no internet service can guarantee absolute security. You may also raise a concern with the Office of the Data Protection Commissioner in Kenya.</p>
      </section>
      <p className="mt-10 text-sm"><Link href="/terms" className="text-emerald-800 underline">Terms of Use</Link> · <Link href="/retention" className="text-emerald-800 underline">Data Retention Policy</Link></p>
    </main>
  );
}
