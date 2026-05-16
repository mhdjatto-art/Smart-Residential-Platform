/**
 * Audit-logging RPC wrapper.
 *
 * Wraps a Supabase .rpc() call so every admin-level RPC is recorded in the
 * audit_log table along with the calling user, params (redacted), and outcome.
 *
 * Sensitive credentials are stripped before logging via stripSecrets().
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/errors";

const SECRET_KEYS = new Set([
  "password","secret","secret_key","api_key","api_token","webhook_secret",
  "publishable_key","merchant_key","credentials","p_metadata",
]);

function stripSecrets(input: unknown): unknown {
  if (input == null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(stripSecrets);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      out[k] = stripSecrets(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface AuditContext {
  /** Free-text action label, e.g. "toggle_feature_flag". */
  action: string;
  /** Optional target id (row being changed). */
  targetId?: string;
  /** Optional target type, e.g. "feature_flag", "user_role". */
  targetType?: string;
}

/**
 * Type-safe wrapper around supabase.rpc that ALSO records the call in audit_log.
 *
 * Returns the data the RPC returns.
 *
 * The audit insert is best-effort — if it fails (e.g. table missing in dev),
 * we log a warning and still return the RPC result.
 */
export async function auditedRpc<T = unknown>(
  fnName: string,
  params: Record<string, unknown>,
  context: AuditContext,
): Promise<T> {
  const supabase = await createClient();
  const startedAt = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fnName, params);

  // Always log — both successes and failures.
  const durationMs = Date.now() - startedAt;
  const userRes = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const userId = userRes.data?.user?.id ?? null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_log").insert({
      user_id:     userId,
      action:      context.action,
      target_type: context.targetType ?? null,
      target_id:   context.targetId ?? null,
      details: {
        rpc:        fnName,
        params:     stripSecrets(params),
        duration_ms: durationMs,
        success:    !error,
        error:      error ? getErrorMessage(error) : null,
      },
    });
  } catch (auditErr) {
    logger.warn("audit", `audit_log insert failed for ${fnName}`, auditErr);
  }

  if (error) {
    throw new Error(getErrorMessage(error));
  }
  return data as T;
}
