-- Explicit registry for the block-wide administrator.
-- Seed only the owner of the earliest (main) workspace; do not promote every
-- workspace owner or every invited workspace admin to block-wide access.
CREATE TABLE IF NOT EXISTS block_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO block_admins (user_id)
SELECT owner_user_id FROM workspaces ORDER BY created_at LIMIT 1;
INSERT OR IGNORE INTO block_admins (user_id)
SELECT user_id FROM workspace_members
WHERE workspace_id=(SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
  AND role IN ('owner','admin');
