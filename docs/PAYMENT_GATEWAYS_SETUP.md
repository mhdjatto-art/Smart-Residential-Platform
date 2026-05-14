# Payment Gateways Setup — Phase 14

دليل ربط بوابات الدفع المدعومة بنظام SRP.

## المعمارية

كل بوابة دفع تنفّذ نفس واجهة `PaymentGateway` في `src/lib/payments/`. الـ flow موحّد:

```
UI (topup-form.tsx)
    ↓
POST /api/wallet/topup/{method}        ← يبني externalRef + ينادي adapter
    ↓
Gateway adapter.createCheckout()       ← يرجع checkoutUrl
    ↓
window.location.href = checkoutUrl
    ↓
[المستخدم يدفع على بوابة الدفع]
    ↓
POST /api/webhooks/{provider}          ← gateway يستدعي webhook
    ↓
verify signature + parse event
    ↓
topup_wallet() RPC (idempotent)        ← يضيف الرصيد للمحفظة
```

كل البوابات تستخدم نفس مفتاح idempotency (`external_reference`)، يعني الـ retries آمنة.

---

## البوابات المدعومة

| Code      | Gateway       | Region | Status            |
|-----------|---------------|--------|-------------------|
| `stripe`  | Stripe        | Global | ✅ Production     |
| `nass`    | NASS Pay      | Iraq   | 🔧 Needs creds    |
| `qicard`  | Qi Card       | Iraq   | 🔧 Needs creds    |
| `fastpay` | FastPay       | Iraq   | 🔧 Needs creds    |
| `zaincash`| ZainCash      | Iraq   | 🔧 Needs creds    |
| `asiapay` | AsiaHawala    | Iraq   | 🔧 Needs creds    |

---

## متغيرات البيئة المطلوبة

أضفها في **Vercel → Settings → Environment Variables** (Production + Preview).

### Common (مشترك)

```
NEXT_PUBLIC_APP_URL=https://www.bonyan.app
```

### Stripe (موجودة بالفعل)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### NASS Pay

```
NASS_API_BASE=https://api.nass.iq               # أو sandbox.api.nass.iq
NASS_MERCHANT_ID=...
NASS_API_KEY=...
NASS_WEBHOOK_SECRET=...
```

اطلب من حساب NASS Merchant عبر `https://nass.iq/resources/developers`.

### Qi Card

```
QICARD_API_BASE=https://api.qi.iq
QICARD_MERCHANT_ID=...
QICARD_API_KEY=...
QICARD_WEBHOOK_SECRET=...
```

### FastPay

```
FASTPAY_API_BASE=https://api.fast-pay.iq
FASTPAY_MERCHANT_ID=...
FASTPAY_API_KEY=...
FASTPAY_WEBHOOK_SECRET=...
```

### ZainCash

```
ZAINCASH_API_BASE=https://api.zaincash.iq       # أو test.zaincash.iq
ZAINCASH_MSISDN=964...
ZAINCASH_MERCHANT_ID=...
ZAINCASH_SECRET=...                             # JWT signing secret
```

### AsiaHawala

```
ASIAPAY_API_BASE=https://api.asiahawala.com
ASIAPAY_MERCHANT_ID=...
ASIAPAY_API_KEY=...
ASIAPAY_WEBHOOK_SECRET=...
```

---

## إعدادات Webhooks على لوحة كل بوابة

سجّل عنوان الـ webhook التالي في dashboard كل بوابة:

| Gateway   | Webhook URL                                    |
|-----------|------------------------------------------------|
| NASS      | `https://www.bonyan.app/api/webhooks/nass`     |
| Qi Card   | `https://www.bonyan.app/api/webhooks/qicard`   |
| FastPay   | `https://www.bonyan.app/api/webhooks/fastpay`  |
| ZainCash  | `https://www.bonyan.app/api/webhooks/zaincash` |
| AsiaPay   | `https://www.bonyan.app/api/webhooks/asiapay`  |
| Stripe    | `https://www.bonyan.app/api/webhooks/stripe`   |

(URL يجب يطابق `NEXT_PUBLIC_APP_URL` بالضبط — لو نطاق مختلف، عدّله.)

---

## وضع التطوير (بدون credentials)

إذا بوابة مو معدّة، الـ UI تكتشف ذلك تلقائياً:

- `GET /api/wallet/topup/nass` → **503** "not configured"
- في الواجهة: يظهر toast "بوابة NASS غير مفعّلة" + يسجّل دفعة مباشرة بالـ RPC

هذا يخلي اختبار الواجهة ممكناً قبل ما تجيب credentials.

---

## اختبار سريع بعد الربط

```bash
# 1. اختبر إن البوابة شغّالة
curl -X POST https://www.bonyan.app/api/wallet/topup/nass \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"walletId":"<wallet-uuid>","amount":25000}'

# يجب يرجع: { "checkoutUrl": "https://...", "gatewayRef": "...", "externalRef": "wallet:..." }

# 2. اختبر الـ webhook (لو البوابة عندها sandbox)
# - شغّل دفعة وهمية من dashboard البوابة
# - تحقق من السجلات في Vercel → Logs → /api/webhooks/{provider}
# - تأكد إن topup_wallet RPC نفذ ورصيد المحفظة زاد
```

---

## استكشاف الأخطاء

| الأعراض | السبب المحتمل | الحل |
|---------|---------------|------|
| 503 على `/api/wallet/topup/{method}` | env vars ناقصة | تحقق من Vercel env vars |
| 401 على webhook | توقيع غلط | راجع `*_WEBHOOK_SECRET` |
| المحفظة ما تتعطّش | externalRef مفقود | تحقق من logs `[webhook/{provider}]` |
| Duplicate top-ups | RPC مو idempotent | تأكد إن `p_external_ref` يُمرّر |

---

## إضافة بوابة جديدة لاحقاً

1. أنشئ `src/lib/payments/newgateway.ts` (نسخ من `nass.ts` كقالب).
2. أضف `"newgateway"` لـ `PaymentMethodCode` في `types.ts`.
3. سجّلها في `registry.ts`.
4. أضف اسم زر للواجهة في `topup-form.tsx`.
5. سجّل صف في `payment_method_registry` لكل organization.
6. أضف env vars في Vercel.

كل بوابة جديدة عبارة عن **ملف واحد** + إعدادات.
