# Phase 16 — Native iOS + Android Apps per Compound

## 🏗️ المعمارية

تطبيق native لكل مجمع، كلها مبنية من **codebase واحد** عبر Capacitor:

```
                         ┌─────────────────────────────┐
                         │   SRP Single Codebase      │
                         │   (Next.js + Supabase)     │
                         └────────────┬────────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
        ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
        │  Web App     │      │ Compound A   │      │ Compound B   │
        │  (Super      │      │ Native App   │      │ Native App   │
        │   Admin +    │      │  (iOS + And) │      │  (iOS + And) │
        │   Managers)  │      │              │      │              │
        └──────────────┘      └──────────────┘      └──────────────┘
```

كل تطبيق native:
- **Bundle ID خاص** (e.g., `app.bonyan.compound-a`)
- **App Icon + Splash** من branding المجمع
- **يفتح subdomain خاص** (e.g., `compound-a.bonyan.app/m`)
- **يستخدم native plugins**: Push (APNS/FCM)، Biometric (Face ID/Touch ID)، QR Scanner، Camera، Haptics، Share

---

## 📦 ما تم بناؤه

| الملف | الوظيفة |
|------|---------|
| `capacitor.config.ts` | إعداد Capacitor مع placeholders للـ branding |
| `mobile/src/index.html` | الـ shell الـ static (splash + offline UI) |
| `mobile/src/boot.js` | يحدد online/offline ويحوّل للتطبيق الحي |
| `mobile/build-shell.sh` | يبني الـ shell الـ static |
| `scripts/build-org-app.sh` | **white-label pipeline** الرئيسي |
| `src/lib/native/capacitor-bridge.ts` | helper APIs (scanQrCode, biometricLogin, takePhoto, share, haptic) |
| `src/app/api/push/register/route.ts` | endpoint لتسجيل APNS/FCM tokens |
| `package.json` | scripts: `mobile:add:ios`, `mobile:sync`, `mobile:build:org` |

---

## 🚀 إعداد أوّلي (مرة واحدة)

### المتطلبات

- **Mac** مع Xcode 15+ (لـ iOS)
- **Android Studio** Hedgehog أو أحدث (لـ Android)
- **Node 18+**
- حساب **Apple Developer** ($99/سنة)
- حساب **Google Play Console** ($25 مرة واحدة)

### الخطوات

```bash
cd "/Users/marius/Documents/Claude/Projects/SRP — Smart Residential Platform"

# 1. تثبيت Capacitor + Plugins
npm install

# 2. إعداد أول مجمع تجريبي (Bonyan demo)
ORG_SLUG=bonyan \
ORG_NAME="Bonyan Residents" \
ORG_BUNDLE_ID="app.bonyan.bonyan" \
ORG_SERVER_URL="https://www.bonyan.app/m" \
ORG_THEME_COLOR="#0F172A" \
./scripts/build-org-app.sh

# 3. افتح iOS في Xcode
npm run mobile:open:ios

# 4. أو افتح Android في Android Studio
npm run mobile:open:android
```

في أول مرة، السكربت سيضيف `ios/` و `android/` تلقائياً.

---

## 🎨 بناء تطبيق لمجمع جديد

عند إضافة مجمع جديد (مثلاً "Al-Rawabi"):

```bash
ORG_SLUG=rawabi \
ORG_NAME="Al-Rawabi Residents" \
ORG_BUNDLE_ID="app.bonyan.rawabi" \
ORG_SERVER_URL="https://rawabi.bonyan.app/m" \
ORG_THEME_COLOR="#10B981" \
ORG_LOGO_PNG="./assets/orgs/rawabi/logo.png" \
./scripts/build-org-app.sh
```

السكربت يعمل تلقائياً:
1. ✅ يحدّث `capacitor.config.ts` بـ bundle ID + URL
2. ✅ ينسخ logo المجمع لـ icons + splash (لكل المقاسات)
3. ✅ يحدّث `mobile/src/boot.js` بـ subdomain الصحيح
4. ✅ يبني الـ shell الـ static
5. ✅ ينفذ `npx cap sync` لنسخ كل شي لـ `ios/` و `android/`

ثم افتح Xcode أو Android Studio وابدأ archive.

---

## 📲 الـ Native Plugins المتاحة

من أي صفحة React في `/m/*`، استخدم:

```tsx
import {
  isNative,
  scanQrCode,
  biometricLogin,
  takePhoto,
  shareNative,
  haptic,
  isOnline,
  setCached,
  getCached,
} from "@/lib/native/capacitor-bridge";

// كل helper آمن للاستخدام في الويب أيضاً (fallback أو no-op)
if (isNative()) {
  const qr = await scanQrCode();
  if (qr) toast.success(`Scanned: ${qr}`);
}

// Biometric login
const result = await biometricLogin("سجّل دخول إلى محفظتك");
if (result.ok) router.push("/m/wallet");
```

---

## 🍎 نشر على App Store (iOS)

### الإعداد لمرة واحدة

1. أنشئ حساب [Apple Developer](https://developer.apple.com/) ($99/سنة).
2. في **Certificates, Identifiers & Profiles**:
   - أنشئ App ID لكل bundle ID (e.g., `app.bonyan.bonyan`)
   - مكّن capabilities: Push Notifications، Sign in with Apple، App Groups
3. في **App Store Connect**:
   - أنشئ تطبيق جديد لكل مجمع
   - املأ Privacy Policy (موجودة: `https://www.bonyan.app/privacy`)
   - أضف Screenshots (6.7" + 5.5" iPhone + 12.9" iPad)

### لكل بناء جديد

1. `./scripts/build-org-app.sh` بـ org variables
2. `npm run mobile:open:ios`
3. في Xcode:
   - **Signing & Capabilities** → اختر Team
   - **Product → Archive**
   - **Distribute App → App Store Connect → Upload**
4. في App Store Connect:
   - **TestFlight** → أضف testers داخليين
   - بعد الاختبار: **Submit for Review**
   - مراجعة Apple تأخذ 24-72 ساعة

### Push Notifications على iOS (إعداد إضافي)

1. في Apple Developer → Keys → أنشئ **APNS Key (.p8)**
2. ارفع الـ key لـ Supabase (إذا تستخدم Supabase Edge Functions للـ push)
3. أو ارفعه لـ Firebase Cloud Messaging واستخدم FCM لـ iOS أيضاً

---

## 🤖 نشر على Google Play (Android)

### الإعداد لمرة واحدة

1. أنشئ حساب [Play Console](https://play.google.com/console/) ($25 مرة).
2. أنشئ تطبيق جديد لكل مجمع.
3. املأ Store Listing:
   - الوصف بالعربية + الإنجليزية
   - Screenshots (Phone + 7" tablet + 10" tablet)
   - Privacy Policy URL
   - Content rating questionnaire

### لكل بناء جديد

1. `./scripts/build-org-app.sh` بـ org variables
2. `npm run mobile:open:android`
3. في Android Studio:
   - **Build → Generate Signed Bundle / APK → Android App Bundle**
   - استخدم keystore (أنشئ واحد لكل تطبيق، احفظهم في 1Password)
4. في Play Console:
   - **Production → Releases → Create new release**
   - ارفع الـ `.aab`
   - اضغط Review release
   - مراجعة Google تأخذ 4-48 ساعة

---

## 🔔 ربط Push Notifications

### Backend (موجود بالفعل)

- `push_subscriptions` table — تخزّن APNS + FCM + Web Push tokens
- `/api/push/register` — endpoint للتسجيل من التطبيق
- `src/lib/notifications/push.ts` — `sendPush()` يفان out على كل devices للمستخدم

### Frontend (التلقائي)

عند أول تشغيل للتطبيق، `mobile/src/boot.js`:
1. يطلب صلاحية الإشعارات
2. يحصل على APNS/FCM token
3. يرسله لـ `/api/push/register`
4. يخزّن في `push_subscriptions`

من أي مكان في الكود، إرسال إشعار لمستخدم:

```ts
import { sendPush } from "@/lib/notifications/push";

await sendPush({
  userId: resident.user_id,
  title: "تمت إعادة الخدمة",
  body: "تم تعبئة 25,000 IQD. تم تشغيل الكهرباء.",
  data: { url: "/m/wallet" },
});
```

النظام يرسل لكل devices (iOS + Android + Web) تلقائياً.

---

## 📊 تكلفة + جدول زمني

| المرحلة | المدة | الكلفة |
|---------|-------|--------|
| إعداد أول مجمع (Capacitor + Plugins + Test) | 2-3 أيام | 0$ |
| Submit أول تطبيق iOS (مع review) | 3-5 أيام | $99/سنة |
| Submit أول تطبيق Android (مع review) | 2-3 أيام | $25 مرة |
| كل مجمع إضافي بعد ذلك | 1-2 يوم | 0$ |

**ملاحظة:** الـ Apple/Google fees مشتركة بين كل تطبيقاتك. مهما كان عدد المجمعات، الكلفة ثابتة.

---

## 🔐 الأمان

- **Bundle IDs منفصلة** لكل تطبيق → no data leakage بين المجمعات
- **HTTPS فقط** (App Transport Security)
- **CSP headers** موجودة (Phase 11)
- **Biometric** للـ login السريع — لا يخزّن credentials محلياً
- **JWT tokens** من Supabase ينتهي صلاحيتها بشكل صحيح
- **Native push tokens** مرتبطة بـ user_id (RLS)

---

## 🐛 استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| `cap sync` fails | احذف `node_modules` و `ios/` و `android/`، ثم `npm install` و سكربت البناء |
| iOS build error: signing | في Xcode → Signing & Capabilities → اختر Team صحيح |
| Android: keystore lost | لا يمكن استعادته — لازم تطبيق جديد بـ bundle ID مختلف |
| Push notifications لا تصل | تحقق من `push_subscriptions` فيه token المستخدم |
| WebView يفتح صفحة فاضية | `server.url` في `capacitor.config.ts` غلط أو الـ subdomain لا يقبل |
| Apple يرفض ("just a wrapper") | أضف ميزات native أكثر (نحن نضيف QR + Biometric + Camera) |

---

## 🚦 الخطوات التالية

1. **شغّل المنطقة المحلية**: `npm install` ثم `./scripts/build-org-app.sh` بـ Bonyan defaults
2. **افتح في Xcode**: `npm run mobile:open:ios` — لازم يفتح المشروع
3. **اشحن للسيمولاتور**: Cmd+R — يفتح التطبيق على iOS Simulator
4. **اختبر**: should redirect to `https://www.bonyan.app/m` after splash
5. **عند الجاهزية**: سجّل Apple Developer + Google Play Console
6. **Submit**: ابدأ بـ TestFlight + Internal Track قبل الإنتاج

---

## 📚 مراجع

- [Capacitor Docs](https://capacitorjs.com/docs)
- [@capacitor-mlkit/barcode-scanning](https://github.com/capawesome-team/capacitor-mlkit/tree/main/packages/barcode-scanning)
- [@aparajita/capacitor-biometric-auth](https://github.com/aparajita/capacitor-biometric-auth)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Console](https://play.google.com/console/)
