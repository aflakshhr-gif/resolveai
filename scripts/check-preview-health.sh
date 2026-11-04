#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${RESOLVEAI_URL:-https://hotfix-production-d1-batch-pbkdf2-resolveai.aflakshhr.workers.dev}"
BASE_URL="${BASE_URL%/}"
FILE="$(mktemp)"
trap 'rm -f "$FILE"' EXIT
for attempt in $(seq 1 36); do
  CODE="$(curl --silent --show-error --max-time 15 -o "$FILE" -w '%{http_code}' "$BASE_URL/api/health/db" 2>/dev/null || true)"
  if [[ "$CODE" == "200" ]]; then
    python3 - "$FILE" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as handle:
    data = json.load(handle)
if data.get('service') != 'ResolveAI' or data.get('status') != 'ok' or data.get('database') != 'reachable':
    print('FAIL: preview D1 health response is unexpected:', data)
    sys.exit(1)
print('PASS: Cloudflare preview Worker is online and D1 responds to read-only SELECT 1.')
PY
    exit $?
  fi
  echo "Health check attempt ${attempt}/36 returned HTTP ${CODE:-no response}; retrying..."
  sleep 5
done
echo "FAIL: Cloudflare Worker did not pass read-only D1 health check."
cat "$FILE" || true
exit 1
