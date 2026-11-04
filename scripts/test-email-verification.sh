#!/usr/bin/env bash
set -euo pipefail

db="$(mktemp)"
trap 'rm -f "$db"' EXIT

{
  echo "PRAGMA foreign_keys = ON;"
  cat migrations/0001_initial.sql migrations/0002_team_invites.sql migrations/0003_unit_membership_workspaces.sql migrations/0004_block_admin_workspaces.sql migrations/0005_password_reset.sql migrations/0006_email_verification.sql
} | sqlite3 "$db"

sqlite3 "$db" <<'SQL'
INSERT INTO users (id,email,password_hash,password_salt)
VALUES ('legacy-user','legacy@example.invalid','hash','salt');
INSERT INTO users (id,email,password_hash,password_salt)
VALUES ('new-user','new@example.invalid','hash','salt');
INSERT INTO user_email_verification_status (user_id,verified_at)
VALUES ('new-user',NULL);
INSERT INTO email_verification_tokens (id,user_id,token_hash,expires_at)
VALUES ('valid-email-token','new-user','verified-token-hash','2099-01-01T00:00:00.000Z');
INSERT INTO email_verification_tokens (id,user_id,token_hash,expires_at)
VALUES ('expired-email-token','new-user','expired-verification-hash','2000-01-01T00:00:00.000Z');
SQL

# Legacy accounts without a verification-status row remain eligible to sign in.
legacy_status_rows="$(sqlite3 "$db" "SELECT COUNT(*) FROM user_email_verification_status WHERE user_id='legacy-user';")"
pending_status="$(sqlite3 "$db" "SELECT CASE WHEN verified_at IS NULL THEN 'pending' ELSE 'verified' END FROM user_email_verification_status WHERE user_id='new-user';")"
test "$legacy_status_rows" = "0"
test "$pending_status" = "pending"

first_changes="$(sqlite3 "$db" "UPDATE email_verification_tokens SET used_at='2026-11-04T00:00:00.000Z' WHERE id='valid-email-token' AND used_at IS NULL AND expires_at>'2026-11-03T23:59:59.000Z'; SELECT changes();")"
second_changes="$(sqlite3 "$db" "UPDATE email_verification_tokens SET used_at='2026-11-04T00:00:01.000Z' WHERE id='valid-email-token' AND used_at IS NULL AND expires_at>'2026-11-03T23:59:59.000Z'; SELECT changes();")"
expired_changes="$(sqlite3 "$db" "UPDATE email_verification_tokens SET used_at='2026-11-04T00:00:00.000Z' WHERE id='expired-email-token' AND used_at IS NULL AND expires_at>'2026-11-03T23:59:59.000Z'; SELECT changes();")"
test "$first_changes" = "1"
test "$second_changes" = "0"
test "$expired_changes" = "0"

sqlite3 "$db" <<'SQL'
UPDATE user_email_verification_status
SET verified_at='2026-11-04T00:00:00.000Z'
WHERE user_id='new-user' AND verified_at IS NULL;
UPDATE users SET email_verified_at='2026-11-04T00:00:00.000Z'
WHERE id='new-user' AND EXISTS (
  SELECT 1 FROM user_email_verification_status
  WHERE user_id='new-user' AND verified_at='2026-11-04T00:00:00.000Z'
);
SQL

verified_status="$(sqlite3 "$db" "SELECT CASE WHEN verified_at IS NULL THEN 'pending' ELSE 'verified' END FROM user_email_verification_status WHERE user_id='new-user';")"
user_verified_at="$(sqlite3 "$db" "SELECT email_verified_at FROM users WHERE id='new-user';")"
test "$verified_status" = "verified"
test "$user_verified_at" = "2026-11-04T00:00:00.000Z"

echo "PASS: signup email verification, one-time links, expiry, and legacy account compatibility checks passed."
