"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { verifyOtpSchema } from "@/lib/validations/auth";

interface OtpFormProps {
  email: string;
  redirect: string;
}

export function OtpForm({ email, redirect }: OtpFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = verifyOtpSchema.safeParse({ email, token });
    if (!parsed.success) {
      setError("Enter the 6-digit code");
      return;
    }

    startTransition(async () => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.token,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // Hard refresh so server components re-read the new session cookie.
      router.replace(redirect);
      router.refresh();
    });
  }

  async function resend() {
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (resendError) {
      toast.error("Could not resend", { description: resendError.message });
      return;
    }
    toast.success("Code resent", { description: `Sent to ${email}` });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="token">Sign-in code</Label>
        <Input
          id="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          required
          placeholder="123456"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={pending}
          aria-invalid={!!error}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={pending || token.length !== 6}>
        {pending ? "Verifying…" : "Verify and continue"}
      </Button>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" className="font-medium hover:text-foreground" onClick={resend}>
          Resend code
        </button>
        <Link href="/login" className="font-medium hover:text-foreground">
          Use a different email
        </Link>
      </div>
    </form>
  );
}
