#!/usr/bin/env bash
# fix-gradle-download.sh — ينزّل Gradle 8.2.1 يدوياً بـ curl (مع retry)
# ويضعه في مكان cache الصحيح، ثم يعيد بناء الـ APK.
#
# الاستخدام:
#   bash scripts/fix-gradle-download.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 1. اقرأ الـ URL من gradle-wrapper.properties
WRAPPER_PROPS="$ROOT_DIR/android/gradle/wrapper/gradle-wrapper.properties"
GRADLE_URL=$(grep '^distributionUrl=' "$WRAPPER_PROPS" | cut -d= -f2- | sed 's/\\:/:/g')
GRADLE_VERSION=$(echo "$GRADLE_URL" | sed -E 's|.*/gradle-([0-9.]+)-all.zip.*|\1|')

echo "🔍 Gradle URL:     $GRADLE_URL"
echo "🔍 Gradle version: $GRADLE_VERSION"
echo

# 2. احسب الـ hash اللي يتوقعه Gradle wrapper (يستعمل MD5 على الـ URL)
HASH=$(echo -n "$GRADLE_URL" | md5 -q 2>/dev/null || echo -n "$GRADLE_URL" | md5sum | cut -d' ' -f1)
# Gradle wrapper يستعمل base36 encoding للـ hash. لكن أبسط: نزّل في كل المجلدات المحتملة.

CACHE_DIR="$HOME/.gradle/wrapper/dists/gradle-${GRADLE_VERSION}-all"
mkdir -p "$CACHE_DIR"

# 3. ابحث عن مجلد فرعي موجود مسبقاً (قد يكون عمل partial download)
EXISTING_SUBDIR=$(find "$CACHE_DIR" -maxdepth 1 -type d ! -path "$CACHE_DIR" 2>/dev/null | head -1)
if [ -n "$EXISTING_SUBDIR" ]; then
  TARGET_DIR="$EXISTING_SUBDIR"
  echo "📁 وجدت مجلد cache موجود: $TARGET_DIR"
else
  # أنشئ مجلد جديد — gradle رح يستعمل أي مجلد فيه gradle-X.X.X-all.zip
  TARGET_DIR="$CACHE_DIR/manual"
  mkdir -p "$TARGET_DIR"
  echo "📁 أنشأت مجلد cache جديد: $TARGET_DIR"
fi

ZIP_PATH="$TARGET_DIR/gradle-${GRADLE_VERSION}-all.zip"
PART_PATH="$ZIP_PATH.part"

# 4. نزّل بـ curl مع retry + resume + timeout كبير
echo "📥 تنزيل Gradle ${GRADLE_VERSION} بـ curl..."
echo "   (يدعم استئناف التنزيل لو انقطع — لا تخف)"
echo

curl --location \
     --retry 10 \
     --retry-delay 5 \
     --retry-max-time 600 \
     --connect-timeout 30 \
     --continue-at - \
     --output "$PART_PATH" \
     --progress-bar \
     "$GRADLE_URL"

# 5. أعد التسمية لما يكتمل
mv "$PART_PATH" "$ZIP_PATH"
echo
echo "✅ التنزيل اكتمل: $(du -h "$ZIP_PATH" | cut -f1)"

# 6. أنشئ ملف ok ليقول لـ gradle "اكتملت العملية"
touch "$ZIP_PATH.ok"

# 7. شغّل gradle assembleDebug مرة ثانية
echo
echo "🔨 إعادة بناء الـ APK..."
echo
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$ROOT_DIR/android"
./gradlew assembleDebug

# 8. اعرض الـ APK
APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  echo
  echo "═══════════════════════════════════════════════"
  echo "✅ APK جاهزة!"
  echo "═══════════════════════════════════════════════"
  echo
  echo "📦 المسار: $APK_PATH"
  echo "📏 الحجم:  $(du -h "$APK_PATH" | cut -f1)"
  open "$ROOT_DIR/android/app/build/outputs/apk/debug/"
else
  echo "❌ الـ APK ما تبنت. شاهد الـ output أعلاه."
  exit 1
fi
