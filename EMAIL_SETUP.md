# Email Notification Setup

SRP sends transactional emails for:

1. **Payment receipts** — immediately after a payment succeeds (online or wallet, via webhook or direct path)
2. **Bill reminders** — daily cron, fires for bills due in 3, 1, and 0 days
3. **Late penalty notices** — when `apply_utility_bill_penalties_all` adds a penalty

No npm package required — uses Resend's REST API via `fetch`.

## 1. Get a Resend account

1. Sign up at https://resend.com (free tier: 3,000 emails/month, no credit card)
2. **Domains → Add Domain** → enter your domain and add the DNS records they show
3. Wait for verification (a few minutes)
4. **API Keys → Create API Key** → copy `re_...`

## 2. Add env vars to Vercel

| Variable | Value | Example |
|---|---|---|
| `RESEND_API_KEY` | API key from step 1 | `re_AbcD1234...` |
| `EMAIL_FROM` | Verified sender | `"Bonyan <no-reply@bonyan.app>"` |
| `NEXT_PUBLIC_APP_URL` | Already set for Stripe | `https://srp.vercel.app` |
| `CRON_SECRET` | Already set for billing cron | `(any random string)` |

After saving, **redeploy** the project.

## 3. Schedule the reminder cron

Add this entry to `vercel.json` next to the billing cron:

```json
{
  "crons": [
    { "path": "/api/cron/billing-run",     "schedule": "0 1 * * *" },
    { "path": "/api/cron/send-reminders",  "schedule": "0 9 * * *" }
  ]
}
```

Reminders fire daily at 09:00 UTC — bills due in **3 days, 1 day, or today** get an email.

## 4. Test it

### Payment receipt
1. Sign in as `tenant1@bonyan.demo`
2. Pay any utility bill (online or wallet)
3. Check the resident's email — a branded receipt should arrive within seconds

### Reminder
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://srp.vercel.app/api/cron/send-reminders
```
Returns `{ ok: true, found: N, sent: N, errors: 0 }`.

### Manual via Vercel function
Visit `/api/cron/send-reminders` without auth (only works locally without `CRON_SECRET` set).

## Behaviour when keys are missing

If `RESEND_API_KEY` is not set, `sendEmail()` becomes a no-op that just logs to console. The whole payment flow still works — emails just don't go out. This keeps dev environments simple.

## Email templates

All three templates live in `src/lib/email/templates.ts` as pure functions:
- `paymentReceiptEmail(d)`
- `billReminderEmail(d)`
- `penaltyNoticeEmail(d)`

They return `{ subject, html, text }` so you can preview, test, or swap to a different provider easily.

## Security

- Service-role client is used in notify.ts (no user session needed in webhooks/cron)
- Resend auto-tags emails with `kind` + `bill_id` for filtering in their dashboard
- All sends are fire-and-forget — they never block the payment recording

## Logs

Every send writes a line to Vercel function logs:
- `[email] sent: <id> → <to> subject: <subject>` on success
- `[email] Resend error: <msg> → <to>` on failure
- `[email] skipped (not configured): ...` when keys are missing
