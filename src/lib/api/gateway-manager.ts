"use server";

/**
 * Phase 22 — Server actions for the Payment Gateway Manager.
 *
 * Lets super_admins:
 *   • list gateways (with secrets masked)
 *   • create a new gateway (insert credentials)
 *   • update credentials/config/enabled
 *   • delete a gateway (non-built-in only)
 *   • toggle enabled
 *
 * Built-in providers (cash/bank/cheque/wallet) can be toggled but not deleted.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { BUILTIN_PROVIDERS, type ProviderId } from "@/lib/payments/gateway-types";

export interface GatewayRow {
  id:                   string;
  organization_id:      string | null;
  provider:             ProviderId;
  display_name:         string;
  enabled:              boolean;
  sort_order:           number;
  supported_methods:    string[];
  supported_currencies: string[];
  has_credentials:      boolean;          // whether credentials JSONB has any keys
  config:               Record<string, unknown>;
  last_health_check:    string | null;
  last_health_ok:       boolean | null;
}

/** List ALL gateway rows. Credentials are stripped — use getGateway for editing. */
export async function listGateways(): Promise<GatewayRow[]> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("payment_gateways")
    .select("id, organization_id, provider, display_name, enabled, sort_order, supported_methods, supported_currencies, credentials, config, last_health_check, last_health_ok")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id:                   r.id,
    organization_id:      r.organization_id ?? null,
    provider:             r.provider as ProviderId,
    display_name:         r.display_name,
    enabled:              r.enabled,
    sort_order:           r.sort_order,
    supported_methods:    r.supported_methods ?? [],
    supported_currencies: r.supported_currencies ?? [],
    has_credentials:      Object.keys(r.credentials ?? {}).length > 0,
    config:               (r.config ?? {}) as Record<string, unknown>,
    last_health_check:    r.last_health_check ?? null,
    last_health_ok:       r.last_health_ok ?? null,
  }));
}

/** Returns full row INCLUDING credentials. super_admin only. */
export async function getGateway(id: string): Promise<(GatewayRow & { credentials: Record<string, unknown> }) | null> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("payment_gateways")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id:                   data.id,
    organization_id:      data.organization_id ?? null,
    provider:             data.provider as ProviderId,
    display_name:         data.display_name,
    enabled:              data.enabled,
    sort_order:           data.sort_order,
    supported_methods:    data.supported_methods ?? [],
    supported_currencies: data.supported_currencies ?? [],
    has_credentials:      Object.keys(data.credentials ?? {}).length > 0,
    config:               (data.config ?? {}) as Record<string, unknown>,
    credentials:          (data.credentials ?? {}) as Record<string, unknown>,
    last_health_check:    data.last_health_check ?? null,
    last_health_ok:       data.last_health_ok ?? null,
  };
}

export interface CreateGatewayInput {
  provider:             ProviderId;
  display_name:         string;
  enabled?:             boolean;
  sort_order?:          number;
  supported_methods?:   string[];
  supported_currencies?: string[];
  credentials?:         Record<string, unknown>;
  config?:              Record<string, unknown>;
  organization_id?:     string | null;
}

export async function createGateway(input: CreateGatewayInput): Promise<{ id: string }> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("payment_gateways").insert({
    organization_id:      input.organization_id ?? null,
    provider:             input.provider,
    display_name:         input.display_name,
    enabled:              input.enabled ?? true,
    sort_order:           input.sort_order ?? 100,
    supported_methods:    input.supported_methods ?? ["online_payment"],
    supported_currencies: input.supported_currencies ?? [],
    credentials:          input.credentials ?? {},
    config:               input.config ?? {},
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/master/gateways");
  return { id: data.id as string };
}

export interface UpdateGatewayInput {
  id:                    string;
  display_name?:         string;
  enabled?:              boolean;
  sort_order?:           number;
  supported_methods?:    string[];
  supported_currencies?: string[];
  /** Pass null to leave unchanged; pass {} to clear; pass partial to merge. */
  credentials?:          Record<string, unknown> | null;
  config?:               Record<string, unknown>;
}

export async function updateGateway(input: UpdateGatewayInput): Promise<void> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.display_name         !== undefined) patch.display_name         = input.display_name;
  if (input.enabled              !== undefined) patch.enabled              = input.enabled;
  if (input.sort_order           !== undefined) patch.sort_order           = input.sort_order;
  if (input.supported_methods    !== undefined) patch.supported_methods    = input.supported_methods;
  if (input.supported_currencies !== undefined) patch.supported_currencies = input.supported_currencies;
  if (input.config               !== undefined) patch.config               = input.config;
  if (input.credentials          !== undefined && input.credentials !== null) {
    // Merge by reading current then overwriting changed keys (so empty fields don't clobber).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cur } = await (supabase as any)
      .from("payment_gateways")
      .select("credentials")
      .eq("id", input.id)
      .maybeSingle();
    const current = (cur?.credentials ?? {}) as Record<string, unknown>;
    patch.credentials = { ...current, ...input.credentials };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("payment_gateways")
    .update(patch)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/gateways");
}

export async function toggleGateway(id: string, enabled: boolean): Promise<void> {
  await updateGateway({ id, enabled });
}

export async function deleteGateway(id: string): Promise<void> {
  await requireRole(["super_admin", "developer_admin"]);
  const supabase = await createClient();
  // Check it's not a built-in provider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("payment_gateways")
    .select("provider")
    .eq("id", id)
    .maybeSingle();
  if (!row) throw new Error("Gateway not found");
  if (BUILTIN_PROVIDERS.includes(row.provider as ProviderId)) {
    throw new Error("Built-in providers (cash/bank/cheque/wallet) cannot be deleted — toggle them off instead");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("payment_gateways").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/master/gateways");
}
