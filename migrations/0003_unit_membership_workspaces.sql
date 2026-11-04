-- Unit membership workflow and per-unit private workspace isolation.
-- Apply only to the dedicated ResolveAI D1 database.

CREATE TABLE IF NOT EXISTS membership_requests (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  identity_number TEXT,
  unit_code TEXT,
  unit_details TEXT,
  resident_type TEXT CHECK (resident_type IS NULL OR resident_type IN ('owner','tenant','family')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer','cash','other')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (status IN ('not_submitted','pending','approved','rejected')),
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_membership_requests_status
  ON membership_requests(status, updated_at);

CREATE TABLE IF NOT EXISTS unit_workspaces (
  unit_code TEXT PRIMARY KEY COLLATE NOCASE,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
