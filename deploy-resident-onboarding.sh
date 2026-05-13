#!/usr/bin/env bash
# Resident onboarding via invite links:
#   • resident_invites table with RLS
#   • createResidentInvite / peekInvite / redeemInvite server actions
#   • Admin UI: /admin/invites with unit picker + InviteGenerator card
#   • Public /signup page with code verifier + auto-login after redeem
#   • "Have an invite code?" link on /login
#   • Middleware allows /signup unauthenticated
set -e
cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SRP — Resident Onboarding — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  (removed stale lock)"

git add -A
git commit -m "feat(onboarding): resident invite-link signup flow — admin generator + public /signup + auto-redeem" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo ""
    echo "  ✓ Pushed on attempt $i — Vercel rebuilds in ~30s"
    echo ""
    echo "Next steps:"
    echo "  1. Run install-resident-invites.sql in Supabase SQL Editor"
    echo "  2. Log in as super_admin → /admin/invites"
    echo "  3. Pick a unit → set tenancy + email (optional) → Generate invite"
    echo "  4. Copy the invite link → send to the resident"
    echo "  5. Resident opens the link → enters their info → account created"
    echo ""
    echo "Link format:  https://<domain>/signup?code=ABC12XYZ"
    exit 0
  fi
  sleep 5
done

echo "✗ Push failed. Run 'git push origin main' manually."
exit 1
