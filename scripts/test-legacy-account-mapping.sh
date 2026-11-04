#!/usr/bin/env bash
set -euo pipefail

db="$(mktemp)"
trap 'rm -f "$db"' EXIT

cat migrations/0001_initial.sql migrations/0002_team_invites.sql migrations/0003_unit_membership_workspaces.sql migrations/0004_block_admin_workspaces.sql | sqlite3 "$db"

sqlite3 "$db" <<'SQL'
PRAGMA foreign_keys = ON;
INSERT INTO users (id,email,password_hash,password_salt) VALUES
  ('block-admin','admin@example.invalid','admin-hash-unchanged','admin-salt-unchanged'),
  ('legacy-a1','a1@example.invalid','hash-a1','salt-a1'),
  ('legacy-a2','a2@example.invalid','hash-a2','salt-a2'),
  ('legacy-b1','b1@example.invalid','hash-b1','salt-b1');
INSERT INTO workspaces (id,name,owner_user_id) VALUES
  ('main','Main workspace','block-admin'),
  ('workspace-a','Unit A101','block-admin'),
  ('workspace-b','Unit B202','block-admin');
INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
  ('main','block-admin','owner'),
  ('main','legacy-a1','viewer'),
  ('main','legacy-a2','agent'),
  ('main','legacy-b1','viewer');
INSERT INTO block_admins (user_id) VALUES ('block-admin');
INSERT INTO unit_workspaces (unit_code,workspace_id) VALUES
  ('A101','workspace-a'),
  ('B202','workspace-b');
INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
  ('workspace-a','block-admin','admin'),
  ('workspace-b','block-admin','admin');

-- Simulate three explicit administrator-confirmed account assignments.
INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
  ('workspace-a','legacy-a1','agent'),
  ('workspace-a','legacy-a2','agent'),
  ('workspace-b','legacy-b1','agent');
DELETE FROM workspace_members
WHERE workspace_id='main' AND user_id IN ('legacy-a1','legacy-a2','legacy-b1');
INSERT INTO membership_requests (user_id,unit_code,status,reviewed_by_user_id,review_note)
VALUES
  ('legacy-a1','A101','approved','block-admin','Mapped from verified resident roster'),
  ('legacy-a2','A101','approved','block-admin','Mapped from verified resident roster'),
  ('legacy-b1','B202','approved','block-admin','Mapped from verified resident roster');

INSERT INTO conversations (id,workspace_id,customer_name,subject) VALUES
  ('ticket-a','workspace-a','Customer A','Unit A ticket'),
  ('ticket-b','workspace-b','Customer B','Unit B ticket');
SQL

same_unit="$(sqlite3 "$db" "SELECT COUNT(DISTINCT workspace_id) FROM workspace_members WHERE user_id IN ('legacy-a1','legacy-a2');")"
unit_a_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='legacy-a1';")"
unit_a_cross_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='legacy-a1' AND c.id='ticket-b';")"
admin_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='block-admin';")"
admin_unit_access="$(sqlite3 "$db" "SELECT COUNT(*) FROM workspace_members wm JOIN unit_workspaces uw ON uw.workspace_id=wm.workspace_id WHERE wm.user_id='block-admin' AND wm.role='admin';")"
hashes_unchanged="$(sqlite3 "$db" "SELECT COUNT(*) FROM users WHERE id IN ('legacy-a1','legacy-a2','legacy-b1') AND password_hash LIKE 'hash-%' AND password_salt LIKE 'salt-%';")"
test "$same_unit" = "1"
test "$unit_a_visible" = "1"
test "$unit_a_cross_visible" = "0"
test "$admin_visible" = "2"
test "$admin_unit_access" = "2"
test "$hashes_unchanged" = "3"
echo "PASS: verified legacy account mapping preserves hashes, shares same-unit workspace, isolates other units, and grants block-admin visibility across unit workspaces."
