#!/usr/bin/env bash
# Step 17 — Contract PDF export.
#
# Pure client-side via html2pdf.js loaded from CDN (no npm dep added):
#   • src/lib/pdf/html-to-pdf.ts    — lazy CDN loader, returns Blob or triggers save
#   • /contracts/[id]/print          — new "PDF" button in toolbar (alongside Print)
#   • /m/contracts/[id]              — full-width "Download PDF" button for residents
#
# No database changes. Works on desktop Chrome/Safari/Firefox + mobile Safari/Chrome.
# RTL Arabic, brand logo, signature image — all preserved in the output PDF.
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(contracts): step 17 — client-side PDF export for desktop + mobile (no npm dep)" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Try it:"
    echo "  /contracts/<id>/print     — desktop manager: tap PDF button → contract-<n>.pdf"
    echo "  /m/contracts/<id>         — resident on phone: tap Download PDF"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
