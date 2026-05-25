-- Row-level security: public read, writes via service role only

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

INSERT INTO sync_state (key, value, updated_at) VALUES
  ('last_synced_slot', '0', 0),
  ('last_sync_timestamp', '0', 0)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Public read campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Public read root_versions" ON root_versions FOR SELECT USING (true);
CREATE POLICY "Public read leaves" ON leaves FOR SELECT USING (true);
CREATE POLICY "Public read claim_events" ON claim_events FOR SELECT USING (true);
CREATE POLICY "Public read sync_state" ON sync_state FOR SELECT USING (true);
CREATE POLICY "Public read waitlist" ON waitlist FOR SELECT USING (true);
