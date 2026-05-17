#!/usr/bin/env bash
# build-org-app.sh — white-label native build pipeline.
#
# Usage:
#   ORG_SLUG=levant \
#   ORG_NAME="LSRP" \
#   ORG_BUNDLE_ID="com.levant.srp" \
#   ORG_SERVER_URL="https://smart-residential-platform.vercel.app/m" \
#   ORG_THEME_COLOR="#0B1F3A" \
#   ORG_LOGO_PNG="./mobile/resources/icon.png" \
#   ./scripts/build-org-app.sh
#
# What it does:
#   1. Validates required env vars.
#   2. Stamps org-specific values into mobile/src/index.html and boot.js.
#   3. Builds the static shell (mobile/dist).
#   4. Regenerates iOS + Android resources (icons, splash) from the logo.
#   5. Runs `npx cap sync` to copy everything into ios/ and android/.
#   6. Prints the next-step commands (open in Xcode / Android Studio).
#
# The script is idempotent — re-run it any time the org's branding
# changes and it'll rebuild from scratch.

set -e

# ----------------------------------------------------------------
# 1. Validate inputs
# ----------------------------------------------------------------
REQUIRED=(ORG_SLUG ORG_NAME ORG_BUNDLE_ID ORG_SERVER_URL)
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "❌ missing required env var: $var"
    echo
    echo "Usage:"
    echo "  ORG_SLUG=levant \\"
    echo "  ORG_NAME=\"LSRP\" \\"
    echo "  ORG_BUNDLE_ID=\"com.levant.srp\" \\"
    echo "  ORG_SERVER_URL=\"https://smart-residential-platform.vercel.app/m\" \\"
    echo "  ./scripts/build-org-app.sh"
    exit 1
  fi
done

ORG_THEME_COLOR="${ORG_THEME_COLOR:-#0F172A}"
ORG_LOGO_PNG="${ORG_LOGO_PNG:-}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "🏗️  building app for organization: $ORG_NAME ($ORG_SLUG)"
echo "    bundleId:   $ORG_BUNDLE_ID"
echo "    server:     $ORG_SERVER_URL"
echo "    theme:      $ORG_THEME_COLOR"
echo

# ----------------------------------------------------------------
# 2. Stamp branding into the shell
# ----------------------------------------------------------------
# Replace the placeholder ORG_SERVER_URL in boot.js so the shell knows
# where to redirect.
SHELL_BOOT="$ROOT_DIR/mobile/src/boot.js"
TMP_BOOT="$(mktemp)"
# We use a literal sed replace of the const default — keeps boot.js safe to
# commit unchanged (the default is the same as a "fresh checkout" value).
sed "s|https://smart-residential-platform.vercel.app/m|$ORG_SERVER_URL|g" "$SHELL_BOOT" > "$TMP_BOOT"
mv "$TMP_BOOT" "$SHELL_BOOT"

# Inject ORG_SERVER_URL as a global on the window object too (for any
# scripts that read it without re-bundling).
# IMPORTANT: idempotent — first drop any existing injection, then add fresh.
SHELL_HTML="$ROOT_DIR/mobile/src/index.html"
TMP_HTML="$(mktemp)"
# Drop any previous __ORG_SERVER_URL__ injection lines
grep -v '__ORG_SERVER_URL__' "$SHELL_HTML" > "$TMP_HTML"
mv "$TMP_HTML" "$SHELL_HTML"
# Add fresh injection right after <body>
TMP_HTML="$(mktemp)"
awk -v url="$ORG_SERVER_URL" '
  /<body>/ {
    print
    print "    <script>window.__ORG_SERVER_URL__ = \"" url "\";</script>"
    next
  }
  { print }
' "$SHELL_HTML" > "$TMP_HTML"
mv "$TMP_HTML" "$SHELL_HTML"

# Set theme color in the meta tag.
sed -i.bak "s|content=\"#0F172A\"|content=\"$ORG_THEME_COLOR\"|g" "$SHELL_HTML"
rm -f "$SHELL_HTML.bak"

# ----------------------------------------------------------------
# 3. Build the static shell
# ----------------------------------------------------------------
bash "$ROOT_DIR/mobile/build-shell.sh"

# ----------------------------------------------------------------
# 4. Add iOS + Android platforms if missing
# ----------------------------------------------------------------
SKIP_IOS="${SKIP_IOS:-0}"
SKIP_ANDROID="${SKIP_ANDROID:-0}"

if [ "$SKIP_IOS" != "1" ] && [ ! -d "$ROOT_DIR/ios" ]; then
  echo "📱 adding iOS platform (first run)…"
  npx cap add ios || echo "⚠️  iOS add failed — skipping (set SKIP_IOS=1 to silence). Need Xcode + CocoaPods."
fi
if [ "$SKIP_ANDROID" != "1" ] && [ ! -d "$ROOT_DIR/android" ]; then
  echo "🤖 adding Android platform (first run)…"
  npx cap add android || echo "⚠️  Android add failed — skipping (set SKIP_ANDROID=1 to silence). Need Android Studio."
fi

# ----------------------------------------------------------------
# 5. Generate icons + splash from the org's logo (if provided)
# ----------------------------------------------------------------
if [ -n "$ORG_LOGO_PNG" ] && [ -f "$ORG_LOGO_PNG" ]; then
  echo "🎨 generating icons + splash from $ORG_LOGO_PNG"
  mkdir -p "$ROOT_DIR/mobile/resources"
  # Absolute paths so we can compare with the destination to avoid
  # "same file" cp errors when the logo lives at the destination already.
  SRC_LOGO_ABS="$(cd "$(dirname "$ORG_LOGO_PNG")" && pwd)/$(basename "$ORG_LOGO_PNG")"
  DEST_ICON="$ROOT_DIR/mobile/resources/icon.png"
  DEST_SPLASH="$ROOT_DIR/mobile/resources/splash.png"
  if [ "$SRC_LOGO_ABS" != "$DEST_ICON" ]; then
    cp "$ORG_LOGO_PNG" "$DEST_ICON"
  else
    echo "    (icon.png already at destination — skipping copy)"
  fi
  if [ "$SRC_LOGO_ABS" != "$DEST_SPLASH" ]; then
    cp "$ORG_LOGO_PNG" "$DEST_SPLASH"
  else
    echo "    (splash.png already at destination — skipping copy)"
  fi
  # @capacitor/assets is the official tool. Installed via npx so we don't
  # bloat package.json for orgs that don't need to regenerate locally.
  # The `|| true` ensures a failure here doesn't kill the script — the
  # build can still proceed with default icons.
  npx -y @capacitor/assets generate \
    --iconBackgroundColor "$ORG_THEME_COLOR" \
    --splashBackgroundColor "$ORG_THEME_COLOR" \
    --assetPath mobile/resources \
    || echo "⚠️  @capacitor/assets failed — icons may use defaults"
else
  echo "ℹ️  no ORG_LOGO_PNG provided — icons will use the default."
fi

# ----------------------------------------------------------------
# 6. Sync everything to the native projects
# ----------------------------------------------------------------
ORG_SLUG="$ORG_SLUG" \
ORG_NAME="$ORG_NAME" \
ORG_BUNDLE_ID="$ORG_BUNDLE_ID" \
ORG_SERVER_URL="$ORG_SERVER_URL" \
ORG_THEME_COLOR="$ORG_THEME_COLOR" \
NODE_ENV=production \
  npx cap sync

# ----------------------------------------------------------------
# 7. Next steps
# ----------------------------------------------------------------
cat <<EOF

✅ Build prepared for $ORG_NAME

  iOS:     npx cap open ios       # opens Xcode
  Android: npx cap open android   # opens Android Studio

Inside Xcode:
  • Set Team in Signing & Capabilities
  • Product → Archive → Distribute App → App Store Connect

Inside Android Studio:
  • Build → Generate Signed Bundle / APK → Android App Bundle
  • Upload the .aab to Play Console

See docs/MOBILE_APPS_SETUP.md for full submission steps.
EOF
