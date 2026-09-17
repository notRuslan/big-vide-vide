import request from 'supertest';
import { createTestApp } from '../helpers/create-test-server.js';

/**
 * E2E-тесты API — реальные HTTP-запросы к Express-приложению.
 * Сервер полностью функционален: реальная БД, middleware, маршруты.
 */

describe('E2E — Todo API', () => {
  let app;
  let token;

  beforeEach(async () => {
    // Переинициализируем БД для изоляции тестов
    app = await createTestApp();
    // Регистрируем тестового пользователя
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'e2etest', password: 'password123' });

    expect(res.status).toBe(201);
    token = res.body.token;
  });

  // ─── GET /api/todos ────────────────────────────────────────────

  describe('GET /api/todos', () => {
    test('returns empty array for new user', async () => {
      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns 401 without token', async () => {
      const res = await request(app).get('/api/todos');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });
  });

  // ─── POST /api/todos ───────────────────────────────────────────

  describe('POST /api/todos', () => {
    test('creates a new todo', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Buy groceries' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.text).toBe('Buy groceries');
      expect(res.body.completed).toBe(false);
      expect(res.body.userId).toBeDefined();
    });

    test('text is trimmed', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '  Spaced text  ' });

      expect(res.status).toBe(201);
      expect(res.body.text).toBe('Spaced text');
    });

    test('rejects empty text', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Text is required');
    });

    test('rejects missing text', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Text is required');
    });

    test('creates multiple todos with incrementing ids', async () => {
      const t1 = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Task 1' });

      const t2 = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Task 2' });

      expect(t2.body.id).toBe(t1.body.id + 1);
    });
  });

  // ─── PUT /api/todos/:id — toggle ───────────────────────────────

  describe('PUT /api/todos/:id (toggle)', () => {
    let todoId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Toggle target' });

      todoId = res.body.id;
    });

    test('toggles completed from false to true', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    test('toggles completed from true back to false', async () => {
      // Создаём todo и сначала отмечаем его как выполненный
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Toggle target 2' });

      // Toggle в true (с false -> true)
      await request(app)
        .put(`/api/todos/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true });

      // Toggle обратно в false (с true -> false)
      const res = await request(app)
        .put(`/api/todos/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: false });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(false);
    });

    test('returns 404 for non-existent todo', async () => {
      const res = await request(app)
        .put('/api/todos/99999')
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  // ─── PUT /api/todos/:id — update text ──────────────────────────

  describe('PUT /api/todos/:id (update text)', () => {
    let todoId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Original text' });

      todoId = res.body.id;
    });

    test('updates todo text', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Updated text' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated text');
    });

    test('text is trimmed', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '  New  ' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('New');
    });
  });

  // ─── DELETE /api/todos/:id ─────────────────────────────────────

  describe('DELETE /api/todos/:id', () => {
    test('deletes a todo', async () => {
      // Create first
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'To delete' });

      const deleteRes = await request(app)
        .delete(`/api/todos/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.ok).toBe(true);

      // Verify gone
      const getRes = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${token}`);

      const ids = getRes.body.map(t => t.id);
      expect(ids).not.toContain(created.body.id);
    });

    test('returns 404 for non-existent todo', async () => {
      const res = await request(app)
        .delete('/api/todos/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  // ─── DELETE /api/todos/completed ───────────────────────────────

  describe('DELETE /api/todos/completed', () => {
    test('clears all completed todos', async () => {
      // Create some todos
      const t1 = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Active task' });

      const t2 = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Completed task' });

      // Complete t2
      await request(app)
        .put(`/api/todos/${t2.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true });

      // Clear completed
      const res = await request(app)
        .delete('/api/todos/completed')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verify only active remains
      const todos = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${token}`);

      expect(todos.body).toHaveLength(1);
      expect(todos.body[0].text).toBe('Active task');
      expect(todos.body[0].completed).toBe(false);
    });

    test('works when no completed todos', async () => {
      const res = await request(app)
        .delete('/api/todos/completed')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ─── Error handling ────────────────────────────────────────────

  describe('Error handling', () => {
    test('PUT with no body fields returns 400', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Test' });

      const res = await request(app)
        .put(`/api/todos/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Provide completed or text');
    });

    test('all protected routes reject without token', async () => {
      const routes = [
        { method: 'get', path: '/api/todos' },
        { method: 'post', path: '/api/todos', body: { text: 'x' } },
        { method: 'put', path: '/api/todos/1', body: { completed: true } },
        { method: 'delete', path: '/api/todos/1' },
        { method: 'delete', path: '/api/todos/completed' },
      ];

      for (const route of routes) {
        const res = await request(app)[route.method](route.path)
          .send(route.body || {});

        expect(res.status).toBe(401);
      }
    });
  });
});
