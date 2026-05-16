/**
 * Safe error message extraction — never assumes shape.
 * Use this everywhere `catch (e)` instead of `e instanceof Error ? e.message : ...`.
 */
export function getErrorMessage(error: unknown): string {
  if (error == null) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.name || "Unknown error";

  // Supabase PostgrestError shape: { message, details, hint, code }
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.length > 0) return obj.message;
    if (typeof obj.error === "string" && obj.error.length > 0) return obj.error;
    if (typeof obj.error_description === "string") return obj.error_description as string;
    // JSON.stringify last resort — guarded against circular refs.
    try { return JSON.stringify(obj); } catch { return "Unknown error object"; }
  }
  return String(error);
}

/** Like getErrorMessage but adds optional context prefix. */
export function describeError(context: string, error: unknown): string {
  return `${context}: ${getErrorMessage(error)}`;
}
