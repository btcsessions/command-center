import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Helper: convert DB row to client task format
function rowToTask(row, completions) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    recurring: row.recurring_type ? {
      type: row.recurring_type,
      days: row.recurring_days ? JSON.parse(row.recurring_days) : [],
      interval: row.recurring_interval || 0
    } : null,
    completions: completions || [],
    createdAt: row.created_at,
    sortOrder: row.sort_order,
    urgency: row.urgency,
    dueDate: row.due_date,
    notes: row.notes || ''
  };
}

// GET /api/tasks - get all active tasks with completions
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tasks WHERE deleted = 0').all();
  const completionRows = db.prepare('SELECT task_id, completed_date FROM completions').all();

  const completionMap = {};
  for (const c of completionRows) {
    if (!completionMap[c.task_id]) completionMap[c.task_id] = [];
    completionMap[c.task_id].push(c.completed_date);
  }

  const tasks = rows.map(r => rowToTask(r, completionMap[r.id] || []));
  res.json(tasks);
});

// POST /api/tasks - create a task
router.post('/', (req, res) => {
  const db = getDb();
  const { id, category, title, recurring, sortOrder, urgency, dueDate, notes, createdAt } = req.body;

  const taskId = id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, category, title, recurring_type, recurring_days, recurring_interval, sort_order, urgency, due_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    taskId,
    category,
    title,
    recurring?.type || null,
    recurring?.days ? JSON.stringify(recurring.days) : null,
    recurring?.interval || null,
    sortOrder || 0,
    urgency || 'medium',
    dueDate || null,
    notes || '',
    createdAt || now,
    now
  );

  // Log to sync
  logSync(db, taskId, 'create', '*', null, now, req.body.deviceId || 'server');

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(201).json(rowToTask(row, []));
});

// PUT /api/tasks/:id - update a task
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const updates = req.body;
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted = 0').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const fields = {};
  if (updates.title !== undefined) fields.title = updates.title;
  if (updates.category !== undefined) fields.category = updates.category;
  if (updates.urgency !== undefined) fields.urgency = updates.urgency;
  if (updates.dueDate !== undefined) fields.due_date = updates.dueDate;
  if (updates.notes !== undefined) fields.notes = updates.notes;
  if (updates.sortOrder !== undefined) fields.sort_order = updates.sortOrder;
  if (updates.recurring !== undefined) {
    fields.recurring_type = updates.recurring?.type || null;
    fields.recurring_days = updates.recurring?.days ? JSON.stringify(updates.recurring.days) : null;
    fields.recurring_interval = updates.recurring?.interval || null;
  }

  if (Object.keys(fields).length > 0) {
    fields.updated_at = now;
    const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, id);

    // Log each field change
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'updated_at') continue;
      logSync(db, id, 'update', field, String(value), now, updates.deviceId || 'server');
    }
  }

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const completions = db.prepare('SELECT completed_date FROM completions WHERE task_id = ?').all(id).map(r => r.completed_date);
  res.json(rowToTask(row, completions));
});

// DELETE /api/tasks/:id - soft delete
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  db.prepare('UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ?').run(now, id);
  logSync(db, id, 'delete', '*', null, now, 'server');

  res.status(204).end();
});

// POST /api/tasks/:id/complete - mark task complete for a date
router.post('/:id/complete', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { date } = req.body;
  const now = new Date().toISOString();

  const completionDate = date || now.slice(0, 10);

  try {
    db.prepare('INSERT OR IGNORE INTO completions (task_id, completed_date, created_at) VALUES (?, ?, ?)').run(id, completionDate, now);
    db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(now, id);
    logSync(db, id, 'complete', 'completion', completionDate, now, req.body.deviceId || 'server');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/tasks/reorder - batch update sort orders
router.post('/reorder', (req, res) => {
  const db = getDb();
  const { category, orderedIds } = req.body;
  const now = new Date().toISOString();

  const stmt = db.prepare('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?');
  const updateAll = db.transaction(() => {
    orderedIds.forEach((id, i) => stmt.run(i, now, id));
  });
  updateAll();

  logSync(db, category, 'reorder', 'sort_order', JSON.stringify(orderedIds), now, 'server');
  res.json({ ok: true });
});

function logSync(db, taskId, opType, field, value, timestamp, deviceId) {
  db.prepare(`
    INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, opType, field, value, timestamp, deviceId);
}

export default router;
