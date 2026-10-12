# Keja Mtaani

Keja Mtaani is a Kenyan rental discovery platform built with Next.js. It is configured for free listings, free tenant browsing, and free viewing requests. There is no mandatory viewing fee and no operational M-Pesa payment flow in the default launch configuration.

## Quick start

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

## Environment configuration

Copy `.env.example` to `.env.local` and configure:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
ADMIN_EMAILS=jothammasoud@gmail.com
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_SECRET
```

The Supabase URL and publishable/anon key are browser-visible and rely on RLS. `ADMIN_EMAILS` and `SUPABASE_SERVICE_ROLE_KEY` are server-only settings; never use a `NEXT_PUBLIC_` prefix for the service-role key and never commit it.

## Free launch configuration

This project enforces a free-launch pricing configuration in `lib/launch-config.ts`:

- Landlord listing fees: KSh 0
- Tenant browsing fees: KSh 0
- Viewing request fees: KSh 0
- Landlord subscription fees: KSh 0
- Mandatory platform payments: disabled

The simulated M-Pesa route is intentionally disabled and returns a clear 410 error to prevent fake payment states.

## Database, accounts, and listings

Public search reads only published, non-demo Supabase listings. The landlord wizard saves drafts locally, then uploads compressed WebP photos and submits the listing to Supabase for review. Submissions remain private until an administrator approves them; landlords can see their own submissions, change availability to Available, Soon available, or Taken, and remove unpublished listings. Taken listings are excluded from tenant search. Favorites persist on the tenant's device.

The protected `/admin` moderation centre is available only to confirmed Google accounts in the server-only `ADMIN_EMAILS` allowlist. It reviews pending rental submissions and photos, tenant reports, privacy requests, and current published listings. Configure `ADMIN_EMAILS=jothammasoud@gmail.com` and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the deployment host; apply `docs/schema.sql` on a fresh database or both numbered migrations to an existing one before using moderation actions.

Landlords can edit listing details; edits to published listings return them to pending review and unapprove their photos. Landlords can set an expected date for soon-available homes and tenants see availability freshness. Authenticated tenants can submit viewing requests and listing reports, manage saved search filters, export account data, and submit privacy requests. Viewing requests are stored for both account dashboards; notifications are not yet emailed. Saved searches are not alert subscriptions yet.

The search map uses OpenStreetMap with click-to-choose centre and 2 km, 5 km, or 10 km radius filters. Published listings with coordinates appear as map pins; new landlord submissions must include an approximate pin. Pins shown publicly are rounded to reduce location precision. Search proximity is filtered and paginated in the database.

The home page also includes horizontally scrollable home-type shortcuts; property pages distinguish monthly rent from one-time move-in terms. Keja Mtaani uses its own house-and-pin SVG browser icon and generated Apple touch icon.

For a fresh Supabase project, review and apply `docs/schema.sql`. For an existing project with the earlier schema, back it up and apply [`supabase/migrations/202610070001_launch_workflows.sql`](./supabase/migrations/202610070001_launch_workflows.sql) followed by [`supabase/migrations/202610070002_admin_moderation.sql`](./supabase/migrations/202610070002_admin_moderation.sql). Do not run the baseline schema against an existing database.

The schema also includes policy-acceptance records, saved searches, privacy requests, viewing requests, tenant listing reports, content-edit re-review, rate limits, aggregate metrics, and the `run_retention_cleanup()` maintenance function. Back up before applying schema changes to a live database. The retention function is not scheduled, only archives eligible old unpublished records, and does not remove Storage blobs or inactive accounts.

The interactive map uses the public OpenStreetMap tile service and displays required attribution. Before a high-traffic production launch, review the OpenStreetMap tile usage policy and select a compliant tile provider if the public service is not suitable.

Email/password and Google auth are handled through server-side Supabase operations and HttpOnly cookies in production. Password recovery also needs Supabase email templates, an allow-listed `/auth/reset` redirect, and live end-to-end verification.

`GET /api/health` is a basic uptime probe only; configure an external monitoring provider and alerts. `GET /api/privacy/export` provides a signed-in account export. Deletion requests are queued for manual handling and do not automatically delete accounts.

## Deployment

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for the end-to-end Vercel, Supabase, and
`kejamtaani.co.ke` setup. Use [HOSTING-CHECKLIST.txt](./HOSTING-CHECKLIST.txt) for launch blockers,
security/operations checks, and the detailed smoke-test list.

## Quick deployment checklist

1. Run `npm ci`, `npm audit`, `npm run typecheck`, and `npm run build`.
2. Configure Supabase Auth, production email delivery, and Google OAuth redirect URLs.
3. Back up the database; apply `docs/schema.sql` to a fresh project or migrations 001 and 002 in order to an existing project, then test tenant/landlord RLS, Storage, image approval, moderation, viewing requests, privacy requests, consent audit, and interaction history using separate accounts.
4. Configure `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your host.
5. Use a separate Supabase project for Preview tests; otherwise, deploy to Production only after reviewing the database changes and use clearly marked test accounts/listings.
6. Keep `mandatoryPlatformPaymentsEnabled` false until a separately approved payment integration is live.

## Improvements delivered

Numbered migrations provide versioned SQL upgrades, but a migration runner and automated end-to-end/RLS suite are not configured. See [IMPROVEMENTS.txt](./IMPROVEMENTS.txt) for the existing project improvement history.

## Remaining launch work

- Live Supabase, Google OAuth, SMTP, Storage policy, database migration, and recovery-flow testing.
- Staffed moderation process and verified listing ownership/content; the `/admin` queue now exists but still requires live testing and an on-call reviewer.
- Legal review and completion of draft `/privacy`, `/terms`, and `/retention` pages; automated retention scheduling, Storage cleanup, inactive-account handling, and actual account deletion remain outstanding.
- Viewing-request email notifications, production monitoring provider, backups, restore and rollback testing.
- Saved search filters work, but email alert delivery is not configured.
- Numbered migrations are provided; an automated migration runner and end-to-end/RLS tests are not configured.
- Live-test map selection/nearby search and comply with the selected map tile provider's usage terms. M-Pesa remains disabled.

The application is **not ready for public launch** until these requirements are configured and verified. The repository contains no live production credentials, so provider-dependent behavior cannot be certified here.
