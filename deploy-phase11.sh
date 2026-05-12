#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 11 — ERP Integration Bridge (Odoo / SAP / CSV / Custom)
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 11 — ERP Bridge — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/3: Apply Phase 11 migrations"
supabase db push
echo ""

echo "▸ Step 2/3: Regenerate TypeScript types"
supabase gen types typescript --linked --schema public > src/types/database.ts.new
if ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid"; rm -f src/types/database.ts.new; exit 1
fi
mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

echo "▸ Step 3/3: Commit and push"
git add -A
git commit -m "feat(phase11): ERP bridge — Odoo/SAP/CSV adapters, journal_entries, account_mappings" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Phase 11 pushed on attempt $i — Vercel will rebuild in ~30s"
    echo ""
    echo "After build:"
    echo "  /erp           — list integrations + 'Connect Odoo/SAP/CSV'"
    echo "  /erp/mappings  — map SRP events (revenue, cash, ...) → GL accounts"
    echo "  /erp/entries   — every journal entry SRP has generated"
    echo ""
    echo "SQL helpers:"
    echo "  select public.generate_journal_entry_for_payment(payment_id)"
    echo "  select public.generate_journal_entry_for_utility_bill(bill_id)"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
