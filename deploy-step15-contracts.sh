#!/usr/bin/env bash
# Step 15 — Contract templates + unit barcodes:
#   • install-contract-templates.sql        — contract_templates table + 6 seeded templates (sale/rental/purchase × EN/AR)
#   • src/lib/api/contract-templates.ts     — list, get, render contract with {{placeholder}} substitution
#   • /contracts/[id]/print                 — printable + editable + template switcher
#   • /units/[id]/barcode                   — QR sticker (printable)
#   • "Print contract" button on contract detail
#   • "Barcode" button on unit detail
#
# IMPORTANT: Before users can print, run install-contract-templates.sql once in the Supabase SQL editor.
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(contracts): step 15 — sale/rental/purchase templates with print+edit, per-unit QR barcode" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Post-deploy checklist:"
    echo "  1. Run install-contract-templates.sql in Supabase SQL editor (one time)"
    echo "  2. Visit /contracts/<id>/print to preview, edit, and print"
    echo "  3. Visit /units/<id>/barcode to print a QR sticker for any unit"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
