#!/usr/bin/env bash
set -euo pipefail

db="$(mktemp)"
trap 'rm -f "$db"' EXIT

# Simulate the existing ResolveAI database before the membership migration.
cat migrations/0001_initial.sql migrations/0002_team_invites.sql | sqlite3 "$db"

sqlite3 "$db" <<'SQL'
PRAGMA foreign_keys = ON;
INSERT INTO users (id,email,password_hash,password_salt)
VALUES ('legacy-admin','block-admin@example.invalid','unchanged-hash','unchanged-salt');
INSERT INTO workspaces (id,name,owner_user_id)
VALUES ('legacy-workspace','Existing block workspace','legacy-admin');
INSERT INTO workspace_members (workspace_id,user_id,role)
VALUES ('legacy-workspace','legacy-admin','owner');
INSERT INTO sessions (id,user_id,token_hash,expires_at)
VALUES ('legacy-session','legacy-admin','test-token-hash','2099-01-01T00:00:00.000Z');
SQL

# The upgraded query must fail only because the new table is not installed yet.
set +e
error="$(sqlite3 "$db" "SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN membership_requests mr ON mr.user_id=u.id WHERE s.token_hash='test-token-hash';" 2>&1)"
status=$?
set -e
if [[ "$status" -eq 0 ]] || ! grep -qi "no such table: membership_requests" <<<"$error"; then
  echo "FAIL: expected the legacy schema to lack membership_requests."
  echo "$error"
  exit 1
fi

# The compatibility fallback must still resolve the original block admin session.
actual="$(sqlite3 "$db" "SELECT u.email || '|' || wm.role || '|' || 'approved' FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id WHERE s.token_hash='test-token-hash' AND s.expires_at>'2026-11-04T00:00:00.000Z' ORDER BY wm.created_at LIMIT 1;")"
expected="block-admin@example.invalid|owner|approved"
if [[ "$actual" != "$expected" ]]; then
  echo "FAIL: legacy session fallback mismatch: $actual"
  exit 1
fi

echo "PASS: existing administrator session works on the pre-membership schema without creating tables."
