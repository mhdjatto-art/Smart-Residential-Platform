# دليل بناء تطبيق Android (LSRP — Levant Smart Residential Platform)

> **Status:** Phase 24 — جاهز للبناء. كل البنية التحتية موجودة. هذا الدليل
> يأخذك من «جهاز فاضي» إلى «APK مرفوع على Google Play».

---

## 1. ما المتطلبات قبل البدء؟

| الأداة | الإصدار | لماذا |
| --- | --- | --- |
| Node.js | 18+ | لتشغيل Next.js و Capacitor CLI |
| Java JDK | 17 | Android Gradle Plugin 8.x |
| Android Studio | Hedgehog أو أحدث | لفتح المشروع وتوقيع الـ AAB |
| حساب Google Play Developer | $25 (لمرة واحدة) | لرفع التطبيق |
| (اختياري) Firebase Project | مجاني | لـ Push Notifications |

> macOS مستخدم: ثبّت Android Studio من https://developer.android.com/studio
> ثم افتحه مرة واحدة لتنزيل Android SDK (Build Tools + Platform).

---

## 2. البنية التحتية الموجودة

```
SRP/
├── capacitor.config.ts          ← يقرأ ORG_SLUG, ORG_NAME, ORG_BUNDLE_ID, ORG_SERVER_URL من البيئة
├── mobile/
│   ├── src/
│   │   ├── index.html           ← شاشة Splash + شاشة "بدون انترنت"
│   │   └── boot.js              ← يسجّل FCM token ثم ينقل المستخدم إلى الموقع الحي
│   ├── dist/                    ← يُبنى تلقائياً من src/ (لا تعدّل هنا)
│   ├── resources/
│   │   ├── icon.png             ← 1024×1024 لوغو المؤسسة (يولّد كل الأحجام)
│   │   └── splash.png           ← 2732×2732 شاشة الترحيب
│   └── build-shell.sh           ← يحوّل src/ → dist/
├── android/                     ← مشروع Android Studio كامل
│   └── app/src/main/AndroidManifest.xml  ← الصلاحيات + Deep Linking
├── scripts/
│   └── build-org-app.sh         ← السكربت الرئيسي (يعمل كل شيء)
└── src/
    ├── lib/native/capacitor-bridge.ts   ← مساعدات runtime: scanQrCode, biometric, haptic
    └── app/api/push/register/route.ts   ← API يستقبل FCM tokens
```

---

## 3. البناء لمؤسسة واحدة (LSRP الافتراضي)

```bash
# 1) ثبّت الـ deps
npm install

# 2) ابنِ التطبيق الويب (مرة واحدة قبل أي شيء)
npm run build

# 3) ابنِ الـ Native shell + Sync إلى Android
ORG_SLUG=levant \
ORG_NAME="LSRP" \
ORG_BUNDLE_ID="com.levant.srp" \
ORG_SERVER_URL="https://www.lsrp.app/m" \
ORG_THEME_COLOR="#0B1F3A" \
ORG_LOGO_PNG="./mobile/resources/icon.png" \
SKIP_IOS=1 \
  npm run mobile:build:org

# 4) افتح Android Studio
npm run mobile:open:android
```

داخل Android Studio:

1. انتظر حتى ينتهي Gradle sync (أول مرة قد يأخذ 5 دقائق).
2. اختر `app` من dropdown الـ Run configuration.
3. اضغط ▶️ لتشغيله على Emulator أو جهاز USB.

---

## 4. البناء لمؤسسة جديدة (white-label)

كل مؤسسة جديدة (مثل "Al-Rasheed Compound") تحصل على APK خاص بها:

```bash
# المتطلب: في DB يكون org.slug = "alrasheed" مع organization_branding مكتمل.
ORG_SLUG="alrasheed" \
ORG_NAME="Al-Rasheed Residents" \
ORG_BUNDLE_ID="com.levant.alrasheed" \
ORG_SERVER_URL="https://alrasheed.lsrp.app/m" \
ORG_THEME_COLOR="#2D5F3F" \
ORG_LOGO_PNG="./assets/orgs/alrasheed/logo.png" \
  npm run mobile:build:org
```

> السكربت **idempotent** — أعد تشغيله متى تغيرت branding للمؤسسة.

---

## 5. توقيع الـ AAB ورفعه على Play Store

### 5.1 توليد keystore (مرة واحدة في حياة التطبيق — احتفظ به!)

```bash
# داخل android/app/
keytool -genkey -v \
  -keystore lsrp-release.keystore \
  -alias lsrp \
  -keyalg RSA -keysize 2048 -validity 10000
```

⚠️ **مهم جداً:** احفظ هذا الـ keystore في مكان آمن. إذا فقدته لن تستطيع
رفع تحديثات للتطبيق إلى الأبد. يفضّل وضعه في 1Password أو مدير أسرار.

### 5.2 إعداد التوقيع في Gradle

عدّل `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('lsrp-release.keystore')
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias 'lsrp'
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 5.3 بناء AAB موقّع

```bash
export KEYSTORE_PASSWORD="..."
export KEY_PASSWORD="..."

cd android
./gradlew bundleRelease
# الناتج: android/app/build/outputs/bundle/release/app-release.aab
```

أو من Android Studio:
**Build → Generate Signed Bundle / APK → Android App Bundle → Release**

### 5.4 الرفع على Play Console

1. سجّل دخول على https://play.google.com/console
2. **Create app** → اختر اللغة (Arabic) + النوع (App / Free).
3. **App content** → املأ Privacy Policy URL + Target Audience + Data Safety.
4. **Production → Create new release** → ارفع الـ `.aab`.
5. اكتب release notes (مثلاً: "إصدار البداية v1.0").
6. **Send for review** — مراجعة Google تأخذ 1-7 أيام.

---

## 6. Push Notifications (FCM)

### 6.1 إنشاء Firebase project

1. https://console.firebase.google.com → Add project → سمّيه "lsrp-prod".
2. أضف Android app: package name = `com.levant.srp` (نفس applicationId).
3. حمّل `google-services.json` وضعه في `android/app/`.
4. في **Project Settings → Cloud Messaging** انسخ `Server Key`.

### 6.2 إعداد المشروع لاستقبال الـ token

ملف `android/app/build.gradle` يحتوي بالفعل على:

```gradle
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(...) { ... }
```

أي أن وجود `google-services.json` يفعّل FCM تلقائياً. لا تحتاج تعديل كود.

### 6.3 إرسال push من السيرفر

أضف Server Key في `.env`:

```
FCM_SERVER_KEY=AAAA...
```

ثم استخدمه في `src/lib/push/send-push.ts` (موجود من Phase 7).

---

## 7. اختبار قبل الرفع

| الاختبار | الأمر / الخطوة |
| --- | --- |
| Lint Android | `cd android && ./gradlew lint` |
| Debug build | `cd android && ./gradlew assembleDebug` |
| تشغيل على emulator | `npm run mobile:open:android` ثم ▶️ |
| تشغيل على جهاز فعلي | فعّل USB Debugging على الجهاز ثم وصّله |
| Push notification | استخدم Firebase Console → Cloud Messaging → Send test message مع FCM token |
| Deep link | `adb shell am start -W -a android.intent.action.VIEW -d "https://www.lsrp.app/m"` |
| Permissions | داخل التطبيق ادخل Settings → Apps → LSRP → Permissions |

---

## 8. الـ Permissions المطلوبة

محفوظة في `android/app/src/main/AndroidManifest.xml`:

| Permission | السبب |
| --- | --- |
| INTERNET | الاتصال بالموقع |
| ACCESS_NETWORK_STATE | فحص online/offline في boot.js |
| POST_NOTIFICATIONS | Android 13+ يحتاج runtime permission للإشعارات |
| CAMERA | QR للزوار + رفع صور الإيصالات |
| USE_BIOMETRIC / USE_FINGERPRINT | تسجيل دخول بالبصمة |
| VIBRATE | Haptics عند الضغط على الأزرار |
| READ_MEDIA_IMAGES | رفع صور (Android 13+) |
| READ_EXTERNAL_STORAGE | رفع صور (Android 12 وما قبله — maxSdk=32) |

---

## 9. الـ Versioning

كل إصدار جديد يحتاج:

```gradle
// android/app/build.gradle
defaultConfig {
    versionCode 2        // ← ارفعه عدد صحيح متزايد
    versionName "1.1.0"  // ← Semver — للمستخدم
}
```

Google Play يرفض رفع AAB بنفس `versionCode` كإصدار سابق.

---

## 10. troubleshooting شائع

| المشكلة | الحل |
| --- | --- |
| `Could not find tools.jar` | ثبّت JDK 17، ضع `JAVA_HOME` في bashrc |
| `SDK location not found` | افتح Android Studio → Settings → SDK Manager → نزّل SDK 34 |
| `Manifest merger failed` | أعد `npx cap sync android` |
| Push notifications لا تصل | تحقق من `google-services.json` موجود في `android/app/` |
| White screen عند الإطلاق | اقرأ `adb logcat | grep Capacitor` — غالباً URL خاطئ في boot.js |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | احذف التطبيق من Emulator أولاً |

---

## 11. الـ checklist النهائي قبل النشر

- [ ] `versionCode` متزايد عن آخر إصدار في Play Console
- [ ] `versionName` يحاكي semver
- [ ] `keystore` محفوظ في 1Password
- [ ] `google-services.json` لا يُكشف في git (موجود في `.gitignore`)
- [ ] جميع الـ permissions موثّقة في Play Console → App content → Permissions
- [ ] Privacy Policy URL يفتح ويعرض سياسة الخصوصية
- [ ] Screenshots: 1080×1920 على الأقل، 4 إلى 8 صور
- [ ] App icon: 512×512 PNG (يطلبها Play Console منفصلة عن الـ AAB)
- [ ] Feature graphic: 1024×500 PNG (الصورة الكبيرة في Play Store)
- [ ] اختبرته على جهازين مختلفين (Android 11 + Android 14 على الأقل)

---

## 12. للمتقدمين: CI/CD على GitHub Actions

ضع هذا في `.github/workflows/android-release.yml`:

```yaml
name: Android Release
on:
  push:
    tags: ["v*"]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/setup-java@v4
        with: { java-version: 17, distribution: temurin }
      - run: npm ci
      - run: npm run build
      - run: ./scripts/build-org-app.sh
        env:
          ORG_SLUG: levant
          ORG_NAME: "LSRP"
          ORG_BUNDLE_ID: "com.levant.srp"
          ORG_SERVER_URL: "https://www.lsrp.app/m"
          SKIP_IOS: 1
      - run: cd android && ./gradlew bundleRelease
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_PASSWORD:      ${{ secrets.KEY_PASSWORD }}
      - uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_SERVICE_ACCOUNT }}
          packageName: com.levant.srp
          releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
          track: production
```

---

أي مشكلة في خطوة محددة، افتح ticket في `#mobile-app` channel.
