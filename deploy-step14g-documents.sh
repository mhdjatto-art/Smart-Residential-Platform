#!/usr/bin/env bash
# Step 14G — Documents browser (storage + metadata already existed):
#   • Added listAllDocuments() with filters + pagination
#   • /documents desktop — full table with search + kind/entity filters + download
#   • /m/documents mobile — resident sees own contracts/IDs/receipts + download
#   • DocumentDownloadButton — fetches signed URL on click and triggers browser download
set -e
cd "$(dirname "$0")"

[ -f .git/index.lock ] && rm -f .git/index.lock

git add -A
git commit -m "feat(documents): step 14G — /documents browser + /m/documents resident view + reusable download button" || echo "  (no changes)"

for i in 1 2 3 4 5; do
  if git push origin main; then
    echo "  ✓ Pushed on attempt $i"
    echo ""
    echo "After build:"
    echo "  /documents       — admin view of all files, filter by kind/entity, search by name"
    echo "  /m/documents     — resident view of their own files"
    echo "  /residents/<id>  — existing inline document section (already worked)"
    exit 0
  fi
  sleep 5
done
echo "✗ Push failed"
exit 1
