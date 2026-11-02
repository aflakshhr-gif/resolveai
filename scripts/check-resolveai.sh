#!/usr/bin/env bash
# ResolveAI deployment smoke test for both the free offline demo and live AI.
# Usage: bash scripts/check-resolveai.sh
# Optional: RESOLVEAI_URL=https://your-worker.workers.dev bash scripts/check-resolveai.sh
set -Eeuo pipefail

BASE_URL="${RESOLVEAI_URL:-https://resolveai.aflakshhr.workers.dev}"
BASE_URL="${BASE_URL%/}"
HEALTH_FILE="$(mktemp)"
AI_FILE="$(mktemp)"
trap 'rm -f "$HEALTH_FILE" "$AI_FILE"' EXIT

for command in curl python3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: $command is required."
    exit 1
  fi
done

echo "1/2 Checking Worker health: $BASE_URL"
HEALTH_CODE="$(curl --silent --show-error --max-time 20 -o "$HEALTH_FILE" -w '%{http_code}' "$BASE_URL/api/health" || true)"
if [[ "$HEALTH_CODE" != "200" ]]; then
  echo "FAIL: health endpoint returned HTTP ${HEALTH_CODE:-no response}."
  exit 1
fi

python3 - "$HEALTH_FILE" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("FAIL: health endpoint did not return valid JSON.")
    sys.exit(1)
if data.get("service") != "ResolveAI" or data.get("status") != "ok":
    print("FAIL: unexpected health response.")
    sys.exit(1)
configured = data.get("ai_configured") is True
mode = data.get("mode")
if configured:
    print("PASS: Worker is online; live AI is configured.")
elif mode == "offline-demo":
    print("PASS: Worker is online in free offline-demo mode.")
else:
    print("FAIL: AI is not configured and the Worker is not marked as offline-demo.")
    sys.exit(1)
PY

echo "2/2 Testing /api/ai with a harmless synthetic conversation"
AI_CODE="$(curl --silent --show-error --max-time 30 -o "$AI_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/ai" \
  -H 'content-type: application/json' \
  --data '{"subject":"Automated ResolveAI smoke test","messages":[{"from":"customer","text":"Hello, I need help with my order status."}]}' || true)"
if [[ "$AI_CODE" != "200" ]]; then
  echo "FAIL: AI endpoint returned HTTP ${AI_CODE:-no response}."
  python3 - "$AI_FILE" <<'PY'
import json, sys
try:
    print("Reason: " + json.load(open(sys.argv[1])).get("error", "No error detail returned."))
except Exception:
    print("No readable error detail returned.")
PY
  exit 1
fi

python3 - "$AI_FILE" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("FAIL: AI endpoint did not return valid JSON.")
    sys.exit(1)
required = ("sentiment", "urgency", "intent", "suggested_reply", "next_step")
missing = [key for key in required if not isinstance(data.get(key), str) or not data[key].strip()]
if missing:
    print("FAIL: response is missing: " + ", ".join(missing))
    sys.exit(1)
if data.get("mode") == "offline-demo":
    if not str(data.get("disclaimer", "")).strip():
        print("FAIL: offline demo response is missing its disclaimer.")
        sys.exit(1)
    print("PASS: offline rule-based analysis returned all expected fields and disclaimer.")
else:
    print("PASS: analysis endpoint returned all expected fields.")
print("ResolveAI smoke test: SUCCESS")
PY
