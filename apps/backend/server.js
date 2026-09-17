import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── API Routes ────────────────────────────────────────────────

// GET /api/todos — all todos
app.get('/api/todos', async (_req, res) => {
  try {
    res.json(await db.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos — create a new todo
app.post('/api/todos', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const todo = await db.create(text.trim());
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id — toggle or update a todo
app.put('/api/todos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.getOne(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { completed, text } = req.body;

    if (typeof completed === 'boolean') {
      const updated = await db.toggle(id);
      return res.json(updated);
    }

    if (text !== undefined) {
      const updated = await db.updateText(id, text.trim());
      if (!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    }

    return res.status(400).json({ error: 'Provide completed or text' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/completed — clear completed todos (MUST be before /:id)
app.delete('/api/todos/completed', async (_req, res) => {
  try {
    await db.clearCompleted();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id — delete one todo
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!await db.delete(id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve Frontend (production) ──────────────────────────────

const frontendDist = path.join(__dirname, '..', '..', 'apps', 'frontend', 'dist');

app.use(express.static(frontendDist));

// Any non-API request → index.html (SPA fallback)
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────

async function start() {
  await db.init();
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📦 Frontend: http://localhost:${PORT}/`);
  console.log(`🔌 API:      http://localhost:${PORT}/api/`);
  console.log(`💾 Database: ${db.filename || 'memory'}`);

  app.listen(PORT, '0.0.0.0', () => {
    // graceful shutdown
    process.on('SIGINT', () => {
      db.save();
      process.exit(0);
    });
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
