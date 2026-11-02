#!/usr/bin/env bash
# ResolveAI deployment + live AI smoke test.
# Usage: bash scripts/check-resolveai.sh
# Optional: RESOLVEAI_URL=https://your-worker.workers.dev bash scripts/check-resolveai.sh
set -Eeuo pipefail

BASE_URL="${RESOLVEAI_URL:-https://resolveai.aflakshhr.workers.dev}"
BASE_URL="${BASE_URL%/}"
HEALTH_FILE="$(mktemp)"
AI_FILE="$(mktemp)"
trap 'rm -f "$HEALTH_FILE" "$AI_FILE"' EXIT

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required."
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required."
  exit 1
fi

echo "1/2 Checking Worker: $BASE_URL"
HEALTH_CODE="$(curl --silent --show-error --max-time 20 -o "$HEALTH_FILE" -w '%{http_code}' "$BASE_URL/api/health" || true)"
if [[ "$HEALTH_CODE" != "200" ]]; then
  echo "FAIL: health endpoint returned HTTP ${HEALTH_CODE:-no response}."
  echo "The latest Worker deployment may not be live yet."
  exit 1
fi

AI_CONFIGURED="$(python3 - "$HEALTH_FILE" <<'PY'
import json, sys
try:
    print("yes" if json.load(open(sys.argv[1])).get("ai_configured") is True else "no")
except Exception:
    print("invalid")
PY
)"
if [[ "$AI_CONFIGURED" == "invalid" ]]; then
  echo "FAIL: health endpoint did not return valid JSON."
  exit 1
fi
if [[ "$AI_CONFIGURED" != "yes" ]]; then
  echo "BLOCKED: Worker is online, but OPENAI_API_KEY is not configured."
  echo "Add it in Cloudflare > Workers & Pages > resolveai > Settings > Variables and Secrets."
  echo "Create it as an encrypted Secret named exactly OPENAI_API_KEY, then deploy again."
  exit 2
fi
echo "PASS: Worker is online and the AI secret is present (its value was not read or displayed)."

echo "2/2 Sending a harmless synthetic conversation to /api/ai"
AI_CODE="$(curl --silent --show-error --max-time 60 -o "$AI_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/ai" \
  -H 'content-type: application/json' \
  --data '{"subject":"Automated ResolveAI smoke test","messages":[{"from":"customer","text":"Hello, I need help with my order status."}]} ' || true)"
if [[ "$AI_CODE" != "200" ]]; then
  SAFE_ERROR="$(python3 - "$AI_FILE" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get("error", "No error detail returned."))
except Exception:
    print("No readable error detail returned.")
PY
)"
  echo "FAIL: AI endpoint returned HTTP ${AI_CODE:-no response}."
  echo "Reason: $SAFE_ERROR"
  echo "Check OpenAI project billing/usage and the Cloudflare secret. This test does not add credit or make a payment."
  exit 1
fi

python3 - "$AI_FILE" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
required = ("sentiment", "urgency", "intent", "suggested_reply", "next_step")
missing = [key for key in required if not isinstance(data.get(key), str) or not data[key].strip()]
if missing:
    print("FAIL: AI returned an incomplete result: " + ", ".join(missing))
    sys.exit(1)
print("PASS: AI returned all five expected fields.")
print("ResolveAI live smoke test: SUCCESS")
PY
