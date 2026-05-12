# Deployment Guide — SRP Phase 1

This guide walks through getting Phase 1 running locally and shipped to production. Follow the steps in order; each step depends on the previous.

---

## 1. Prerequisites

- Node.js 20+ (use `nvm` to pin)
- pnpm 9+ (`npm install -g pnpm`)
- Supabase CLI 1.207+ (`brew install supabase/tap/supabase`)
- A Vercel account
- A Supabase account

---

## 2. Local development

### 2.1 Install dependencies

```bash
pnpm install
```

### 2.2 Start Supabase locally

```bash
supabase start
```

This boots Postgres, Auth, Storage, and Studio in Docker. Output includes your local anon and service-role keys.

### 2.3 Apply migrations

```bash
supabase db reset
```

This drops the local DB, re-runs every file in `supabase/migrations/` in order, and applies `supabase/seed.sql` at the end. The migrations create the entire schema, RLS policies, audit triggers, and helper functions.

### 2.4 Set environment variables

```bash
cp .env.example .env.local
```

Fill `.env.local` with the values printed by `supabase start`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2.5 Run the dev server

```bash
pnpm dev
```

Open <http://localhost:3000>. The root redirects to `/login`.

### 2.6 Create the first super_admin

1. Sign in via OTP at `/login` with your email. In local mode, Supabase prints the OTP to its log instead of emailing — check `supabase logs` or the Inbucket inbox at <http://127.0.0.1:54324>.
2. After the auth user exists, edit `supabase/seed.sql`, replace `replace-me@example.com` with your actual email, then:

   ```bash
   supabase db execute --file supabase/seed.sql
   ```

3. Refresh the dashboard. You should now see the **Organizations** menu item (only super_admin and developer_admin see it).

### 2.7 Bootstrap an organization

From `psql` or the Supabase Studio SQL editor:

```sql
select public.bootstrap_organization('Acme Developments', 'acme', 'you@example.com');
```

This creates an organization and grants you `developer_admin` on it.

---

## 3. Cloud Supabase

### 3.1 Create the project

1. Go to <https://supabase.com/dashboard> → New project.
2. Pick a region close to your users (this affects auth latency).
3. Save the project ref (e.g., `xyzabc123`).

### 3.2 Link and push migrations

```bash
supabase link --project-ref <your-ref>
supabase db push
```

`db push` runs only the migrations that haven't been applied yet. Re-run safely.

### 3.3 Configure Auth

In the Supabase dashboard:

- **Authentication → URL Configuration**
  - Site URL: `https://your-domain.com`
  - Redirect URLs: add `https://your-domain.com/auth/callback`
- **Authentication → Email Templates**
  - Customize the magic-link template if desired (default works).
- **Authentication → Providers**
  - Email is on by default. Disable any provider you don't want.

### 3.4 Configure Auth rate limits

In **Authentication → Rate Limits**, tighten OTP requests-per-hour to a sensible number (default is permissive).

### 3.5 Generate types (recommended)

After your schema settles, regenerate the TypeScript types from the live schema so they stay in sync:

```bash
pnpm db:types
```

---

## 4. Vercel

### 4.1 Import the repo

1. <https://vercel.com/new> → import your Git repo.
2. Framework preset: **Next.js**. Build command and output directory are auto-detected.

### 4.2 Environment variables

In **Project → Settings → Environment Variables**, add — for both Preview and Production:

| Key                              | Value                                                |
|----------------------------------|------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | `https://<your-ref>.supabase.co`                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | from Supabase → Settings → API                       |
| `SUPABASE_SERVICE_ROLE_KEY`      | from Supabase → Settings → API (DO NOT expose)       |
| `NEXT_PUBLIC_APP_URL`            | `https://your-domain.com`                            |

### 4.3 Deploy

Push to your main branch. Vercel builds and deploys. The first request to `/api/health` should return:

```json
{ "status": "ok", "service": "srp", "timestamp": "..." }
```

### 4.4 Custom domain

In **Project → Settings → Domains**, add your domain. Update `NEXT_PUBLIC_APP_URL` and the Supabase Auth Site URL accordingly.

---

## 5. Post-deploy verification

Run through this checklist on production:

- [ ] `/api/health` returns 200
- [ ] `/login` renders without console errors
- [ ] OTP email arrives within 30s
- [ ] After OTP verify, `/dashboard` renders with the correct role badge
- [ ] Sidebar shows only the items your role allows
- [ ] Creating a resident persists and shows in the list
- [ ] Logging out clears the session and bounces you to `/login`
- [ ] Hitting `/dashboard` while logged out redirects to `/login?redirect=/dashboard`
- [ ] Hitting `/login` while logged in redirects to `/dashboard`

---

## 6. Operational notes

### Migrations going forward

```bash
supabase migration new <descriptive_name>
# edit the file in supabase/migrations/
supabase db push
```

Migrations are forward-only. To revert, write a new migration that undoes the change. Never edit a migration that's already been applied to production.

### Rotating the service role key

1. Supabase → Settings → API → Reset service_role key.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Production + Preview).
3. Redeploy.

The key is never exposed to the client — only used by `src/lib/supabase/admin.ts` and bootstrap scripts.

### Audit log retention

`public.audit_log` is unbounded. Before going live, add a retention job — either a scheduled Supabase Edge Function or a cron:

```sql
delete from public.audit_log where created_at < now() - interval '180 days';
```

---

## 7. What ships in Phase 1

| Surface                              | Status |
|--------------------------------------|--------|
| Supabase migrations (5 files)        | ✅     |
| RLS on every domain table            | ✅     |
| 7-role RBAC enforced in middleware + DB | ✅  |
| Email OTP auth + callback            | ✅     |
| Responsive admin shell               | ✅     |
| Residents list / detail / create     | ✅     |
| Units list                           | ✅     |
| Buildings list                       | ✅     |
| Compounds list                       | ✅     |
| Organizations list                   | ✅     |
| Settings page                        | ✅     |
| Health endpoint                      | ✅     |
| Audit trigger on every table         | ✅     |

Phase 2 adds: compound/building/unit create + edit forms, resident invitation flow, basic announcements.
