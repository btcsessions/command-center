import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { initDb, closeDb } from './db.js';
import { authMiddleware } from './middleware/auth.js';
import tasksRouter from './routes/tasks.js';
import syncRouter from './routes/sync.js';
import backupRouter from './routes/backup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Initialize database
initDb();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (auth required)
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/sync', authMiddleware, syncRouter);
app.use('/api/backup', authMiddleware, backupRouter);

// Serve static frontend
const publicDir = join(__dirname, 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback: serve index.html for any non-API route
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && req.accepts('html')) {
      res.sendFile(join(publicDir, 'index.html'));
    } else {
      next();
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Next Action server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  closeDb();
  process.exit(0);
});
