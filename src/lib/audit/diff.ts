/**
 * Pure utility — extracted from audit.ts so it can live outside a
 * "use server" module (Next.js rejects non-async exports there).
 */

type Diff = { old?: Record<string, unknown>; new?: Record<string, unknown> } | null | undefined;

/**
 * Returns the keys that changed on an UPDATE row, ignoring volatile metadata
 * columns like updated_at / created_at.
 */
export function diffKeys(diff: Diff): string[] {
  if (!diff?.old || !diff?.new) return [];
  const out: string[] = [];
  const all = new Set([...Object.keys(diff.old), ...Object.keys(diff.new)]);
  for (const k of all) {
    if (k === "updated_at" || k === "created_at") continue;
    const a = diff.old[k];
    const b = diff.new[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(k);
  }
  return out;
}
