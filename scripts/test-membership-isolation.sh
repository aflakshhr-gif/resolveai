#!/usr/bin/env bash
set -euo pipefail

db="$(mktemp)"
trap 'rm -f "$db"' EXIT

cat migrations/0001_initial.sql migrations/0002_team_invites.sql migrations/0003_unit_membership_workspaces.sql migrations/0004_block_admin_workspaces.sql | sqlite3 "$db"

sqlite3 "$db" <<'SQL'
PRAGMA foreign_keys = ON;
INSERT INTO users (id,email,password_hash,password_salt) VALUES
  ('block-admin','admin@example.invalid','hash','salt'),
  ('unit-a1','a1@example.invalid','hash','salt'),
  ('unit-a2','a2@example.invalid','hash','salt'),
  ('unit-b1','b1@example.invalid','hash','salt');
INSERT INTO block_admins (user_id) VALUES ('block-admin');

INSERT INTO workspaces (id,name,owner_user_id) VALUES
  ('main','Main workspace','block-admin'),
  ('workspace-a','Unit A101','block-admin'),
  ('workspace-b','Unit B202','block-admin');

INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
  ('main','block-admin','owner'),
  ('main','unit-a1','viewer'),
  ('main','unit-a2','viewer'),
  ('main','unit-b1','viewer');
-- Simulate an admin who was already present as a normal member in A101.
INSERT INTO workspace_members (workspace_id,user_id,role)
VALUES ('workspace-a','block-admin','agent');
-- The same upsert is used by the application to guarantee administrator access.
INSERT INTO workspace_members (workspace_id,user_id,role)
SELECT workspace_id,'block-admin','admin' FROM unit_workspaces WHERE 1
ON CONFLICT(workspace_id,user_id) DO UPDATE
SET role=CASE WHEN workspace_members.role='owner' THEN 'owner' ELSE 'admin' END;

INSERT INTO membership_requests (user_id,unit_code,status) VALUES
  ('unit-a1','a101','pending'),
  ('unit-a2','A101','pending'),
  ('unit-b1','B202','pending');

INSERT INTO unit_workspaces (unit_code,workspace_id) VALUES
  ('A101','workspace-a'),
  ('B202','workspace-b');

UPDATE membership_requests SET status='approved' WHERE user_id='unit-a1';
UPDATE membership_requests SET status='approved' WHERE user_id='unit-a2';
UPDATE membership_requests SET status='approved' WHERE user_id='unit-b1';

UPDATE workspace_members SET workspace_id='workspace-a',role='agent' WHERE user_id='unit-a1';
UPDATE workspace_members SET workspace_id='workspace-a',role='agent' WHERE user_id='unit-a2';
UPDATE workspace_members SET workspace_id='workspace-b',role='agent' WHERE user_id='unit-b1';

INSERT INTO conversations (id,workspace_id,customer_name,subject) VALUES
  ('ticket-a','workspace-a','Customer A','Unit A ticket'),
  ('ticket-b','workspace-b','Customer B','Unit B ticket');
SQL

unit_a_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='unit-a1';")"
unit_a2_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='unit-a2';")"
unit_b_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='unit-b1';")"
cross_unit_visible="$(sqlite3 "$db" "SELECT COUNT(*) FROM conversations c JOIN workspace_members wm ON wm.workspace_id=c.workspace_id WHERE wm.user_id='unit-a1' AND c.id='ticket-b';")"
same_unit_workspace_count="$(sqlite3 "$db" "SELECT COUNT(DISTINCT workspace_id) FROM workspace_members WHERE user_id IN ('unit-a1','unit-a2');")"
admin_unit_count="$(sqlite3 "$db" "SELECT COUNT(*) FROM workspace_members wm JOIN unit_workspaces uw ON uw.workspace_id=wm.workspace_id WHERE wm.user_id='block-admin' AND wm.role='admin';")"

test "$unit_a_visible" = "1"
test "$unit_a2_visible" = "1"
test "$unit_b_visible" = "1"
test "$cross_unit_visible" = "0"
test "$same_unit_workspace_count" = "1"
test "$admin_unit_count" = "2"

echo "Unit membership migration and cross-unit isolation checks passed."
