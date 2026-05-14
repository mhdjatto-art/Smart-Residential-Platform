/**
 * Hardware test endpoint.
 *
 *   POST /api/hardware/test
 *   { providerId: string }
 *
 * Returns the result of probing the provider's adapter without making any
 * state-changing calls. Used by the /hardware-test admin console.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runHardwareTest, buildConfigFromProvider } from "@/lib/hardware-test/runner";
import type { AdapterKind } from "@/lib/hardware-test/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 5 tests / minute / IP to keep this from being a probe tool.
  const limited = enforceRateLimit(request, "hardware-test", 5, 60_000);
  if (limited) return limited;

  try {
    await requireRole(["super_admin", "developer_admin", "compound_manager"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { providerId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch provider + any integration row pointing at it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: provider, error: e1 } = await (supabase as any)
    .from("utility_providers")
    .select("id, provider_name, provider_type, adapter_kind, adapter_config")
    .eq("id", body.providerId)
    .maybeSingle();
  if (e1 || !provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integration } = await (supabase as any)
    .from("provider_integrations")
    .select("config_json")
    .eq("provider_id", body.providerId)
    .maybeSingle();

  const kind:   AdapterKind = provider.adapter_kind ?? "generic";
  const config              = buildConfigFromProvider(provider, integration ?? undefined);

  const result = await runHardwareTest(kind, config);

  return NextResponse.json({
    provider: {
      id:   provider.id,
      name: provider.provider_name,
      type: provider.provider_type,
      kind,
    },
    config: {
      endpoint:        config.endpoint,
      has_credentials: !!(config.apiKey || config.password || config.username),
    },
    result,
  });
}
