"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Email OTP login.
 *
 * We use the magic-link/OTP flow because:
 *   - No password reset surface to maintain
 *   - Works for new + existing users with the same form
 *   - Email proves ownership, which is the bar for inviting residents later
 *
 * On submit we fire signInWithOtp() with shouldCreateUser=true so first-time
 * residents get auto-provisioned. The OTP page handles the second factor.
 */
export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email });
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
      setError(msg);
      return;
    }

    startTransition(async () => {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) {
        setError(otpError.message);
        return;
      }

      toast.success("Check your email", {
        description: "We've sent you a 6-digit code.",
      });

      const redirect = search.get("redirect");
      const url = new URL("/verify-otp", window.location.origin);
      url.searchParams.set("email", parsed.data.email);
      if (redirect) url.searchParams.set("redirect", redirect);
      router.push(url.pathname + url.search);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your work email and we'll send you a one-time code.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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
          aria-invalid={!!error}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending code…" : "Send sign-in code"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to the SRP terms of service.
      </p>
    </form>
  );
}
