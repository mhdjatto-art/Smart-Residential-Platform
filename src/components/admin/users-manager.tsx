"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, KeyRound, Plus, Star, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  grantRole, revokeRole, setPrimaryRole, createAuthUser, resetUserPassword, deleteAuthUser,
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

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} user{users.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          <UserPlus className="h-4 w-4" /> {showCreate ? "Cancel" : "New user"}
        </Button>
      </div>

      {showCreate && <CreateUserCard onDone={() => { setShowCreate(false); router.refresh(); }} />}

      <div className="rounded-md border bg-card">
        {users.map((u, i) => {
          const open = expanded.has(u.id);
          return (
            <div key={u.id} className={i > 0 ? "border-t" : ""}>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{u.email ?? "(no email)"}</p>
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
        {users.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </div>
    </div>
  );
}

// ─── Create user card ───────────────────────────────────────────────────────

function CreateUserCard({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, startTransition] = useTransition();

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
        <CardDescription>The user will be email-confirmed automatically and can sign in immediately.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="cu-email">Email</Label>
          <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="cu-pw">Password</Label>
          <Input id="cu-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="≥ 8 chars" />
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

  return (
    <div className="space-y-4">
      {/* Current roles */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Current roles</p>
        {user.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
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
                    <RoleBtn label="Set primary" icon={Star} onAction={() => setPrimaryRole(r.id, user.id)}
                      onSuccess="Primary set" onAfter={() => router.refresh()} />
                  )}
                  <RoleBtn label="Revoke" icon={X} destructive
                    onAction={() => revokeRole(r.id)} onSuccess="Role revoked"
                    onAfter={() => router.refresh()}
                    confirmText={`Revoke "${ROLE_LABELS[r.role]}" from ${user.email}?`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Grant new role */}
      <GrantRoleForm userId={user.id} orgs={orgs} compounds={compounds} onDone={() => router.refresh()} />

      {/* Danger zone */}
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-destructive">Danger zone</p>
        <div className="flex flex-wrap gap-2">
          <ResetPasswordButton userId={user.id} />
          <RoleBtn label="Delete user" icon={Trash2} destructive
            onAction={() => deleteAuthUser(user.id)} onSuccess="User deleted"
            onAfter={() => router.refresh()}
            confirmText={`Permanently delete ${user.email} and all their roles? This cannot be undone.`} />
        </div>
      </div>
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

  function reset() {
    if (pw.length < 8) { toast.error("Password must be ≥ 8 chars"); return; }
    startTransition(async () => {
      try {
        await resetUserPassword(userId, pw);
        toast.success("Password reset");
        setPw(""); setShow(false);
      } catch (err) {
        toast.error("Reset failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  if (!show) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShow(true)}>
        <KeyRound className="h-4 w-4" /> Reset password
      </Button>
    );
  }
  return (
    <div className="flex gap-1">
      <Input type="text" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)}
        className="h-9 w-48" />
      <Button size="sm" onClick={reset} disabled={pending}>{pending ? "…" : "Set"}</Button>
      <Button size="sm" variant="ghost" onClick={() => { setShow(false); setPw(""); }}>Cancel</Button>
    </div>
  );
}

function RoleBtn({
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
