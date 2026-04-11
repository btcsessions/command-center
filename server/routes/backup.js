import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/backup/export
router.get('/export', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tasks WHERE deleted = 0').all();
  const completionRows = db.prepare('SELECT task_id, completed_date FROM completions').all();

  const completionMap = {};
  for (const c of completionRows) {
    if (!completionMap[c.task_id]) completionMap[c.task_id] = [];
    completionMap[c.task_id].push(c.completed_date);
  }

  const tasks = rows.map(r => ({
    id: r.id,
    category: r.category,
    title: r.title,
    recurring: r.recurring_type ? {
      type: r.recurring_type,
      days: r.recurring_days ? JSON.parse(r.recurring_days) : [],
      interval: r.recurring_interval || 0
    } : null,
    completions: completionMap[r.id] || [],
    createdAt: r.created_at,
    sortOrder: r.sort_order,
    urgency: r.urgency,
    dueDate: r.due_date,
    notes: r.notes || ''
  }));

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks
  });
});

// POST /api/backup/import
router.post('/import', (req, res) => {
  const db = getDb();
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks array required' });
  }

  const now = new Date().toISOString();

  const importAll = db.transaction(() => {
    // Clear existing data
    db.prepare('DELETE FROM completions').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM sync_log').run();

    for (const task of tasks) {
      db.prepare(`
        INSERT INTO tasks (id, category, title, recurring_type, recurring_days, recurring_interval, sort_order, urgency, due_date, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id,
        task.category,
        task.title,
        task.recurring?.type || null,
        task.recurring?.days ? JSON.stringify(task.recurring.days) : null,
        task.recurring?.interval || null,
        task.sortOrder || 0,
        task.urgency || 'medium',
        task.dueDate || null,
        task.notes || '',
        task.createdAt || now,
        now
      );

      if (task.completions && task.completions.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO completions (task_id, completed_date, created_at) VALUES (?, ?, ?)');
        for (const date of task.completions) {
          stmt.run(task.id, date, now);
        }
      }
    }

    db.prepare(`INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id) VALUES ('__import__', 'import', '*', ?, ?, 'server')`).run(String(tasks.length), now);
  });

  importAll();
  res.json({ ok: true, imported: tasks.length });
});

export default router;
