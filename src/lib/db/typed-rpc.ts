/**
 * Typed wrapper around supabase.rpc() — eliminates `any` casts at every call
 * site and surfaces error messages via getErrorMessage().
 *
 * Usage:
 *   const data = await typedRpc<MyReturn>(supabase, "set_feature_flag", { ... });
 *
 * The default generic is `unknown` so callers must explicitly assert the
 * return type when they need the typed result.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/errors";

export async function typedRpc<T = unknown>(
  client: SupabaseClient,
  fnName: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  // The Supabase client's .rpc signature is strict but doesn't accept dynamic
  // names without `as never` — we still want one explicit cast here, not at
  // every call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc(fnName, params);
  if (error) {
    throw new Error(getErrorMessage(error));
  }
  return data as T;
}
