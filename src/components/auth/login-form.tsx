"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";
import { checkLoginRate } from "@/lib/auth/rate-check";
import { useT } from "@/lib/i18n/client";
import { getErrorMessage } from "@/lib/errors";

/**
 * Pre-translated labels passed from the server page so the first paint
 * never shows untranslated keys (no hydration flash).
 */
export interface LoginFormLabels {
  sign_in_title:    string;
  sign_in_subtitle: string;
  email:            string;
  password:         string;
  sign_in:          string;
  invite_prompt:    string;
  sign_up:          string;
}

/**
 * Email + password login.
 *
 * No magic links, no OTP rate limits. Users are created by an admin in
 * Supabase Dashboard (or via the bootstrap helper SQL function) and given
 * a temporary password they change after first login.
 *
 * On success we hard-refresh so Server Components pick up the new session
 * cookie immediately.
 */
export function LoginForm({ labels }: { labels: LoginFormLabels }) {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"email" | "password" | "form", string>>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }

    startTransition(async () => {
      // Phase 23 — server-side rate limit before hitting Supabase Auth
      const gate = await checkLoginRate(parsed.data.email);
      if (!gate.allowed) {
        setErrors({ form: gate.message ?? "Too many attempts" });
        toast.error("Too many attempts", { description: gate.message });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        const msg = getErrorMessage(error);
        setErrors({ form: msg });
        toast.error("Sign in failed", { description: msg });
        return;
      }

      toast.success("Welcome back");
      // If user came from a deep-link, honor it. Otherwise send to "/" which is
      // a server-side redirect to the role-appropriate home (/m for residents,
      // /dashboard for admins).
      const redirect = search.get("redirect") || "/";
      router.replace(redirect);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{labels.sign_in_title}</h1>
        <p className="text-sm text-muted-foreground">{labels.sign_in_subtitle}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          aria-invalid={!!errors.password}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
      </div>

      {errors.form && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.form}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? `${labels.sign_in}…` : labels.sign_in}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {labels.invite_prompt} <a href="/signup" className="underline">{labels.sign_up}</a>
      </p>
    </form>
  );
}
