# Sentry Setup — Error & Performance Tracking

دليل ربط Sentry بنظام SRP لمتابعة الأخطاء في الإنتاج بشكل احترافي.

## ما الذي يعطيك Sentry؟

- **Error tracking**: كل exception في الإنتاج يجيك تنبيه فوري + stack trace كامل
- **Performance**: أبطأ الـ API routes والصفحات (مع waterfall لكل query)
- **Session Replay**: تسجيل فيديو 10% من الجلسات لما يصير error (اختياري)
- **Release tracking**: ربط كل bug بـ commit وأي مطور
- **Slack/email alerts**: إشعار عند أخطاء جديدة

التكلفة: **مجاني** حتى 5,000 event/شهر.

---

## الخطوة 1: تسجيل حساب Sentry

1. روح [sentry.io](https://sentry.io/signup/)
2. اختر **"Sign up with GitHub"** (الأسهل)
3. أنشئ Organization جديدة (سمّها `bonyan` مثلاً)
4. أنشئ Project:
   - **Platform:** Next.js
   - **Project name:** `srp` (أو `smart-residential-platform`)
5. بعد الإنشاء، Sentry بيعرض لك **DSN** — انسخه:
   ```
   https://abc123xyz@o123456.ingest.sentry.io/789012
   ```

---

## الخطوة 2: أنشئ Auth Token (لرفع source maps)

1. **User Settings → Auth Tokens** ([رابط مباشر](https://sentry.io/settings/account/api/auth-tokens/))
2. اضغط **Create New Token**
3. الاسم: `srp-vercel-build`
4. Scopes: حدّد **`project:releases`** و **`org:read`**
5. انسخ الـ token (يبدأ بـ `sntrys_...`)

---

## الخطوة 3: أضف env vars في Vercel

روح **Vercel → Project → Settings → Environment Variables** وأضف:

| Variable | Value | Environment |
|----------|-------|-------------|
| `SENTRY_DSN` | الـ DSN من الخطوة 1 | Production, Preview |
| `NEXT_PUBLIC_SENTRY_DSN` | نفس الـ DSN | Production, Preview |
| `SENTRY_AUTH_TOKEN` | الـ token من الخطوة 2 | Production, Preview |
| `SENTRY_ORG` | اسم Organization (مثل `bonyan`) | Production, Preview |
| `SENTRY_PROJECT` | اسم Project (مثل `srp`) | Production, Preview |
| `SENTRY_ENVIRONMENT` | `production` | Production |
| `SENTRY_ENVIRONMENT` | `preview` | Preview |
| `SENTRY_TRACES_RATE` | `0.05` (5% من الـ traces) | Production, Preview |
| `NEXT_PUBLIC_SENTRY_TRACES_RATE` | `0.1` (10% من الـ browser traces) | Production, Preview |

(اختياري) للـ Slack alerts عند critical errors:

| Variable | Value |
|----------|-------|
| `SLACK_OPS_WEBHOOK_URL` | webhook URL من Slack |

---

## الخطوة 4: Deploy

```bash
cd "/Users/marius/Documents/Claude/Projects/SRP — Smart Residential Platform"

# 1. ثبّت الـ package
npm install

# 2. commit + push
git add package.json package-lock.json sentry.*.config.ts src/instrumentation.ts src/lib/observability/report.ts next.config.ts docs/SENTRY_SETUP.md
git commit -m "feat(observability): wire Sentry for error + performance tracking"
git push origin main
```

Vercel بيبني تلقائياً مع upload للـ source maps إلى Sentry.

---

## الخطوة 5: اختبار

### اختبار 1: تأكد إن Sentry يقرأ الأخطاء

افتح Console بالمتصفح على موقع الإنتاج وشغّل:

```js
throw new Error("Sentry test from browser");
```

روح Sentry → **Issues** → خلال دقيقة بيظهر:
```
Error: Sentry test from browser
   browser · production
```

### اختبار 2: server-side error

افتح URL مكسور مثل:
```
https://www.bonyan.app/api/test-sentry-broken
```

(لو ما عندك endpoint، عدّل أي API route ليرمي error مؤقتاً)

في Sentry: بيظهر error مع stack trace كامل (مفهوم لأن source maps مرفوعة).

### اختبار 3: تحقق إن `reportError()` يشتغل

في أي route handler:
```ts
import { reportError } from "@/lib/observability/report";

try {
  throw new Error("Test critical");
} catch (e) {
  reportError(e, { module: "test", severity: "critical" });
}
```

في Sentry:
- يظهر event بـ tag `module: test` و `severity: critical`
- (لو Slack webhook معدّ): رسالة في الـ channel

---

## الخطوة 6: إعدادات Sentry المهمة

في sentry.io على Project:

### Alerts
- **Settings → Alerts → Create Alert Rule**
- "Send a notification when **a new error happens**"
- Action: Email أو Slack

### Issue grouping
- **Settings → Issue Grouping** → استخدم القيم الافتراضية

### Source maps
- **Settings → Source Maps** → تأكد إن `srp` معروض (من الـ uploads)

### Release tracking
- **Settings → Releases** → بيرتبط commit hash تلقائياً مع كل deploy

---

## استكشاف الأخطاء

| المشكلة | السبب | الحل |
|---------|-------|------|
| Build ما يطلع source maps | `SENTRY_AUTH_TOKEN` ناقص | تحقق من Vercel env vars |
| Stack trace ما يتفك (minified) | source maps ما اترفعت | راجع build logs لـ "Sentry source maps uploaded" |
| No events appearing | `SENTRY_DSN` غلط | جرّب نسخ DSN من Sentry → Settings → Client Keys |
| CSP يبلوك Sentry | connect-src ناقص | تأكد إن `next.config.ts` فيه `*.ingest.sentry.io` |

---

## التكاليف المتوقعة

| Plan | Events/شهر | السعر |
|------|------------|-------|
| **Developer (Free)** | 5,000 | $0 |
| **Team** | 50,000 | $26/شهر |
| **Business** | 100,000+ | $80+/شهر |

نصيحة: ابدأ بالـ Developer plan. لما تشوف الـ usage يقرب 5,000 طلب Team.

لتقليل الـ events:
- خفّض `SENTRY_TRACES_RATE` لـ 0.01 (1%)
- زد `ignoreErrors` array في الـ config
- استخدم `severity: warning` بدل `error` لأشياء غير حرجة

---

## ربط Sentry مع GitHub (اختياري)

في Sentry → **Settings → Integrations → GitHub**:
- ربط الـ repo: `mhdjatto-art/Smart-Residential-Platform`
- كل issue ينربط بـ commit أنشأه
- تقدر تفتح PR من Sentry مباشرة لإصلاح bug

---

## ربط Sentry مع Slack (اختياري)

في Sentry → **Settings → Integrations → Slack**:
- اربط workspace
- اختر channel للتنبيهات
- ضع `SLACK_OPS_WEBHOOK_URL` env var = webhook URL للتنبيهات الـ critical
