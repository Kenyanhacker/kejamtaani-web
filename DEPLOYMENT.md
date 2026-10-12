# Public deployment guide

This guide is for deploying Keja Mtaani with the `kejamtaani.co.ke` domain, Vercel, and Supabase. It
assumes you control the domain and Supabase project. A separate staging project is
recommended; if you only have one Supabase project, treat it as production, back it up,
apply reviewed SQL carefully, and use test accounts before inviting real users.

## 1. Check the project before deploying

From the project folder, run:

```powershell
npm ci
npm audit
npm run typecheck
npm run build
```

All four commands should complete successfully. The current application expects the latest database schema. In particular, the configured
Supabase database must have `listings.availability_date`; without it, the home page cannot
load listings. For a brand-new project, use [`docs/schema.sql`](./docs/schema.sql) only.
For an existing project, back it up and apply migrations 001 and 002 in sequence. Never
run the baseline schema over an existing project as a substitute for migrations.

Before accepting real listings, resolve the STOP items in
[`HOSTING-CHECKLIST.txt`](./HOSTING-CHECKLIST.txt), including the legal review, real and
consented property data, verified contact details, and a staffed moderation process.

## 2. Push the updated source to GitHub

This project is already connected to a Git repository. From the project root, check and
push the intended changes:

```powershell
git status --short
git add DEPLOYMENT.md README.md HOSTING-CHECKLIST.txt
git status --short
git commit -m "Correct production domain and deployment guide"
git push
```

If you also have other intended code changes, stage those files explicitly. Before
committing, inspect the staged changes and ensure `.env.local`, Supabase service-role keys,
database passwords, OAuth secrets, and SMTP credentials are not included. The `.gitignore`
excludes `.env*`. Only the public Supabase project URL and publishable/anon key belong in
browser-visible `NEXT_PUBLIC_` variables. Keep `package-lock.json` in the repository.

## 3. Prepare Supabase

1. Create a Supabase project. Choose an available region based on expected user latency,
   legal/privacy requirements, and the plan's backup and recovery features.
2. Back up the database. For a new project, run all of [`docs/schema.sql`](./docs/schema.sql)
   in SQL Editor. For an existing project, apply
   [`supabase/migrations/202610070001_launch_workflows.sql`](./supabase/migrations/202610070001_launch_workflows.sql)
   followed by
   [`supabase/migrations/202610070002_admin_moderation.sql`](./supabase/migrations/202610070002_admin_moderation.sql).
   Each existing-project migration should run once, in order, against a backed-up database.
3. Test row-level security with separate unauthenticated, tenant, landlord, and authorized
   staff accounts. Confirm landlords cannot change other landlords' listings, unpublished
   listings and photos stay private, and only authorized staff can publish a listing.
4. Configure and test the private `listing-photos` Storage bucket and its policies. Do not
   put identity documents or other sensitive files in the listing-photo bucket.
5. Under Supabase **Authentication → URL Configuration**, set the **Site URL** to the
   canonical production origin, `https://kejamtaani.co.ke` once the domain is connected.
   If you must initially use the Vercel URL, use that same origin as the Site URL and
   allow-list its callback/reset URLs during setup, then switch to the custom domain after
   HTTPS is active. Add these exact
   production redirect URLs to the allow list:

   ```text
   https://kejamtaani.co.ke/auth/callback
   https://kejamtaani.co.ke/auth/reset
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
8. Copy the project's URL, publishable/anon key, and server-side service-role secret from
   its API settings. The service-role key is highly privileged: use it only as Vercel's
   server-side secret for the protected moderation endpoint. Never put it in browser code,
   a `NEXT_PUBLIC_` variable, a ticket, or the Git repository.

## 4. Deploy the app to Vercel

1. Create a Vercel account and import the private Git repository. Select the Next.js
   framework preset; Vercel should detect the build and output settings automatically.
2. In the Vercel project's **Settings → Environment Variables**, add the following for
   Production:

   ```text
   NEXT_PUBLIC_APP_URL=https://kejamtaani.co.ke
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ADMIN_EMAILS=jothammasoud@gmail.com
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_SECRET
   ```

   Ideally attach the domain and wait for HTTPS before deploying. Set
   `NEXT_PUBLIC_APP_URL=https://kejamtaani.co.ke` (no trailing slash); if you temporarily
   use the Vercel deployment origin instead, update the Supabase Site URL and callback
   allowlist to match that origin too.
   Set all values only in Vercel's Production environment. The `SUPABASE_SERVICE_ROLE_KEY`
   is a server-only secret: never expose it in the browser, source code, repository, or any
   variable beginning with `NEXT_PUBLIC_`. `ADMIN_EMAILS` is a comma-separated exact email
   allowlist. Only confirmed Google accounts on that list can access `/admin`.
3. If you have no separate staging database, do not point a public Vercel Preview at your
   production Supabase project for tests that create or modify records. Deploy the intended
   `main` commit to Production only after reviewing the SQL and checking the domain/auth
   settings. Use dedicated test accounts and test listings, then remove them when done.
4. Test account creation, confirmation email, Google sign-in, password reset, listing
   search, map, listing submission, photo access, admin allowlisting, approve/reject, and
   dashboard role separation before inviting real users.
5. Inspect Vercel build/runtime logs and test your deployment's `/api/health`.
   A successful health response checks only that the web app responds; it does not verify
   Supabase, email, or Storage.

### If the custom domain shows `404 DEPLOYMENT_NOT_FOUND`

The current public check of `https://kejamtaani.co.ke/api/health` returned Vercel's
`DEPLOYMENT_NOT_FOUND` page, not this application's health response. DNS resolves to
Vercel, so first fix the Vercel project/deployment assignment rather than changing DNS
records at random:

1. In Vercel, open the project that imported the `Kenyanhacker/kejamtaani-web` repository.
   Confirm it has a successful **Production** deployment for the intended branch (usually
   `main`). A Preview deployment alone does not attach the production domain.
2. Open that project's **Settings → Domains**. Add `kejamtaani.co.ke` to this exact
   project, then assign it to the Production environment/current production deployment.
   Follow any domain verification or DNS correction Vercel itself reports.
3. If no project has imported this repository, import it first, set the production
   environment variables, and deploy the production branch. Then attach the domain.
4. Wait for Vercel to report the domain as configured and HTTPS active. Test both
   `https://kejamtaani.co.ke/` and `https://kejamtaani.co.ke/api/health` again.
5. If Vercel reports the domain is already assigned to another project/account, remove it
   from that project's domain settings (only if you own/control it), then add it to the
   correct project. Do not delete registrar records unless Vercel's domain panel identifies
   a specific incorrect/conflicting record.

If the domain starts serving the app but listing search or admin still fails, inspect the
Vercel Production runtime logs and check the Supabase environment values, schema/migrations,
and server-only admin secret separately. A successful Next.js build does not validate
those live integrations.

### If local search reports `ENOTFOUND` for Supabase

This means the machine could not resolve the configured Supabase hostname. It is not a
Next.js build error. I checked the hostname currently configured in this workspace against
the machine's resolver and independent public DNS resolvers; it did not resolve there.
Check the current project in Supabase before changing keys or DNS:

1. Open the Supabase project you intend to use and copy its exact **Project URL** from
   **Connect** or **Project Settings → API**. It must be the URL for that project, not a
   guessed project reference or a URL copied from an older project.
2. In the ignored local `.env.local`, set
   `NEXT_PUBLIC_SUPABASE_URL=https://YOUR_CURRENT_PROJECT_REF.supabase.co` to that exact
   Project URL and set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the matching publishable/anon
   key from the same project. Do not paste either value into public issue comments.
3. In PowerShell, verify the hostname resolves without printing your key:

   ```powershell
   $url = Get-Content .env.local | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1
   $hostName = ([uri]($url -replace '^NEXT_PUBLIC_SUPABASE_URL=', '')).DnsSafeHost
   Resolve-DnsName $hostName
   ```

4. Restart `npm run dev` after saving `.env.local`. If the correct Project URL still fails
   to resolve, test another network or check local DNS/VPN/firewall settings. If Supabase
   shows that project is paused or deleted, resume it if possible or create a new project
   and update the URL and key together.
5. In Vercel, update the Production `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the same project's matching values, then redeploy.
   Never put the service-role secret in the anon-key variable.

## 5. Sign in to and use the admin centre

1. In Supabase Auth, ensure Google sign-in is enabled. Use the Google account
   `jothammasoud@gmail.com` to sign in to the website; the account must be verified by
   Google/Supabase and its email must match `ADMIN_EMAILS` exactly.
2. Visit `https://kejamtaani.co.ke/auth`, continue with Google, and accept the required
   Terms/Privacy acknowledgement. The OAuth callback should send the configured admin
   account directly to `https://kejamtaani.co.ke/admin`. Other accounts must not receive
   admin access.
3. The admin centre includes pending listing review and private photo previews, open tenant
   reports, open privacy requests, and a searchable list of published homes. Approval
   publishes the rental and its approved photos. Rejection archives it and requires an
   internal reason; neither action deletes the submission.
4. If `/admin` shows a configuration error, confirm `ADMIN_EMAILS` and
   `SUPABASE_SERVICE_ROLE_KEY` are set for Vercel Production and that the database schema
   (including migration 002 for an existing database) is applied. Redeploy after changing
   Vercel environment variables.
5. Keep Google account MFA enabled and restrict access to Vercel/Supabase settings. Rotate
   the Supabase service-role secret immediately if it is accidentally exposed.

## 6. Register and connect the `.co.ke` domain

1. Choose a registrar listed as accredited by the Kenya Network Information Centre
   (KeNIC). Check current `.co.ke` pricing, renewal fees, registration requirements, and
   transfer/renewal rules with that registrar before purchasing. Register a name you have
   rights to use, enable renewal reminders/auto-renew, and secure the registrar account
   with MFA.
2. In the Vercel project, open **Settings → Domains** and add `kejamtaani.co.ke`. Add
   `www.kejamtaani.co.ke` too if you want it available, and
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
6. Set `NEXT_PUBLIC_APP_URL=https://kejamtaani.co.ke` in Vercel and redeploy.
   Update Supabase Auth's Site URL and allowed redirect URLs to match exactly. Re-test
   email confirmation, Google OAuth, password reset, and sign-out on the custom domain.

## 7. Final launch checks and operations

- Complete every applicable item in [`HOSTING-CHECKLIST.txt`](./HOSTING-CHECKLIST.txt).
- Remove demo/sample listings and replace them only with accurate, consented, verified
  content. Confirm the public site never presents demo details as genuine.
- Verify the production schema, RLS, storage access, image approval flow, login and
  recovery with separate test accounts before inviting the public.
- Confirm that `jothammasoud@gmail.com` signs in with Google and lands at
  `https://kejamtaani.co.ke/admin`; verify an unrelated account receives no admin access.
- Configure an external uptime check for `/api/health`, error monitoring, backup alerts,
  and an identified person responsible for responding. Test database restore and rollback.
- Keep M-Pesa and any payment claims disabled unless a real integration is separately
  implemented, tested, and approved.
- Review Vercel, Supabase, registrar, email, and map-provider costs, quotas, and terms
  regularly. Free plans and provider limits can change.
