"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, Copy, KeyRound, Lock, LockOpen, Mail, Plus, Search, ShieldAlert,
  Sparkles, Star, Trash2, UserCog, UserPlus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  grantRole, revokeRole, setPrimaryRole, createAuthUser, resetUserPassword, deleteAuthUser,
  generateStrongPassword, lockUser, unlockUser, forcePasswordChange,
  sendPasswordResetEmail, updateUserEmail, updateUserMetadata, revokeAllSessions,
  type AdminUserRow, type OrgOption, type CompoundOption,
} from "@/lib/api/admin-users";
import { APP_ROLES, ROLE_LABELS } from "@/lib/constants";
import type { AppRole } from "@/types";

interface UsersManagerProps {
  users: AdminUserRow[];
  orgs: OrgOption[];
  compounds: CompoundOption[];
}

export function UsersManager({ users, orgs, compounds }: UsersManagerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked" | "unconfirmed">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.email ?? ""} ${u.full_name ?? ""} ${u.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter !== "all") {
        if (!u.roles.some((r) => r.role === roleFilter)) return false;
      }
      const locked = u.banned_until && new Date(u.banned_until) > new Date();
      if (statusFilter === "locked" && !locked) return false;
      if (statusFilter === "active" && locked) return false;
      if (statusFilter === "unconfirmed" && u.email_confirmed_at) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const lockedCount = users.filter((u) => u.banned_until && new Date(u.banned_until) > new Date()).length;
  const unconfirmedCount = users.filter((u) => !u.email_confirmed_at).length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total users" value={users.length} />
        <StatTile label="Active" value={users.length - lockedCount} tone="emerald" />
        <StatTile label="Locked" value={lockedCount} tone={lockedCount > 0 ? "rose" : undefined} />
        <StatTile label="Unconfirmed" value={unconfirmedCount} tone={unconfirmedCount > 0 ? "amber" : undefined} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">Any role</option>
          {APP_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
          <option value="unconfirmed">Unconfirmed email</option>
        </select>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          <UserPlus className="h-4 w-4" /> {showCreate ? "Cancel" : "New user"}
        </Button>
      </div>

      {showCreate && <CreateUserCard onDone={() => { setShowCreate(false); router.refresh(); }} />}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {users.length}
      </p>

      <div className="rounded-md border bg-card">
        {filtered.map((u, i) => {
          const open = expanded.has(u.id);
          const locked = u.banned_until && new Date(u.banned_until) > new Date();
          const unconfirmed = !u.email_confirmed_at;
          return (
            <div key={u.id} className={i > 0 ? "border-t" : ""}>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-sm">{u.email ?? "(no email)"}</p>
                    {locked && <Badge variant="destructive" className="text-[10px]"><Lock className="h-3 w-3" /> Locked</Badge>}
                    {unconfirmed && <Badge variant="muted" className="text-[10px]">Unconfirmed</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.full_name ?? "—"} · {u.roles.length} role{u.roles.length === 1 ? "" : "s"}
                    {u.last_sign_in_at && ` · last seen ${new Date(u.last_sign_in_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {u.roles.slice(0, 3).map((r) => (
                    <Badge key={r.id} variant={r.is_primary ? "default" : "muted"} className="text-[10px]">
                      {ROLE_LABELS[r.role]}
                    </Badge>
                  ))}
                  {u.roles.length > 3 && <Badge variant="muted" className="text-[10px]">+{u.roles.length - 3}</Badge>}
                  {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {open && (
                <div className="border-t bg-muted/20 p-4">
                  <UserDetail user={u} orgs={orgs} compounds={compounds} />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {users.length === 0 ? "No users found." : "No users match the current filters."}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Stats tile ─────────────────────────────────────────────────────────────

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "rose" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "";
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

// ─── Create user card ───────────────────────────────────────────────────────

function CreateUserCard({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, startTransition] = useTransition();

  async function generate() {
    try {
      const pw = await generateStrongPassword();
      setPassword(pw);
      await navigator.clipboard.writeText(pw).catch(() => {});
      toast.success("Strong password generated & copied");
    } catch (e) {
      toast.error("Generation failed", { description: e instanceof Error ? e.message : "" });
    }
  }

  function submit() {
    if (!email.trim() || password.length < 8) {
      toast.error("Email and password (≥8 chars) required");
      return;
    }
    startTransition(async () => {
      try {
        await createAuthUser({ email: email.trim(), password, full_name: fullName.trim() || undefined });
        toast.success("User created");
        setEmail(""); setPassword(""); setFullName("");
        onDone();
      } catch (err) {
        toast.error("Create failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create user</CardTitle>
        <CardDescription>
          The user will be email-confirmed automatically and can sign in immediately. Grant roles after creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="cu-email">Email</Label>
          <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="cu-pw">Password</Label>
          <div className="flex gap-1">
            <Input id="cu-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="≥ 8 chars" className="font-mono" />
            <Button type="button" size="sm" variant="outline" onClick={generate} title="Generate strong password">
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="cu-name">Full name (optional)</Label>
          <Input id="cu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="sm:col-span-3">
          <Button onClick={submit} disabled={pending} size="sm">
            <UserPlus className="h-4 w-4" /> {pending ? "Creating…" : "Create user"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Per-user detail ─────────────────────────────────────────────────────────

function UserDetail({ user, orgs, compounds }: { user: AdminUserRow; orgs: OrgOption[]; compounds: CompoundOption[] }) {
  const router = useRouter();
  const locked = !!(user.banned_until && new Date(user.banned_until) > new Date());

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="rounded-md border bg-background p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Identity</p>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <Detail label="User ID" value={<span className="font-mono">{user.id}</span>} copyValue={user.id} />
          <Detail label="Created" value={new Date(user.created_at).toLocaleString()} />
          <Detail label="Last sign-in" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"} />
          <Detail label="Email confirmed" value={user.email_confirmed_at ? new Date(user.email_confirmed_at).toLocaleDateString() : "—"} />
          {locked && (
            <Detail label="Locked until" value={<span className="text-rose-700">{new Date(user.banned_until!).toLocaleString()}</span>} />
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InlineEdit label="Email" initial={user.email ?? ""} onSave={async (v) => updateUserEmail(user.id, v)} />
          <InlineEdit label="Full name" initial={user.full_name ?? ""} onSave={async (v) => updateUserMetadata(user.id, { full_name: v })} />
        </div>
      </div>

      {/* Current roles */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Current roles</p>
        {user.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned. The user can sign in but won&apos;t see any modules.</p>
        ) : (
          <ul className="space-y-2">
            {user.roles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm">
                <div>
                  <p className="font-medium">{ROLE_LABELS[r.role]}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.role === "super_admin"
                      ? "Platform-wide"
                      : `${r.organization_name ?? "—"}${r.compound_name ? ` · ${r.compound_name}` : " · org-wide"}`}
                    {r.is_primary && " · primary"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!r.is_primary && (
                    <ActionBtn label="Set primary" icon={Star} onAction={() => setPrimaryRole(r.id, user.id)}
                      onSuccess="Primary set" onAfter={() => router.refresh()} />
                  )}
                  <ActionBtn label="Revoke" icon={X} destructive
                    onAction={() => revokeRole(r.id)} onSuccess="Role revoked"
                    onAfter={() => router.refresh()}
                    confirmText={`Revoke "${ROLE_LABELS[r.role]}" from ${user.email}?`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GrantRoleForm userId={user.id} orgs={orgs} compounds={compounds} onDone={() => router.refresh()} />

      {/* Password & access controls */}
      <div className="rounded-md border bg-background p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Password &amp; access</p>
        <div className="flex flex-wrap gap-2">
          <ResetPasswordButton userId={user.id} />
          <ActionBtn
            label="Send reset email"
            icon={Mail}
            onAction={() => sendPasswordResetEmail(user.email ?? "")}
            onSuccess="Reset email queued"
            onAfter={() => {}}
          />
          <ActionBtn
            label="Force change at next sign-in"
            icon={KeyRound}
            onAction={() => forcePasswordChange(user.id, true)}
            onSuccess="User will be prompted next sign-in"
            onAfter={() => router.refresh()}
          />
          <ActionBtn
            label="Sign out everywhere"
            icon={ShieldAlert}
            onAction={() => revokeAllSessions(user.id)}
            onSuccess="All sessions revoked"
            onAfter={() => router.refresh()}
            confirmText={`Sign ${user.email} out of all their devices?`}
          />
          {locked ? (
            <ActionBtn
              label="Unlock account"
              icon={LockOpen}
              onAction={() => unlockUser(user.id)}
              onSuccess="User unlocked"
              onAfter={() => router.refresh()}
            />
          ) : (
            <ActionBtn
              label="Lock for 1 year"
              icon={Lock}
              destructive
              onAction={() => lockUser(user.id, 24 * 365)}
              onSuccess="User locked"
              onAfter={() => router.refresh()}
              confirmText={`Lock ${user.email} out for 365 days? They won't be able to sign in.`}
            />
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-destructive">Danger zone</p>
        <ActionBtn label="Delete user permanently" icon={Trash2} destructive
          onAction={() => deleteAuthUser(user.id)} onSuccess="User deleted"
          onAfter={() => router.refresh()}
          confirmText={`Permanently delete ${user.email} and all their roles? This cannot be undone.`} />
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Detail({ label, value, copyValue }: { label: string; value: React.ReactNode; copyValue?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <span>{value}</span>
        {copyValue && (
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(copyValue); toast.success("Copied"); }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            title="Copy"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function InlineEdit({ label, initial, onSave }: { label: string; initial: string; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-0.5">{initial || "—"}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <UserCog className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1">
      <div className="flex-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
        <Input value={v} onChange={(e) => setV(e.target.value)} className="h-8 text-xs" />
      </div>
      <Button size="sm" onClick={() => {
        startTransition(async () => {
          try { await onSave(v); toast.success(`${label} updated`); setEditing(false); router.refresh(); }
          catch (e) { toast.error("Failed", { description: e instanceof Error ? e.message : "" }); }
        });
      }} disabled={pending}>{pending ? "…" : "Save"}</Button>
      <Button size="sm" variant="ghost" onClick={() => { setV(initial); setEditing(false); }}>Cancel</Button>
    </div>
  );
}

function GrantRoleForm({ userId, orgs, compounds, onDone }: { userId: string; orgs: OrgOption[]; compounds: CompoundOption[]; onDone: () => void }) {
  const [role, setRole] = useState<AppRole>("compound_manager");
  const [orgId, setOrgId] = useState<string>("");
  const [compoundId, setCompoundId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const filteredCompounds = compounds.filter((c) => !orgId || c.organization_id === orgId);

  function submit() {
    startTransition(async () => {
      try {
        await grantRole({
          user_id: userId,
          role,
          organization_id: role === "super_admin" ? null : (orgId || null),
          compound_id: role === "super_admin" ? null : (compoundId || null),
        });
        toast.success("Role granted");
        setCompoundId("");
        onDone();
      } catch (err) {
        toast.error("Grant failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Grant new role</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <select className="flex h-9 rounded-md border bg-background px-2 text-sm"
          value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
          {APP_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="flex h-9 rounded-md border bg-background px-2 text-sm"
          value={orgId} onChange={(e) => { setOrgId(e.target.value); setCompoundId(""); }}
          disabled={role === "super_admin"}>
          <option value="">— Organization —</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className="flex h-9 rounded-md border bg-background px-2 text-sm"
          value={compoundId} onChange={(e) => setCompoundId(e.target.value)}
          disabled={role === "super_admin" || role === "developer_admin" || !orgId}>
          <option value="">— Compound (optional) —</option>
          {filteredCompounds.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" onClick={submit} disabled={pending}>
          <Plus className="h-4 w-4" /> {pending ? "Granting…" : "Grant"}
        </Button>
      </div>
    </div>
  );
}

function ResetPasswordButton({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [pending, startTransition] = useTransition();

  async function generate() {
    const p = await generateStrongPassword();
    setPw(p);
    await navigator.clipboard.writeText(p).catch(() => {});
    toast.success("Strong password generated & copied");
  }

  function reset() {
    if (pw.length < 8) { toast.error("Password must be ≥ 8 chars"); return; }
    startTransition(async () => {
      try {
        await resetUserPassword(userId, pw);
        toast.success("Password reset — share securely with the user");
        setPw(""); setShow(false);
      } catch (err) {
        toast.error("Reset failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  if (!show) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShow(true)}>
        <KeyRound className="h-4 w-4" /> Set new password
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Input type="text" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)}
        className="h-9 w-48 font-mono" />
      <Button size="sm" variant="outline" onClick={() => void generate()} title="Generate"><Sparkles className="h-3.5 w-3.5" /></Button>
      <Button size="sm" onClick={reset} disabled={pending}>{pending ? "…" : "Set"}</Button>
      <Button size="sm" variant="ghost" onClick={() => { setShow(false); setPw(""); }}>Cancel</Button>
    </div>
  );
}

function ActionBtn({
  label, icon: Icon, onAction, onSuccess, onAfter, destructive, confirmText,
}: {
  label: string;
  icon: typeof X;
  onAction: () => Promise<void>;
  onSuccess: string;
  onAfter: () => void;
  destructive?: boolean;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  function go() {
    if (confirmText && !confirm(confirmText)) return;
    startTransition(async () => {
      try {
        await onAction();
        toast.success(onSuccess);
        onAfter();
      } catch (err) {
        toast.error("Action failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }
  return (
    <Button size="sm" variant={destructive ? "destructive" : "outline"} onClick={go} disabled={pending}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
