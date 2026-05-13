# Stripe Setup for SRP

The platform integrates with Stripe Checkout for resident self-pay. Two integration points:

- **Checkout creation** — `src/lib/payments/stripe.ts` → `createCheckoutSession()`
- **Webhook receiver** — `POST /api/webhooks/stripe`

No npm package is required. The integration uses Stripe's REST API directly via `fetch`.

## 1. Get your Stripe keys

1. Sign up at https://dashboard.stripe.com (test mode is free)
2. Go to **Developers → API keys**, copy:
   - **Secret key**: `sk_test_...` (or `sk_live_...` for production)

## 2. Set up the webhook

1. In Stripe Dashboard: **Developers → Webhooks → Add endpoint**
2. **Endpoint URL**: `https://<your-vercel-domain>/api/webhooks/stripe`
3. **Events to send**:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. After creating, click the webhook and reveal **Signing secret**: `whsec_...`

## 3. Add env vars to Vercel

In your Vercel project → **Settings → Environment Variables**:

| Variable | Value | Example |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret key from step 1 | `sk_test_51N...` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from step 2 | `whsec_1abc...` |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | `https://smart-residential-platform.vercel.app` |

After saving, **redeploy** so the new env vars take effect.

## 4. Test it

1. Log in as `tenant1@bonyan.demo` on production
2. Open `/m/payments` → tap **Pay** on a bill
3. Select **Card / Online** → tap **Pay X.XX**
4. You'll be redirected to Stripe Checkout
5. Use test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
6. After payment, you'll land on `/m/payments/success?bill=<id>`
7. Stripe fires the webhook → bill flips to `paid` in your DB

## How fall-back works

If `STRIPE_SECRET_KEY` is missing, the **Card / Online** button silently falls back to direct DB write (the same flow as the **Wallet** button). This keeps test environments working without Stripe credentials.

## Security notes

- Webhook signature is verified using HMAC-SHA256 + 5-minute tolerance (see `verifyWebhookSignature()`)
- Idempotency: replaying the same Stripe event won't double-charge — the SQL function checks `paid_amount + total_amount` and the webhook checks `metadata.last_payment.reference`
- Service-role client is used in the webhook (no user session) — RLS is bypassed only inside the webhook
- All other server actions still require an authenticated user with ownership verified

## Local development

Use Stripe CLI to forward webhooks to localhost:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

It will print a webhook secret starting with `whsec_` — use it as `STRIPE_WEBHOOK_SECRET` in your `.env.local`.
