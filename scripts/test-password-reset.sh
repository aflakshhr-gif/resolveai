#!/usr/bin/env bash
set -euo pipefail

db="$(mktemp)"
trap 'rm -f "$db"' EXIT

{
  echo "PRAGMA foreign_keys = ON;"
  cat migrations/0001_initial.sql migrations/0002_team_invites.sql migrations/0003_unit_membership_workspaces.sql migrations/0004_block_admin_workspaces.sql migrations/0005_password_reset.sql
} | sqlite3 "$db"

sqlite3 "$db" <<'SQL'
INSERT INTO users (id,email,password_hash,password_salt)
VALUES ('reset-user','reset-user@example.invalid','old-hash','old-salt');
INSERT INTO workspaces (id,name,owner_user_id)
VALUES ('reset-workspace','Reset test workspace','reset-user');
INSERT INTO workspace_members (workspace_id,user_id,role)
VALUES ('reset-workspace','reset-user','owner');
INSERT INTO sessions (id,user_id,token_hash,expires_at)
VALUES ('reset-session','reset-user','old-session-token','2099-01-01T00:00:00.000Z');
INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at)
VALUES ('valid-token','reset-user','sha256-token-hash','2099-01-01T00:00:00.000Z');
INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at)
VALUES ('expired-token','reset-user','expired-token-hash','2000-01-01T00:00:00.000Z');
SQL

# A valid unused token is consumable exactly once.
first_changes="$(sqlite3 "$db" "UPDATE password_reset_tokens SET used_at='2026-11-04T00:00:00.000Z' WHERE id='valid-token' AND used_at IS NULL AND expires_at>'2026-11-03T23:59:59.000Z'; SELECT changes();")"
second_changes="$(sqlite3 "$db" "UPDATE password_reset_tokens SET used_at='2026-11-04T00:00:01.000Z' WHERE id='valid-token' AND used_at IS NULL AND expires_at>'2026-11-03T23:59:59.000Z'; SELECT changes();")"
expired_changes="$(sqlite3 "$db" "UPDATE password_reset_tokens SET used_at='2026-11-04T00:00:00.000Z' WHERE id='expired-token' AND used_at IS NULL AND expires_at>'2026-11-03T23:59:59.000Z'; SELECT changes();")"

test "$first_changes" = "1"
test "$second_changes" = "0"
test "$expired_changes" = "0"

# A password reset invalidates every existing session for that account.
sqlite3 "$db" "DELETE FROM sessions WHERE user_id='reset-user';"
remaining_sessions="$(sqlite3 "$db" "SELECT COUNT(*) FROM sessions WHERE user_id='reset-user';")"
test "$remaining_sessions" = "0"

echo "PASS: password reset schema, token expiry, one-time use, and session invalidation checks passed."
