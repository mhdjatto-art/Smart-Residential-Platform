#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRP Phase 7 — Mobile App, PWA & Real-Time Experience — deploy
# ─────────────────────────────────────────────────────────────────────────────
# No SQL migrations in this phase — Phase 7 is pure frontend (PWA shell,
# realtime subscriptions, mobile resident screens). We still re-run
# `supabase db push` so the chain stays repeatable, but it's a no-op.
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP Phase 7 — Mobile + Realtime — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▸ Step 1/3: Apply any pending migrations (idempotent)"
supabase db push || echo "  (nothing to apply)"
echo ""

echo "▸ Step 2/3: Regenerate TypeScript types (in case earlier phases drifted)"
supabase gen types typescript --linked --schema public > src/types/database.ts.new
if ! grep -q "Database" src/types/database.ts.new; then
  echo "  ✗ Generated types look invalid"
  rm -f src/types/database.ts.new
  exit 1
fi
mv src/types/database.ts.new src/types/database.ts
echo "  ✓ Types regenerated ($(wc -l < src/types/database.ts) lines)"
echo ""

echo "▸ Step 3/3: Commit and push"
git add -A
git commit -m "feat(phase7): mobile, PWA & realtime — manifest, sw, /m shell, live widgets, resident screens" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✓ Phase 7 pushed on attempt $i"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Vercel will rebuild in ~30s. Then:"
    echo "  Open https://smart-residential-platform.vercel.app/m on a phone,"
    echo "  log in, and you should be able to 'Add to Home Screen'."
    echo ""
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' -L https://smart-residential-platform.vercel.app/m"
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' https://smart-residential-platform.vercel.app/manifest.json"
    echo "  curl -sS -o /dev/null -w 'Status: %{http_code}\\n' https://smart-residential-platform.vercel.app/sw.js"
    exit 0
  fi
  echo "  ✗ Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "✗ All push attempts failed. Run 'git push origin main' manually."
exit 1
