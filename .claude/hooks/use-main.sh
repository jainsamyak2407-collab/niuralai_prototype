#!/usr/bin/env bash
# Every session works on main (NIURAL.md > Git). Cloud sessions start on a
# claude/* branch; switch to main when the tree is clean.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ "$(git branch --show-current)" = main ] && exit 0
if [ -n "$(git status --porcelain)" ]; then
  echo "Not on main and the tree has changes. Switch to main before working." ; exit 0
fi
git fetch -q origin main && git checkout -q -B main origin/main && git branch --set-upstream-to=origin/main main >/dev/null
echo "Switched to main (NIURAL.md > Git)."
