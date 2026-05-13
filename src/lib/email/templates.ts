/**
 * Branded HTML email templates.
 *
 * Plain inline-styled HTML (no template engine, no npm dep). Renders well
 * in Gmail, Outlook, Apple Mail, mobile clients. We keep templates as pure
 * functions returning { subject, html, text } so they're easy to test.
 */

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function shell(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin-top:16px;">SRP · Smart Residential Platform</p>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

// ─── 1. Payment receipt ─────────────────────────────────────────────────────

export interface PaymentReceiptData {
  recipient_name: string;
  organization_name: string;
  bill_number: string;
  utility_type: string;
  amount: number;
  currency: string;
  paid_at: string;
  method: string;
  reference: string;
  receipt_url: string;
}

export function paymentReceiptEmail(d: PaymentReceiptData): { subject: string; html: string; text: string } {
  const subject = `Payment received — ${formatCurrency(d.amount, d.currency)} for ${d.utility_type}`;
  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;">
        ✓ Payment received
      </div>
    </div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Thank you, ${escape(d.recipient_name)}</h1>
    <p style="color:#64748b;font-size:14px;line-height:1.5;margin:0 0 24px;">
      Your payment to <strong>${escape(d.organization_name)}</strong> has been confirmed.
    </p>

    <table role="presentation" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Service</span><br>
        <span style="font-weight:600;text-transform:capitalize;">${escape(d.utility_type)}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Bill number</span><br>
        <span style="font-family:monospace;">${escape(d.bill_number)}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Method</span><br>
        <span style="text-transform:capitalize;">${escape(d.method.replace(/_/g, " "))}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Reference</span><br>
        <span style="font-family:monospace;font-size:12px;">${escape(d.reference)}</span>
      </td></tr>
      <tr><td style="padding:16px;background:#ecfdf5;">
        <span style="color:#065f46;font-size:12px;font-weight:600;">AMOUNT PAID</span><br>
        <span style="font-size:24px;font-weight:700;color:#065f46;">${formatCurrency(d.amount, d.currency)}</span>
      </td></tr>
    </table>

    <div style="text-align:center;">
      <a href="${escape(d.receipt_url)}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        View / download receipt
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Paid at ${escape(new Date(d.paid_at).toLocaleString())}
    </p>
  `;
  const text =
    `Payment received\n\n` +
    `Thank you, ${d.recipient_name}.\n` +
    `Your payment to ${d.organization_name} has been confirmed.\n\n` +
    `Service:    ${d.utility_type}\n` +
    `Bill #:     ${d.bill_number}\n` +
    `Method:     ${d.method}\n` +
    `Reference:  ${d.reference}\n` +
    `Amount:     ${formatCurrency(d.amount, d.currency)}\n` +
    `Paid at:    ${new Date(d.paid_at).toLocaleString()}\n\n` +
    `Receipt: ${d.receipt_url}\n`;
  return { subject, html: shell(subject, body), text };
}

// ─── 2. Bill due reminder ───────────────────────────────────────────────────

export interface BillReminderData {
  recipient_name: string;
  organization_name: string;
  bill_number: string;
  utility_type: string;
  amount: number;
  currency: string;
  due_date: string;
  days_until_due: number;
  pay_url: string;
}

export function billReminderEmail(d: BillReminderData): { subject: string; html: string; text: string } {
  const isUrgent = d.days_until_due <= 1;
  const headline = isUrgent
    ? `Your ${d.utility_type} bill is due ${d.days_until_due === 0 ? "today" : "tomorrow"}`
    : `Reminder: your ${d.utility_type} bill is due in ${d.days_until_due} days`;
  const subject = isUrgent ? `⏰ ${headline}` : headline;

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${escape(headline)}</h1>
    <p style="color:#64748b;font-size:14px;line-height:1.5;margin:0 0 24px;">
      Hi ${escape(d.recipient_name)}, this is a friendly reminder from <strong>${escape(d.organization_name)}</strong>.
    </p>

    <div style="background:${isUrgent ? "#fef2f2" : "#fffbeb"};border-left:4px solid ${isUrgent ? "#ef4444" : "#f59e0b"};padding:16px;border-radius:6px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:${isUrgent ? "#991b1b" : "#92400e"};font-weight:600;text-transform:uppercase;">
        Amount due
      </p>
      <p style="margin:0;font-size:28px;font-weight:700;color:${isUrgent ? "#991b1b" : "#92400e"};">
        ${formatCurrency(d.amount, d.currency)}
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">
        Due ${escape(d.due_date)} · Bill #${escape(d.bill_number)}
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${escape(d.pay_url)}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Pay now
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Pay before the due date to avoid late penalties.
    </p>
  `;
  const text =
    `${headline}\n\n` +
    `Hi ${d.recipient_name},\n\n` +
    `${d.organization_name} reminds you:\n\n` +
    `Bill #:   ${d.bill_number}\n` +
    `Service:  ${d.utility_type}\n` +
    `Amount:   ${formatCurrency(d.amount, d.currency)}\n` +
    `Due:      ${d.due_date}\n\n` +
    `Pay now: ${d.pay_url}\n`;
  return { subject, html: shell(subject, body), text };
}

// ─── 4. Resident invitation ─────────────────────────────────────────────────

export interface InvitationData {
  organization_name: string;
  compound_name: string | null;
  building_name: string | null;
  unit_number: string;
  tenancy_type: string;
  invite_code: string;
  invite_url: string;
  expires_at: string;
  inviter_name?: string;
}

export function invitationEmail(d: InvitationData): { subject: string; html: string; text: string } {
  const subject = `You're invited to join ${d.organization_name} — Unit ${d.unit_number}`;
  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dbeafe;color:#1e40af;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;">
        🏠 Resident invitation
      </div>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Welcome to ${escape(d.organization_name)}</h1>
    <p style="color:#64748b;font-size:14px;line-height:1.5;margin:0 0 24px;">
      ${d.inviter_name ? `${escape(d.inviter_name)} has` : "You've been"} invited to set up your resident account.
    </p>

    <table role="presentation" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      ${d.compound_name ? `
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Compound</span><br>
        <span style="font-weight:600;">${escape(d.compound_name)}</span>
      </td></tr>` : ""}
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Unit</span><br>
        <span style="font-weight:600;">${d.building_name ? `${escape(d.building_name)} · ` : ""}${escape(d.unit_number)}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
        <span style="color:#64748b;font-size:12px;">Role</span><br>
        <span style="text-transform:capitalize;">${escape(d.tenancy_type.replace(/_/g, " "))}</span>
      </td></tr>
      <tr><td style="padding:12px 16px;background:#eff6ff;">
        <span style="color:#1e40af;font-size:12px;font-weight:600;">YOUR INVITE CODE</span><br>
        <span style="font-family:monospace;font-size:20px;font-weight:700;color:#1e40af;letter-spacing:2px;">
          ${escape(d.invite_code)}
        </span>
      </td></tr>
    </table>

    <div style="text-align:center;">
      <a href="${escape(d.invite_url)}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Set up my account
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">
      Or paste your code at ${escape(new URL(d.invite_url).origin)}/signup
      <br>This invitation expires on ${escape(new Date(d.expires_at).toLocaleDateString())}
    </p>
  `;
  const text =
    `You're invited to ${d.organization_name}\n\n` +
    `${d.inviter_name ? `${d.inviter_name} has` : "You've been"} invited to set up your resident account.\n\n` +
    (d.compound_name ? `Compound: ${d.compound_name}\n` : "") +
    `Unit:     ${d.building_name ? `${d.building_name} · ` : ""}${d.unit_number}\n` +
    `Role:     ${d.tenancy_type}\n\n` +
    `Your invite code: ${d.invite_code}\n\n` +
    `Set up your account: ${d.invite_url}\n` +
    `Expires: ${new Date(d.expires_at).toLocaleDateString()}\n`;
  return { subject, html: shell(subject, body), text };
}

// ─── 3. Late penalty applied ────────────────────────────────────────────────

export interface PenaltyNoticeData {
  recipient_name: string;
  organization_name: string;
  bill_number: string;
  utility_type: string;
  original_amount: number;
  penalty_amount: number;
  total_amount: number;
  currency: string;
  due_date: string;
  days_overdue: number;
  pay_url: string;
}

export function penaltyNoticeEmail(d: PenaltyNoticeData): { subject: string; html: string; text: string } {
  const subject = `Late penalty applied — ${d.utility_type} bill ${d.bill_number}`;
  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#fef2f2;color:#991b1b;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;">
        ⚠ Late penalty applied
      </div>
    </div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Your bill is overdue</h1>
    <p style="color:#64748b;font-size:14px;line-height:1.5;margin:0 0 24px;">
      Hi ${escape(d.recipient_name)}, your <strong>${escape(d.utility_type)}</strong> bill was due
      on <strong>${escape(d.due_date)}</strong> — ${d.days_overdue} days ago — and a late penalty has been added.
    </p>

    <table role="presentation" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;">Original</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(d.original_amount, d.currency)}</td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#991b1b;">Penalty</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#991b1b;font-weight:600;">+ ${formatCurrency(d.penalty_amount, d.currency)}</td></tr>
      <tr><td style="padding:14px 16px;background:#fef2f2;color:#991b1b;font-weight:700;">Total due</td>
          <td style="padding:14px 16px;background:#fef2f2;text-align:right;color:#991b1b;font-weight:700;font-size:18px;">${formatCurrency(d.total_amount, d.currency)}</td></tr>
    </table>

    <div style="text-align:center;">
      <a href="${escape(d.pay_url)}" style="display:inline-block;background:#ef4444;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Pay now to stop further penalties
      </a>
    </div>
  `;
  const text =
    `Late penalty applied — ${d.bill_number}\n\n` +
    `Hi ${d.recipient_name},\n\n` +
    `Your ${d.utility_type} bill (${d.bill_number}) is ${d.days_overdue} days overdue.\n\n` +
    `Original:  ${formatCurrency(d.original_amount, d.currency)}\n` +
    `Penalty:   + ${formatCurrency(d.penalty_amount, d.currency)}\n` +
    `Total:     ${formatCurrency(d.total_amount, d.currency)}\n\n` +
    `Pay now: ${d.pay_url}\n`;
  return { subject, html: shell(subject, body), text };
}
