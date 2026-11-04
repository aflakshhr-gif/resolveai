#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp --suffix=.js)"
trap 'rm -f "$TMP"' EXIT
cp "$ROOT/apps-script/Code.gs" "$TMP"
node --check "$TMP"
grep -q 'RESOLVEAI_SHARED_SECRET' "$ROOT/apps-script/Code.gs"
grep -q 'RESOLVEAI_ALLOWED_ORIGINS' "$ROOT/apps-script/Code.gs"
grep -q 'MailApp.sendEmail' "$ROOT/apps-script/Code.gs"
grep -q 'constantTimeEquals' "$ROOT/apps-script/Code.gs"
grep -q 'isAllowedResetUrl' "$ROOT/apps-script/Code.gs"
echo "Google Apps Script mailer syntax and safety checks passed."
