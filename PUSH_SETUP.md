# Web Push Notifications Setup

SRP can push notifications to residents' phones/desktops via the Web Push API — even when the app is closed. This complements in-app realtime + email.

## 1. Install the `web-push` package

```bash
npm install web-push @types/web-push
```

The code uses dynamic import, so the project builds without this package — it just silently no-ops until installed.

## 2. Generate VAPID keys (one-time)

```bash
npx web-push generate-vapid-keys
```

You'll get a public + private key pair. Save them.

## 3. Set Vercel env vars

| Variable | Value | Where used |
|---|---|---|
| `VAPID_PUBLIC_KEY` | public key from step 2 | server (push sender) |
| `VAPID_PRIVATE_KEY` | private key | server only — keep secret |
| `VAPID_SUBJECT` | `mailto:admin@yourdomain.com` | required by Push spec |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same as VAPID_PUBLIC_KEY | client-side subscribe |

Redeploy after saving.

## 4. Run the migration

Open Supabase SQL Editor and paste `install-push-subscriptions.sql`. Creates `public.push_subscriptions` with RLS.

## 5. Try it

1. Resident logs in on mobile (iOS Safari 16.4+, any modern Chrome/Edge/Firefox)
2. Opens `/m/notifications` → taps **Enable push notifications**
3. Approves the OS permission prompt
4. Even after closing the browser, when a bill is paid / generated / penalised:
   - The OS notification banner appears
   - Tapping it opens the app at the relevant page

## 6. What's wired so far

Push fires alongside the in-app notification for:
- `notifyPaymentReceived` → "Payment received · $52.50"
- `notifyNewBill` → "New electricity bill · $52.50"
- `notifyPenaltyApplied` → "Late penalty added · $5.50"

You can add more by calling `sendPushToUser(userId, {title, body, url, tag})` anywhere in server code.

## 7. Behaviour when keys are missing

If any of `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, or the `web-push` package itself is missing, `sendPushToUser()` becomes a no-op (logs once, returns). All other flows keep working — in-app bell still updates via Supabase Realtime.

## 8. Cleaning up dead subscriptions

When the push service returns 404 or 410 (subscription expired/removed by browser), the row is automatically deleted from `push_subscriptions`. No manual cleanup needed.

## 9. iOS notes

- Requires iOS 16.4+
- The PWA **must** be installed to home screen first (Add to Home Screen via Share menu)
- Only HTTPS works (Vercel gives you that for free)
- Permission prompt only appears inside the installed PWA — not in regular Safari
