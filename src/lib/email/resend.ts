/**
 * Minimal Resend client — no npm dependency.
 *
 * Required env vars:
 *   RESEND_API_KEY   — re_...
 *   EMAIL_FROM       — "Bonyan <no-reply@yourdomain.com>"
 *
 * If RESEND_API_KEY is missing, isEmailConfigured() returns false and
 * sendEmail() becomes a no-op (logs + returns success). This keeps dev
 * environments working without credentials.
 */

import "server-only";

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    console.log("[email] skipped (not configured):", input.subject, "→", input.to);
    return { ok: true, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.EMAIL_FROM!;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.reply_to,
        tags: input.tags,
      }),
    });

    const json = (await res.json()) as { id?: string; message?: string; error?: string };

    if (!res.ok) {
      const msg = json.message ?? json.error ?? `HTTP ${res.status}`;
      console.error("[email] Resend error:", msg, "→", input.to);
      return { ok: false, error: msg };
    }

    console.log("[email] sent:", json.id, "→", input.to, "subject:", input.subject);
    return { ok: true, id: json.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    console.error("[email] threw:", msg);
    return { ok: false, error: msg };
  }
}
