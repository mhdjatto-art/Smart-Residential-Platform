#!/usr/bin/env bash
# install-and-build-apk.sh — تثبيت Java + Android SDK + بناء APK في خطوة واحدة.
#
# الاستخدام:
#   bash scripts/install-and-build-apk.sh
#
# لازم Mac password مرة وحدة (لما brew يطلبه).
# بعدها كل شي تلقائي.

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "🏗️  LSRP — APK Build Script"
echo "================================"
echo

# ----------------------------------------------------------------
# 1. تحقق من Homebrew
# ----------------------------------------------------------------
if ! command -v brew &> /dev/null; then
  echo "❌ Homebrew غير مثبّت."
  echo "ثبّته من https://brew.sh ثم أعد المحاولة."
  exit 1
fi
echo "✅ Homebrew موجود"

# ----------------------------------------------------------------
# 2. ثبّت Java JDK 17 (Temurin)
# ----------------------------------------------------------------
if ! /usr/libexec/java_home -v 17 &> /dev/null; then
  echo
  echo "📥 تنزيل وتثبيت Java JDK 17..."
  echo "   (قد يطلب باسورد Mac — اكتبه عند الطلب)"
  brew install --cask temurin
else
  echo "✅ Java JDK 17 موجود"
fi

# ----------------------------------------------------------------
# 3. ضع JAVA_HOME
# ----------------------------------------------------------------
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
echo "✅ JAVA_HOME = $JAVA_HOME"

# اجعله دائماً في ~/.zshrc
if ! grep -q 'export JAVA_HOME=\$(/usr/libexec/java_home' ~/.zshrc 2>/dev/null; then
  echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
  echo "   (تمت إضافته إلى ~/.zshrc)"
fi

# ----------------------------------------------------------------
# 4. ثبّت Android SDK Command-Line Tools
# ----------------------------------------------------------------
if [ ! -d "$HOME/Library/Android/sdk" ] && ! command -v sdkmanager &> /dev/null; then
  echo
  echo "📥 تنزيل وتثبيت Android SDK command-line tools..."
  brew install --cask android-commandlinetools
fi

# اكتشف المسار
if [ -d "/opt/homebrew/share/android-commandlinetools" ]; then
  export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
elif [ -d "/usr/local/share/android-commandlinetools" ]; then
  export ANDROID_HOME="/usr/local/share/android-commandlinetools"
elif [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
else
  echo "❌ ما لقيت مسار Android SDK. ثبّت Android Studio يدوياً وأعد التشغيل."
  exit 1
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
echo "✅ ANDROID_HOME = $ANDROID_HOME"

# اجعله دائماً
if ! grep -q "ANDROID_HOME=" ~/.zshrc 2>/dev/null; then
  echo "export ANDROID_HOME=\"$ANDROID_HOME\"" >> ~/.zshrc
  echo 'export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"' >> ~/.zshrc
fi

# ----------------------------------------------------------------
# 5. اقبل الـ licenses تلقائياً
# ----------------------------------------------------------------
echo
echo "📜 قبول Android SDK licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
echo "✅ Licenses accepted"

# ----------------------------------------------------------------
# 6. ثبّت SDK platforms + build tools
# ----------------------------------------------------------------
echo
echo "📥 تنزيل Android SDK 34 + Build Tools..."
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" 2>&1 | grep -v "^\[=" || true
echo "✅ SDK جاهز"

# ----------------------------------------------------------------
# 7. اكتب local.properties داخل android/
# ----------------------------------------------------------------
echo "sdk.dir=$ANDROID_HOME" > "$ROOT_DIR/android/local.properties"
echo "✅ android/local.properties محدّث"

# ----------------------------------------------------------------
# 8. تأكد أن gradlew قابل للتنفيذ
# ----------------------------------------------------------------
chmod +x "$ROOT_DIR/android/gradlew"

# ----------------------------------------------------------------
# 9. ابنِ الـ APK
# ----------------------------------------------------------------
echo
echo "🔨 بناء الـ APK (قد يأخذ 5-10 دقائق أول مرة)..."
echo
cd "$ROOT_DIR/android"
./gradlew assembleDebug

# ----------------------------------------------------------------
# 10. اعرض النتيجة
# ----------------------------------------------------------------
APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  echo
  echo "═══════════════════════════════════════════════"
  echo "✅ APK جاهزة!"
  echo "═══════════════════════════════════════════════"
  echo
  echo "📦 المسار: $APK_PATH"
  echo "📏 الحجم:  $(du -h "$APK_PATH" | cut -f1)"
  echo
  echo "📂 لفتح المجلد:"
  echo "   open '$ROOT_DIR/android/app/build/outputs/apk/debug/'"
  echo
  echo "📱 لنقلها على موبايلك:"
  echo "   • AirDrop من Finder"
  echo "   • أو ابعتها لنفسك على Telegram/WhatsApp"
  echo "   • أو adb install app-debug.apk (إذا الموبايل موصول USB)"
  echo
  # افتح المجلد تلقائياً
  open "$ROOT_DIR/android/app/build/outputs/apk/debug/"
else
  echo "❌ الـ APK ما تبنت. تحقق من الـ output أعلاه."
  exit 1
fi
