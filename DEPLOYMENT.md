# Public deployment guide

This guide is for deploying Keja Mtaani with a `.co.ke` domain, Vercel, and Supabase. It
assumes you control the domain and Supabase project. Use a staging project before changing a
production database.

## 1. Check the project before deploying

From the project folder, run:

```powershell
npm ci
npm audit
npm run typecheck
npm run build
```

All four commands should complete successfully. The current application expects the latest
database schema. In particular, the configured Supabase database must have
`listings.availability_date`; without it, the home page cannot load listings. For a
database that already has the earlier baseline schema, back it up and review/apply
[`supabase/migrations/202610070001_launch_workflows.sql`](./supabase/migrations/202610070001_launch_workflows.sql)
in staging first. For a brand-new project, review/apply [`docs/schema.sql`](./docs/schema.sql)
instead. Do not run the baseline schema over an existing project as a substitute for its
migration.

Before accepting real listings, resolve the STOP items in
[`HOSTING-CHECKLIST.txt`](./HOSTING-CHECKLIST.txt), including the legal review, real and
consented property data, verified contact details, and a staffed moderation process.

## 2. Put the source in a private Git repository

This workspace is not currently a Git repository. Create a private GitHub repository (or
another Git host), then initialize and push the project from PowerShell:

```powershell
git init -b main
git status --short
git add .
git status --short
git commit -m "Prepare Keja Mtaani for deployment"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

The `.gitignore` excludes `.env*`. Check `git status` before committing and never force-add
`.env.local`, Supabase service-role keys, database passwords, OAuth secrets, or SMTP
credentials. Only the public Supabase project URL and publishable/anon key belong in the
browser-accessible `NEXT_PUBLIC_` variables. Keep `package-lock.json` in the repository.

## 3. Prepare Supabase

1. Create a Supabase project. Choose an available region based on expected user latency,
   legal/privacy requirements, and the plan's backup and recovery features.
2. Back up the database. Apply the correct reviewed schema from section 1 to a staging
   project first. Confirm the migration succeeds before applying it to production.
3. Test row-level security with separate unauthenticated, tenant, landlord, and authorized
   staff accounts. Confirm landlords cannot change other landlords' listings, unpublished
   listings and photos stay private, and only authorized staff can publish a listing.
4. Configure and test the private `listing-photos` Storage bucket and its policies. Do not
   put identity documents or other sensitive files in the listing-photo bucket.
5. Under Supabase **Authentication → URL Configuration**, set the **Site URL** to the
   canonical production origin, for example `https://yourname.co.ke`. Add these exact
   production redirect URLs to the allow list:

   ```text
   https://yourname.co.ke/auth/callback
   https://yourname.co.ke/auth/reset
   ```

   If you use `www`, decide which hostname is canonical and configure its redirect to that
   hostname. Add localhost or Vercel preview URLs only if needed, and restrict them to the
   exact development/preview patterns you use.
6. For Google sign-in, enable Google in Supabase Auth and enter the OAuth client ID and
   secret in Supabase (not in frontend code). In the Google Cloud OAuth client, add the
   callback URI shown by the Supabase Google provider settings; it is usually
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. Also set the authorized web
   origin as required by Google's console.
7. Configure production email delivery in Supabase Auth. Set and verify the sender domain,
   confirmation/reset email templates, and redirect links. Test signup confirmation and
   password recovery on the production domain.
8. Copy the project's Supabase URL and publishable/anon key from its API settings. Never
   use the service-role key in this Next.js app.

## 4. Deploy the app to Vercel

1. Create a Vercel account and import the private Git repository. Select the Next.js
   framework preset; Vercel should detect the build and output settings automatically.
2. In the Vercel project's **Settings → Environment Variables**, add the following for
   Production (and Preview too if preview deployments should connect to a separate,
   non-production Supabase project):

   ```text
   NEXT_PUBLIC_APP_URL=https://yourname.co.ke
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

   Use the canonical HTTPS origin for `NEXT_PUBLIC_APP_URL`, with no trailing slash. Set
   the production Supabase values only in the Production environment. Do not create a
   `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` variable.
3. Deploy a Preview first. Test account creation, confirmation email, Google sign-in,
   password reset, listing search, map, listing submissions, photo access, and dashboard
   role separation against the staging Supabase project.
4. After staging checks pass, apply the reviewed migration to production if applicable,
   add the Production environment variables, and deploy the intended `main` commit.
5. Inspect Vercel build/runtime logs and test `https://your-vercel-project.vercel.app/api/health`.
   A successful health response checks only that the web app responds; it does not verify
   Supabase, email, or Storage.

## 5. Register and connect the `.co.ke` domain

1. Choose a registrar listed as accredited by the Kenya Network Information Centre
   (KeNIC). Check current `.co.ke` pricing, renewal fees, registration requirements, and
   transfer/renewal rules with that registrar before purchasing. Register a name you have
   rights to use, enable renewal reminders/auto-renew, and secure the registrar account
   with MFA.
2. In the Vercel project, open **Settings → Domains** and add the chosen domain, for
   example `yourname.co.ke`. Add `www.yourname.co.ke` too if you want it available, and
   choose one canonical hostname.
3. Vercel will display the DNS records currently required for that project. At your
   registrar's DNS management page, enter exactly those records for the apex domain and
   `www`; values can change, so use Vercel's displayed values rather than copying an old
   IP address or record from a tutorial. Remove conflicting records for those same host
   names, but do not remove unrelated email records such as MX, SPF, DKIM, or DMARC.
4. If the domain uses custom nameservers, manage DNS at the provider those nameservers
   point to. Otherwise, manage it at the registrar. Do not switch nameservers unless you
   have copied all existing DNS records, especially email records.
5. Wait for DNS propagation. Confirm Vercel marks the domain valid and provisions HTTPS.
   Configure the `www` ↔ apex redirect in Vercel so there is one canonical public URL.
6. Update `NEXT_PUBLIC_APP_URL` in Vercel to that canonical `https://` URL and redeploy.
   Update Supabase Auth's Site URL and allowed redirect URLs to match exactly. Re-test
   email confirmation, Google OAuth, password reset, and sign-out on the custom domain.

## 6. Final launch checks and operations

- Complete every applicable item in [`HOSTING-CHECKLIST.txt`](./HOSTING-CHECKLIST.txt).
- Remove demo/sample listings and replace them only with accurate, consented, verified
  content. Confirm the public site never presents demo details as genuine.
- Verify the production schema, RLS, storage access, image approval flow, login and
  recovery with separate test accounts before inviting the public.
- Configure an external uptime check for `/api/health`, error monitoring, backup alerts,
  and an identified person responsible for responding. Test database restore and rollback.
- Keep M-Pesa and any payment claims disabled unless a real integration is separately
  implemented, tested, and approved.
- Review Vercel, Supabase, registrar, email, and map-provider costs, quotas, and terms
  regularly. Free plans and provider limits can change.
