import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: May 2026</p>

      <h2>1. Who We Are</h2>
      <p>
        Your residential compound&apos;s operating organization (the
        &ldquo;Operator&rdquo;) is the data controller for the personal
        information processed within SRP. SRP&apos;s platform vendor acts
        as a data processor on the Operator&apos;s behalf.
      </p>

      <h2>2. Data We Collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email, phone, role, password hash (we never see plaintext passwords).
        </li>
        <li>
          <strong>Residency data:</strong> unit assignment, contract terms, ID documents you upload.
        </li>
        <li>
          <strong>Financial data:</strong> bills, payments, receipts, partial credit-card metadata returned by Stripe (we never store full card numbers).
        </li>
        <li>
          <strong>Operational data:</strong> tickets, visitor passes, parking sessions, IoT device events, electronic signatures.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, user agent, audit logs, push notification subscription identifiers.
        </li>
      </ul>

      <h2>3. Why We Process Your Data</h2>
      <ul>
        <li>To provide the platform features described in our Terms of Service.</li>
        <li>To process payments and issue receipts (contractual necessity).</li>
        <li>To send service emails, bill reminders, and (with opt-in) marketing.</li>
        <li>To detect fraud, abuse, and to comply with legal obligations.</li>
      </ul>

      <h2>4. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>The Operator and authorized staff in your compound.</li>
        <li>Payment processors (Stripe, regional gateways) strictly to complete transactions.</li>
        <li>Sub-processors that host or send communications (Supabase, Resend, Vercel).</li>
        <li>Authorities, where compelled by valid legal process.</li>
      </ul>
      <p>We do not sell personal data.</p>

      <h2>5. International Transfers</h2>
      <p>
        Data may be processed outside your country by our sub-processors.
        Where required by law (e.g. EU GDPR), Standard Contractual Clauses
        or equivalent safeguards are in place.
      </p>

      <h2>6. Retention</h2>
      <p>
        Active account data is retained for the duration of the contract.
        Audit logs and financial records are retained for the period required
        by law (typically 5–10 years). On deletion request, we retain only
        what we must legally keep and remove the rest.
      </p>

      <h2>7. Your Rights</h2>
      <ul>
        <li>Access, correct, or export your data.</li>
        <li>Request deletion (subject to legal retention).</li>
        <li>Object to certain processing or withdraw consent.</li>
        <li>Lodge a complaint with your data-protection authority.</li>
      </ul>
      <p>Send requests to your Operator or to the platform contact below.</p>

      <h2>8. Security</h2>
      <p>
        We use row-level security (RLS) to isolate tenants in our database,
        encrypt data in transit (TLS) and at rest, capture IP and user-agent
        on sensitive actions like contract signing, and maintain immutable
        audit logs for every change.
      </p>

      <h2>9. Children</h2>
      <p>
        SRP is not directed to children under 13. We do not knowingly collect
        their data.
      </p>

      <h2>10. Changes</h2>
      <p>
        Material changes will be announced at least 14 days in advance via
        email and on this page.
      </p>

      <h2>Contact</h2>
      <p>
        Send privacy requests to the Operator (visible in your Settings) or
        <code>privacy@srp.example</code> (replace with your actual address).
      </p>
    </>
  );
}
