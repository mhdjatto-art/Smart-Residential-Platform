# SRP — Architecture (Phase 1)

This is the architectural reasoning that backs the code. Read it before changing anything load-bearing — schema, auth flow, RLS, or middleware.

---

## Tenancy model

```
super_admin (platform)
   │
   └── organization      ← top-level tenant (developer / property mgmt firm)
         │
         └── compound    ← a specific residential project
               │
               └── building
                     │
                     └── unit
                           │
                           └── resident
```

Every table below `organization` carries `organization_id`. Every table below `compound` also carries `compound_id`. Both columns are **denormalized on purpose** — they make RLS policies an indexed equality check on a UUID rather than a multi-join. The triggers that audit changes also read these columns to scope the audit row, so even cross-cutting concerns stay tenant-aware.

The cost of denormalization is that all four columns must be set correctly on insert. The API layer (`src/lib/api/*.ts`) handles this — callers don't pass `organization_id` or `compound_id` directly. The server-side action resolves them from the parent record (the unit's `compound_id`, the compound's `organization_id`) so the values can't drift.

---

## Auth flow

1. User submits email at `/login`.
2. `supabase.auth.signInWithOtp()` sends a 6-digit code.
3. User is redirected to `/verify-otp?email=...`.
4. `supabase.auth.verifyOtp()` exchanges the code for a session.
5. Session cookies are set; `router.refresh()` triggers Server Components to re-read them.
6. `src/middleware.ts` runs on the next request and refreshes the token transparently.

The middleware does the auth check (any session at all). Page-level Server Components call `requireUser()` or `requireRole(...)` to enforce stricter rules. The database does the final check via RLS. **Three layers of defense; the database always wins.**

---

## RLS — the actual gate

Three things to know:

1. **Helper functions are `SECURITY DEFINER`.** `is_super_admin()`, `user_organization_ids()`, `user_compound_ids()`, and `user_has_management_role()` run with elevated privileges so they can read `user_roles` from inside a policy on another table without recursing. If you ever inline a `select from user_roles` in a policy on a different table, you're fine. If you do it on `user_roles` itself, you'll recurse.

2. **`FORCE ROW LEVEL SECURITY` is set on every table.** Even the table owner (the `postgres` superuser used by the service role) gets RLS applied. The service-role key bypasses RLS via its JWT claims, which is why `admin.ts` is locked to server-only code.

3. **Audit log is read-only to clients.** The `audit_log` table has a `SELECT` policy but no `INSERT/UPDATE/DELETE`. The trigger function is `SECURITY DEFINER` so it can write rows regardless. This means a compromised client can never tamper with the audit trail.

---

## Folder structure

The repository follows the structure documented in `README.md`. The non-obvious decisions:

- **`(auth)` and `(dashboard)` are route groups**, not URL prefixes. They share a layout but don't add `/auth` or `/dashboard` to the URL.
- **`src/lib/api/` files are `"use server"`.** They expose Server Actions and async data functions. Client components import them directly and call them like functions — Next handles the RPC.
- **`src/lib/supabase/admin.ts` imports `"server-only"`.** Importing it from a client component crashes the build, preventing service-role-key leakage.
- **`src/types/database.ts` is hand-written but matches `supabase gen types` output.** Run `pnpm db:types` after schema changes to regenerate from the live DB.

---

## RBAC matrix

The `ROLE_CAPABILITIES` map in `src/lib/auth/permissions.ts` defines what each role can do. It exists for the **UI** — to hide menu items and buttons. The **database** enforces the same rules via RLS. The two should never disagree, but if they do, RLS wins (you'll see "0 rows" instead of a 403; that's by design).

When adding a new capability:

1. Add the string to `Capability` in `permissions.ts`.
2. Add it to each role's array.
3. Add an RLS policy on the relevant table that matches.
4. Update `navigation.ts` if there's a corresponding sidebar item.

---

## Multi-org users

A user can have multiple `user_roles` rows — for example, `developer_admin` at Org A and `compound_manager` at Org B's Compound 7. The dashboard topbar shows the primary org (`is_primary = true` if set, otherwise the first one). Phase 2 will add an org switcher; for now, what you see in the data is the union of everything your roles allow.

---

## What's intentionally simple

- **No org/compound switcher.** Until we have many active users with multi-org access, the implicit "see everything your roles allow" is fine.
- **No invitation flow for residents.** Residents are added by staff today; a self-service portal is a later phase.
- **No write forms for compounds/buildings/organizations.** Bootstrap helpers cover Phase 1; full CRUD lands in Phase 2.
- **Hand-written types instead of generated.** Phase 1 ships before there's a live DB to generate from. After first deploy, switch to `pnpm db:types`.

These are deferred deliberately — none of them are blocking the foundation, and each ships clean in its own phase.
