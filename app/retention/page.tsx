import Link from "next/link";

export const metadata = {
  title: "Data Retention Policy | Keja Mtaani",
  description: "Proposed retention periods for account, listing, viewing, and interaction data.",
};

const schedule = [
  ["Inactive profiles", "2 years after last login", "Delete or anonymize, subject to legal requirements and a tested account-deletion workflow."],
  ["Draft or expired listings", "90 days after expiry", "Target: delete listing records and photos after a tested Storage cleanup process exists. Current database cleanup only archives eligible unpublished records."],
  ["Viewing requests", "6 months after the preferred viewing date", "Delete request details, subject to unresolved disputes or legal obligations."],
  ["Interaction logs", "90 days", "Remove direct account identifiers and retain only aggregate statistics if needed."],
  ["Policy acknowledgement records", "While the account is active", "Review for deletion or anonymization when the account is closed, unless a legal obligation or claim requires retention."],
];

export default function RetentionPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Data Retention Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">Proposed schedule · Last updated: 7 October 2026</p>
      <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">These are target periods, not currently automated deletion guarantees. A database maintenance function is defined but is not scheduled; it archives eligible unpublished listings, deletes old viewing requests, and anonymizes old interactions. It does not purge Storage photos or inactive accounts. Account export is available, while deletion requests require manual handling. The operator must implement, test, and monitor the cleanup process before collecting production data.</p>
      <div className="mt-8 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-100"><tr><th className="p-3 font-semibold">Data category</th><th className="p-3 font-semibold">Target period</th><th className="p-3 font-semibold">Action after expiry</th></tr></thead>
          <tbody>{schedule.map(([category, period, action]) => <tr key={category} className="border-t align-top"><th scope="row" className="p-3 font-medium">{category}</th><td className="p-3">{period}</td><td className="p-3">{action}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-6 text-sm leading-6 text-neutral-600">Where a legal obligation, security investigation, or unresolved dispute requires longer retention, access should be restricted and the reason documented. Photos removed from a listing must also be deleted from the private Supabase Storage bucket and any configured backups according to the provider’s backup lifecycle.</p>
      <p className="mt-8 text-sm"><Link href="/privacy" className="text-emerald-800 underline">Privacy Notice</Link> · <Link href="/terms" className="text-emerald-800 underline">Terms of Use</Link></p>
    </main>
  );
}
