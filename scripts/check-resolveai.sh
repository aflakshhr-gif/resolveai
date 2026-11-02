#!/usr/bin/env bash
# Private ResolveAI deployment smoke test.
# Usage: bash scripts/check-resolveai.sh
# Optional: RESOLVEAI_URL=https://your-worker.workers.dev bash scripts/check-resolveai.sh
set -Eeuo pipefail

BASE_URL="${RESOLVEAI_URL:-https://resolveai.aflakshhr.workers.dev}"
BASE_URL="${BASE_URL%/}"
HEALTH_FILE="$(mktemp)"
AUTH_FILE="$(mktemp)"
PRIVATE_FILE="$(mktemp)"
AI_FILE="$(mktemp)"
ROOT_FILE="$(mktemp)"
trap 'rm -f "$HEALTH_FILE" "$AUTH_FILE" "$PRIVATE_FILE" "$AI_FILE" "$ROOT_FILE"' EXIT

for command in curl python3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: $command is required."
    exit 1
  fi
done

echo "1/4 Checking Worker health: $BASE_URL"
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
if data.get("service") != "ResolveAI" or data.get("status") != "ok" or data.get("mode") != "private-team":
    print("FAIL: unexpected health response.")
    sys.exit(1)
if data.get("database_configured") is not True:
    print("FAIL: dedicated D1 binding is not configured.")
    sys.exit(1)
print("PASS: private-team Worker is online and D1 binding is present.")
PY

echo "2/4 Checking database initialization and owner setup status"
AUTH_CODE="$(curl --silent --show-error --max-time 20 -o "$AUTH_FILE" -w '%{http_code}' "$BASE_URL/api/auth/status" || true)"
if [[ "$AUTH_CODE" != "200" ]]; then
  echo "FAIL: auth status returned HTTP ${AUTH_CODE:-no response}."
  exit 1
fi
python3 - "$AUTH_FILE" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("FAIL: auth status did not return valid JSON.")
    sys.exit(1)
if not isinstance(data.get("setup_required"), bool) or not isinstance(data.get("setup_enabled"), bool):
    print("FAIL: auth status response is incomplete.")
    sys.exit(1)
print("PASS: database schema is reachable; first-owner setup required: " + str(data["setup_required"]).lower())
if data["setup_required"] and not data["setup_enabled"]:
    print("NOTICE: add the RESOLVEAI_SETUP_TOKEN secret before creating the owner account.")
PY

echo "3/4 Verifying private endpoints reject unauthenticated requests"
ME_CODE="$(curl --silent --show-error --max-time 20 -o "$PRIVATE_FILE" -w '%{http_code}' "$BASE_URL/api/auth/me" || true)"
AI_CODE="$(curl --silent --show-error --max-time 20 -o "$AI_FILE" -w '%{http_code}' -X POST "$BASE_URL/api/ai" -H 'content-type: application/json' --data '{"subject":"synthetic test","messages":[{"from":"customer","text":"hello"}]}' || true)"
if [[ "$ME_CODE" != "401" || "$AI_CODE" != "401" ]]; then
  echo "FAIL: expected unauthenticated endpoints to return HTTP 401; got me=$ME_CODE ai=$AI_CODE."
  exit 1
fi
echo "PASS: account and AI endpoints require authentication."

echo "4/4 Verifying the dashboard redirects to private sign-in"
ROOT_CODE="$(curl --silent --show-error --max-time 20 -o "$ROOT_FILE" -w '%{http_code}' "$BASE_URL/" || true)"
if [[ "$ROOT_CODE" != "302" ]]; then
  echo "FAIL: unauthenticated dashboard returned HTTP ${ROOT_CODE:-no response}, expected 302."
  exit 1
fi
echo "PASS: dashboard redirects unauthenticated visitors to /login/."
echo "ResolveAI private deployment smoke test: SUCCESS"
