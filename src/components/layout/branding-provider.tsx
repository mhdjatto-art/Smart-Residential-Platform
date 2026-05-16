import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface BrandRow {
  logo_path: string | null;
  logo_dark_path: string | null;
  favicon_path: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string | null;
  font_family: string;
  custom_css: string | null;
  email_footer: string | null;
}

/**
 * Server component that fetches the active organization's branding and renders
 * a `<style>` block + favicon override before children. CSS variables let the
 * existing tailwind theme cascade — only the primary/accent hues change.
 *
 * `--brand-primary` and `--brand-accent` are emitted plus the chained
 * `--primary` shadcn token so buttons/links pick up the override automatically.
 *
 * Renders nothing if no orgId is provided or branding doesn't exist — preserves
 * the default SRP look-and-feel.
 */
export async function BrandingProvider({ orgId, children }: { orgId: string | null; children: React.ReactNode }) {
  if (!orgId) return <>{children}</>;

  let brand: BrandRow | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_branding")
      .select("logo_path, logo_dark_path, favicon_path, primary_color, accent_color, background_color, font_family, custom_css, email_footer")
      .eq("organization_id", orgId)
      .maybeSingle();
    brand = (data as unknown as BrandRow) ?? null;
  } catch (e) {
    // Soft fail — never block the page on branding lookup
    logger.error("branding-provider", "failed", e);
  }

  if (!brand) return <>{children}</>;

  // Convert hex → HSL-ish for tailwind's `hsl(var(--primary))` consumers.
  // Simpler approach: override the raw `--primary` background with the hex; shadcn
  // only uses `hsl(var(--primary))` for primary-bg and similar tokens.
  const css = `
    :root {
      --brand-primary: ${brand.primary_color};
      --brand-accent:  ${brand.accent_color};
      ${brand.background_color ? `--brand-bg: ${brand.background_color};` : ""}
      ${brand.font_family ? `--brand-font: ${brand.font_family};` : ""}
    }
    .brand-btn, .brand-bg { background-color: var(--brand-primary) !important; color: white !important; }
    .brand-text { color: var(--brand-primary) !important; }
    .brand-accent { background-color: var(--brand-accent) !important; color: white !important; }
    ${brand.custom_css ?? ""}
  `.trim();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {brand.favicon_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <link rel="icon" href={brand.favicon_path} />
      )}
      {children}
    </>
  );
}

// Re-export the row so callers can pass it down to client components.
export type Branding = BrandRow;

export async function getActiveBranding(orgId: string | null): Promise<BrandRow | null> {
  if (!orgId) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_branding")
      .select("logo_path, logo_dark_path, favicon_path, primary_color, accent_color, background_color, font_family, custom_css, email_footer")
      .eq("organization_id", orgId)
      .maybeSingle();
    return (data as unknown as BrandRow) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the active org from the request host by looking up
 * `organization_domains`. Used for unauthenticated pages (login, signup) where
 * we can't pull the org from the user session yet.
 *
 * Returns null for the SRP root domain or any unrecognized host.
 */
export async function getBrandingByHost(): Promise<{ orgId: string; branding: BrandRow | null } | null> {
  try {
    const h = await headers();
    const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
    if (!host) return null;
    // Skip known platform hosts
    if (host.endsWith(".vercel.app") || host === "localhost" || host.endsWith(".local")) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("organization_domains")
      .select("organization_id")
      .eq("host", host)
      .maybeSingle();
    const orgId = (data as { organization_id?: string } | null)?.organization_id;
    if (!orgId) return null;
    const branding = await getActiveBranding(orgId);
    return { orgId, branding };
  } catch {
    return null;
  }
}
