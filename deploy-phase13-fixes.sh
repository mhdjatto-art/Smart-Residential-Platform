#!/usr/bin/env bash
# Phase 13 build fixes: Wallet2 → Wallet, nullsFirst removed, StatCard tone prop removed,
# unused ArrowDownCircle import removed.
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "fix(build): Phase 13 TS errors — Wallet2/nullsFirst/StatCard tone

- src/app/m/page.tsx: Wallet2 → Wallet (Wallet2 not exported from lucide-react)
- src/lib/meter-adapters/worker.ts: drop nullsFirst from order() (not in supabase-js types)
- src/app/(dashboard)/wallets/[id]/page.tsx: StatCard 'tone' prop removed, using className instead
- src/app/m/wallet/page.tsx: drop unused ArrowDownCircle import" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "Wait 2 min then check Vercel Deployments — should build commit on top of main."
    echo "If still no auto-deploy, run from project root:"
    echo "  npx vercel --prod"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
