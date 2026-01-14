#!/bin/bash
# Script to determine if backend build should proceed on Render
# Returns 0 to proceed, 1 to skip

# Use Render commit, or HEAD if local
COMMIT_REF=${RENDER_GIT_COMMIT:-HEAD}

echo "🔍 Checking for changes in apps/backend... (Commit: $COMMIT_REF)"

# git diff --quiet returns 1 if differences exist, 0 if identical
git diff --quiet $COMMIT_REF^ $COMMIT_REF -- apps/backend/

if [ $? -eq 1 ]; then
  echo "✅ Changes detected in apps/backend. Proceeding with build."
  exit 0
else
  echo "🛑 No changes in apps/backend. Skipping build."
  exit 1
fi
