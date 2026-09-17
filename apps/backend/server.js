import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { authMiddleware, generateToken } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Auth Routes ───────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!/^[a-zA-Z0-9_]{2,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 2-30 chars, alphanumeric or underscore' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Create user
    const passwordHash = db.hashPassword(password);
    const user = db.createUser(username, passwordHash);
    const token = generateToken(user.id);

    res.status(201).json({ token, user: { username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = db.comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user.id);
    res.json({ token, user: { username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = db.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Protected API Routes (Todos) ─────────────────────────────

// GET /api/todos — current user's todos
app.get('/api/todos', authMiddleware, async (req, res) => {
  try {
    res.json(await db.getAllByUserId(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos — create todo for current user
app.post('/api/todos', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const todo = await db.createForUser(req.userId, text.trim());
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id — toggle or update current user's todo
app.put('/api/todos/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.getOne(id);
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { completed, text } = req.body;

    if (typeof completed === 'boolean') {
      const updated = await db.toggleForUser(req.userId, id);
      return res.json(updated);
    }

    if (text !== undefined) {
      const updated = await db.updateTextForUser(req.userId, id, text.trim());
      if (!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    }

    return res.status(400).json({ error: 'Provide completed or text' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/completed — clear completed for current user (MUST be before /:id)
app.delete('/api/todos/completed', authMiddleware, async (req, res) => {
  try {
    await db.clearCompletedForUser(req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id — delete current user's todo
app.delete('/api/todos/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!await db.deleteForUser(req.userId, id)) {
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
