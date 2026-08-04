CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL
);

CREATE TABLE insurers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  customer_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tax_id_fake TEXT,
  classification TEXT NOT NULL DEFAULT 'SYNTHETIC' CHECK (classification = 'SYNTHETIC')
);

CREATE TABLE policies (
  id TEXT PRIMARY KEY,
  policy_number TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  insurer_id TEXT NOT NULL REFERENCES insurers(id),
  product TEXT NOT NULL,
  status TEXT NOT NULL,
  inception_date TEXT NOT NULL,
  renewal_date TEXT NOT NULL,
  premium DOUBLE PRECISION NOT NULL,
  risk_summary TEXT NOT NULL
);
CREATE UNIQUE INDEX policies_number_insurer ON policies(policy_number, insurer_id);

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  workflow TEXT NOT NULL DEFAULT 'UNKNOWN',
  status TEXT NOT NULL DEFAULT 'NEW',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  assignee_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE communications (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  sender TEXT NOT NULL,
  recipients TEXT NOT NULL DEFAULT 'operaciones@rosillo.test',
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  communication_id TEXT NOT NULL REFERENCES communications(id),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_key TEXT,
  text TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL
);

CREATE TABLE analysis_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  version INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_versions TEXT NOT NULL,
  rules_version TEXT,
  input_hash TEXT NOT NULL,
  output_json TEXT,
  draft_json TEXT,
  output_hash TEXT,
  confidence DOUBLE PRECISION,
  duration_ms INTEGER NOT NULL,
  error_code TEXT,
  error_detail TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (case_id, version)
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  decision_type TEXT NOT NULL,
  edits_json TEXT NOT NULL DEFAULT '{}',
  feedback_codes TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  override_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE evaluation_labels (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  expected_json TEXT NOT NULL,
  labeler_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- Immutability guarantees (spec sections 10 and 13): analysis runs are
-- immutable after creation; audit events can never be updated or deleted
-- through the application layer.
CREATE OR REPLACE FUNCTION rosillo_forbid_analysis_run_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'analysis runs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rosillo_forbid_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analysis_runs_no_update BEFORE UPDATE ON analysis_runs
FOR EACH ROW EXECUTE FUNCTION rosillo_forbid_analysis_run_update();

CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION rosillo_forbid_audit_change();

CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION rosillo_forbid_audit_change();
