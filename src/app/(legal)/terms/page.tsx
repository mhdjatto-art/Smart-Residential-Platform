import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: May 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using SRP (Smart Residential Platform) — the property
        management software operated by the operating organization of your
        compound (the &ldquo;Operator&rdquo;) — you agree to be bound by these
        Terms of Service. If you do not agree, do not use the platform.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        SRP is a multi-tenant SaaS that helps residential compound operators
        manage units, residents, contracts, payments, utilities, maintenance,
        visitors, parking, and access control. Resident-facing features
        include a mobile shell at <code>/m</code> for paying bills, opening
        complaints, scheduling visitors, and signing contracts.
      </p>

      <h2>3. Eligibility & Accounts</h2>
      <p>
        You must be at least 18 years old to create an account. You are
        responsible for keeping your credentials confidential and for all
        activity under your account. Notify the Operator immediately if you
        suspect unauthorized access.
      </p>

      <h2>4. Acceptable Use</h2>
      <ul>
        <li>Do not attempt to bypass authentication or row-level security.</li>
        <li>Do not upload malicious files, illegal content, or material that infringes third-party rights.</li>
        <li>Do not use automated tools to scrape, mass-export, or overload the platform.</li>
        <li>Use the visitor and access-control features only for legitimate compound business.</li>
      </ul>

      <h2>5. Payments</h2>
      <p>
        Payments are processed by Stripe and (where applicable) regional
        gateways. The Operator sets prices, late penalties, and refund rules
        for your contracts. Disputes about specific charges should be raised
        with the Operator first.
      </p>

      <h2>6. Electronic Signatures</h2>
      <p>
        By drawing your signature on a contract within SRP and submitting it,
        you agree the signature has the same legal force as a handwritten one
        in your jurisdiction, where electronic signatures are recognized.
        SRP captures the rendered contract HTML, timestamp, and source IP at
        the moment of signing for audit purposes.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        Software, design, and documentation are owned by the platform vendor
        and the Operator. Your data remains yours; you grant the Operator a
        license to process it solely to provide the service.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        SRP is provided &ldquo;as is&rdquo; without warranties of any kind.
        Neither the platform vendor nor the Operator is liable for indirect,
        incidental, or consequential damages. Total aggregate liability is
        capped at the fees paid in the twelve months preceding the claim.
      </p>

      <h2>9. Termination</h2>
      <p>
        The Operator may suspend or terminate accounts that violate these
        Terms. On termination your data is retained for the period required
        by applicable law, then deleted.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which
        the Operator is registered. Disputes are resolved in the competent
        courts of that jurisdiction.
      </p>

      <h2>11. Changes</h2>
      <p>
        Material changes will be communicated by email and on this page at
        least 14 days before they take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms should go to the Operator&apos;s support
        address shown in your Settings or, for platform-level concerns,
        <code>legal@srp.example</code> (replace with your actual address).
      </p>
    </>
  );
}
