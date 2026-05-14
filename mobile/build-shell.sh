#!/usr/bin/env bash
# Builds the static shell that gets bundled inside the native binary.
#
# The shell is a tiny HTML+JS app that:
#   1. Shows a branded splash.
#   2. Decides online/offline.
#   3. Hands off to the live `/m` web app.
#
# Called by scripts/build-org-app.sh after it has stamped the org's
# branding into mobile/src/index.html and boot.js.

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/mobile/src"
DIST_DIR="$ROOT_DIR/mobile/dist"

echo "[shell] building static shell from $SRC_DIR → $DIST_DIR"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy verbatim — no bundler needed. The shell is small enough to ship as-is.
cp -R "$SRC_DIR"/* "$DIST_DIR/"

echo "[shell] done."
