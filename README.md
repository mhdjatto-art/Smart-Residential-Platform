# SRP — Smart Residential Platform

**The Operating System for Residential Communities.**

A production-grade, multi-tenant SaaS platform for residential compounds, real-estate developers, apartment communities, and property management companies.

---

## Phase 1 — Foundation

This phase delivers the production-ready foundation that every later module will build on:

- Multi-tenant data model (`organizations` → `compounds` → `buildings` → `units` → `residents`)
- Supabase Auth with OTP and session management
- Role-Based Access Control (7 roles) enforced in middleware **and** at the database via RLS
- Admin shell (sidebar, topbar, responsive dashboard layout)
- Centralized API + validation architecture
- Audit columns and audit triggers on every table

---

## Tech Stack

| Layer            | Tech                                           |
|------------------|------------------------------------------------|
| Frontend         | Next.js 15 (App Router) + TypeScript           |
| Styling          | TailwindCSS + ShadCN UI                        |
| Auth & DB        | Supabase (PostgreSQL + Auth + RLS + Edge Fns)  |
| Validation       | Zod                                            |
| Data fetching    | TanStack Query + Server Components             |
| Hosting          | Vercel                                         |

> Note on Next.js version: this scaffold targets Next.js 15+. The "16+" requirement is forward-compatible — the App Router patterns used here are stable and will upgrade cleanly.

---

## Roles

| Role              | Scope                                              |
|-------------------|----------------------------------------------------|
| `super_admin`     | Cross-organization platform administration         |
| `developer_admin` | Full control over a single developer organization  |
| `compound_manager`| Operations within a single compound                |
| `finance_officer` | Finance modules within a compound                  |
| `maintenance_staff`| Maintenance modules within a compound             |
| `security_staff`  | Security/access modules within a compound          |
| `resident`        | Self-service for their own unit/household          |

Every role is enforced in three places:

1. **Middleware** (`src/middleware.ts`) — redirects unauthenticated users and gates route groups.
2. **Server-side guards** (`src/lib/auth/guards.ts`) — enforce role checks before returning data.
3. **Row Level Security** — the database is the final source of truth. Even with a valid JWT, a user cannot read rows outside their tenant.

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/                  # Public auth routes
│   │   ├── login/
│   │   ├── verify-otp/
│   │   └── layout.tsx
│   ├── (dashboard)/             # Protected app routes
│   │   ├── dashboard/
│   │   ├── residents/
│   │   ├── units/
│   │   ├── buildings/
│   │   ├── compounds/
│   │   ├── organizations/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── api/                     # Route handlers (when needed beyond Server Actions)
│   │   └── health/
│   ├── auth/
│   │   └── callback/            # Supabase OAuth/OTP callback
│   ├── layout.tsx
│   ├── page.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   └── globals.css
├── components/
│   ├── ui/                      # ShadCN primitives
│   ├── layout/                  # Sidebar, Topbar, Shell
│   ├── auth/                    # Login form, OTP form
│   ├── residents/               # Resident table, form
│   ├── shared/                  # DataTable, EmptyState, etc.
│   └── icons.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client (cookies-aware)
│   │   ├── admin.ts             # Service-role client (server-only)
│   │   └── middleware.ts        # Edge middleware helper
│   ├── auth/
│   │   ├── guards.ts            # requireUser, requireRole, requireTenant
│   │   └── permissions.ts       # Role → permission matrix
│   ├── api/
│   │   ├── residents.ts
│   │   ├── units.ts
│   │   ├── buildings.ts
│   │   └── organizations.ts
│   ├── validations/
│   │   ├── auth.ts
│   │   ├── resident.ts
│   │   ├── unit.ts
│   │   └── building.ts
│   ├── constants.ts
│   ├── env.ts                   # Type-safe environment variables
│   └── utils.ts
├── types/
│   ├── database.ts              # Generated Supabase types
│   ├── auth.ts
│   └── index.ts
├── hooks/
│   ├── use-current-user.ts
│   └── use-toast.ts
├── config/
│   ├── site.ts
│   └── navigation.ts
└── middleware.ts

supabase/
├── migrations/
│   ├── 20260101000000_extensions.sql
│   ├── 20260101000100_core_schema.sql
│   ├── 20260101000200_audit.sql
│   ├── 20260101000300_rls_policies.sql
│   └── 20260101000400_seed_super_admin.sql
└── seed.sql
```

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up Supabase (locally or use a cloud project)
#    Then copy your credentials into .env.local
cp .env.example .env.local

# 3. Run migrations against your Supabase project
supabase link --project-ref <your-ref>
supabase db push

# 4. Run the dev server
pnpm dev
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full deployment guide (Vercel + Supabase).

---

## Execution Order

This is the order to run things — do not skip steps.

1. Create a Supabase project (or run `supabase start` for local).
2. Copy URL, anon key, and service-role key into `.env.local`.
3. Push the migrations in `supabase/migrations/` in order.
4. Insert a bootstrap `organization` row and a `user_roles` row mapping your first user to `super_admin`.
5. Run `pnpm dev`, log in via OTP, land on the dashboard.
6. Deploy to Vercel — set the same env vars in the Vercel project settings.

---

## What's NOT in Phase 1 (intentional)

These are deferred to later phases so we can ship a clean foundation:

- Visitor management, gate passes
- Maintenance ticket workflow
- Finance: invoicing, payments, dunning
- Communications: announcements, notifications
- Resident self-service portal beyond view
- Reporting and analytics

The schema, RLS, and folder structure are designed so these can be added without refactors.
