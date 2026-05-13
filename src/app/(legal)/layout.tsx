import Link from "next/link";

/**
 * Lightweight shell for legal pages — accessible without authentication.
 * Just a centered max-width container, a back-to-home link, and a tiny
 * footer linking to the sibling legal pages.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← Back to SRP
          </Link>
        </div>
        <article className="prose prose-slate max-w-none">{children}</article>
        <footer className="mt-16 border-t pt-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/cookies" className="hover:underline">Cookies</Link>
            <Link href="/login" className="hover:underline">Sign in</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
