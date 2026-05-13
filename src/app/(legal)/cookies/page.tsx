import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie Notice</h1>
      <p className="text-muted-foreground">Last updated: May 2026</p>

      <p>
        SRP uses a small number of cookies and similar browser storage
        mechanisms. We do not use third-party advertising or tracking
        cookies. The only cookies set on your device are the ones below.
      </p>

      <h2>Strictly necessary</h2>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>sb-*-auth-token</code></td>
            <td>Supabase authentication session. Without it you cannot stay signed in.</td>
            <td>Up to 1 year, refreshed on activity.</td>
          </tr>
          <tr>
            <td><code>srp-locale</code></td>
            <td>Remembers your language preference (en / ar / ku).</td>
            <td>1 year.</td>
          </tr>
          <tr>
            <td><code>srp-cookie-consent</code></td>
            <td>Stores your acknowledgment of this notice so we don&apos;t show it again.</td>
            <td>6 months.</td>
          </tr>
        </tbody>
      </table>

      <h2>Functional (browser storage, not cookies)</h2>
      <ul>
        <li>
          <strong>Service Worker</strong> &mdash; caches static assets so the
          PWA can render the offline page when you lose connectivity.
        </li>
        <li>
          <strong>Push Notification subscription</strong> &mdash; only set if
          you accept the &ldquo;Enable notifications&rdquo; prompt. Removed
          when you revoke it from your browser.
        </li>
        <li>
          <strong>localStorage</strong> &mdash; remembers small preferences
          (filter selections, RTL flag).
        </li>
      </ul>

      <h2>No third-party tracking</h2>
      <p>
        We do not use Google Analytics, Meta Pixel, or any cross-site
        tracking technology. The only third-party calls your browser makes
        from SRP are to:
      </p>
      <ul>
        <li>Supabase (database and storage)</li>
        <li>Stripe (only while you&apos;re paying a bill)</li>
        <li>QR code generator (api.qrserver.com — only when you open a visitor pass or unit barcode)</li>
        <li>html2pdf CDN (only when you tap &ldquo;Download PDF&rdquo;)</li>
      </ul>

      <h2>Managing cookies</h2>
      <p>
        You can clear cookies from your browser settings, but signing in
        will not work without the Supabase auth cookies. If you disable them
        you will be signed out.
      </p>
    </>
  );
}
