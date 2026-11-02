#!/bin/bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand). Exit 0 skips this deploy, exit 1 deploys.
# Skips only when every file changed since the last deploy is in data/ or i18n/: those pushes change
# no page by themselves, and the GitHub "Weekly update" rebuild that follows deploys the new pages.
# Saves one ~400 MB copy of the site in Vercel's Deployment Storage per content push.
# The JSON files that middleware.js and api/ read directly always deploy. When in doubt, deploy.
prev="$VERCEL_GIT_PREVIOUS_SHA"
[ -n "$prev" ] && git cat-file -e "$prev^{commit}" 2>/dev/null || exit 1
changed=$(git diff --name-only "$prev" HEAD) || exit 1
[ -n "$changed" ] || exit 1
while IFS= read -r f; do
  case "$f" in
    data/compare-pairs.json|data/pincodes.json|data/service-centres.json) exit 1 ;;
    data/*|i18n/*) ;;
    *) exit 1 ;;
  esac
done <<< "$changed"
echo "Only data/ or i18n/ changed since the last deploy: skipped, the GitHub rebuild will deploy the pages."
exit 0
