CREATE TABLE IF NOT EXISTS sync_log (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  op_type TEXT NOT NULL,
  field TEXT,
  value TEXT,
  timestamp TEXT NOT NULL,
  device_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_sequence ON sync_log(sequence);
CREATE INDEX IF NOT EXISTS idx_sync_task ON sync_log(task_id);
