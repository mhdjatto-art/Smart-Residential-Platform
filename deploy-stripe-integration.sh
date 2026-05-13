#!/usr/bin/env bash
# Real Stripe Checkout integration:
#   • src/lib/payments/stripe.ts            — Stripe REST client (no npm dep)
#   • src/lib/api/checkout.ts                — startBillCheckout server action
#   • src/app/api/webhooks/stripe/route.ts   — HMAC-verified webhook handler
#   • src/app/m/payments/success/page.tsx    — return URL after Stripe
#   • PayBillButton — Card/Online now redirects to Stripe Checkout
#   • STRIPE_SETUP.md — env vars + webhook setup
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Stripe Integration — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(payments): real Stripe Checkout + signed webhook — graceful fallback when keys missing" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Activate Stripe by setting these env vars in Vercel:"
    echo "  STRIPE_SECRET_KEY      sk_test_... (from Stripe Dashboard → API keys)"
    echo "  STRIPE_WEBHOOK_SECRET  whsec_...   (from Stripe → Webhooks → endpoint)"
    echo "  NEXT_PUBLIC_APP_URL    https://<your-domain>"
    echo ""
    echo "Webhook URL to add in Stripe Dashboard:"
    echo "  https://<your-domain>/api/webhooks/stripe"
    echo "  Events: checkout.session.completed, payment_intent.succeeded"
    echo ""
    echo "See STRIPE_SETUP.md for the full guide."
    echo ""
    echo "Until env vars are set: the mobile Pay button falls back to direct write"
    echo "(test mode) so you can keep developing locally."
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
