"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { peekInvite, redeemInvite, type InvitePreview } from "@/lib/api/invites";

export function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const initialCode = (search.get("code") ?? "").toUpperCase();

  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [verifying, startVerify] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  function verifyCode(c: string) {
    setPreview(null);
    if (!/^[A-Z0-9]{6,16}$/.test(c)) return;
    startVerify(async () => {
      try {
        const p = await peekInvite(c);
        setPreview(p);
        if (p.email_locked) setEmail(p.email_locked);
      } catch (err) {
        setPreview({ ok: false, error: err instanceof Error ? err.message : "Lookup failed" });
      }
    });
  }

  useEffect(() => {
    if (initialCode) verifyCode(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview?.ok) { toast.error("Enter a valid invite code first"); return; }
    startSubmit(async () => {
      try {
        const result = await redeemInvite({
          code: code.toUpperCase(),
          email: email.trim(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || undefined,
        });
        if (!result.ok) {
          toast.error("Signup failed", { description: result.error });
          return;
        }
        // Auto-login the new resident
        const { error: signErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signErr) {
          toast.success("Account created — please log in");
          router.replace("/login");
          return;
        }
        toast.success("Welcome aboard");
        router.replace("/m");
        router.refresh();
      } catch (err) {
        toast.error("Signup failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign up</h1>
        <p className="text-sm text-muted-foreground">
          Enter the invite code your building gave you to create your account.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Step 1 — invite code */}
        <div className="space-y-2">
          <Label htmlFor="code">Invite code</Label>
          <div className="flex gap-2">
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="A1B2C3D4"
              maxLength={16}
              className="font-mono uppercase tracking-widest"
              autoFocus
            />
            <Button type="button" variant="outline" onClick={() => verifyCode(code)} disabled={verifying || !code}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Verify
            </Button>
          </div>
        </div>

        {/* Preview block */}
        {preview && !preview.ok && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {preview.error}
          </div>
        )}
        {preview?.ok && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
            <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">You're joining</p>
                <p className="text-xs">
                  {preview.organization_name}
                  {preview.compound_name && ` · ${preview.compound_name}`}
                </p>
                <p className="text-xs">
                  {preview.building_name && `${preview.building_name} · `}
                  Unit <strong>{preview.unit_number}</strong> · as <strong>{preview.tenancy_type}</strong>
                </p>
                {preview.email_locked && (
                  <p className="mt-1 text-[11px] opacity-80">
                    This invite is locked to <strong>{preview.email_locked}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — user info (only after a valid invite) */}
        {preview?.ok && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required disabled={!!preview.email_locked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password (≥ 8 chars)</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+964..." />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </>
        )}
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </div>
  );
}
