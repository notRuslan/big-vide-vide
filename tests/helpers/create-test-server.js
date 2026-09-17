/**
 * Создаёт Express-приложение для e2e-тестов без запуска сервера.
 * Инициализирует БД и возвращает готовый app.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../apps/backend/db.js';
import { authMiddleware, generateToken } from '../../apps/backend/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Создаёт Express-приложение с реальными маршрутами (без app.listen).
 */
export async function createTestApp() {
  // Инициализируем БД с тестовым путём (уникальным для каждого вызова)
  const osModule = await import('os');
  process.env.DB_PATH = path.join(osModule.tmpdir(), `big-vibe-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  await db.init();

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // ─── Auth Routes ───────────────────────────────────────────────

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
      }
      if (!/^[a-zA-Z0-9_]{2,30}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 2-30 chars, alphanumeric or underscore' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const existing = db.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      const passwordHash = db.hashPassword(password);
      const user = db.createUser(username, passwordHash);
      const token = generateToken(user.id);
      res.status(201).json({ token, user: { username: user.username } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

  app.get('/api/todos', authMiddleware, async (req, res) => {
    try {
      res.json(await db.getAllByUserId(req.userId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

  app.delete('/api/todos/completed', authMiddleware, async (req, res) => {
    try {
      await db.clearCompletedForUser(req.userId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

  return app;
}

/**
 *Alias for createTestApp to match the import name in test-setup.js
 */
export const createTestServer = createTestApp;
