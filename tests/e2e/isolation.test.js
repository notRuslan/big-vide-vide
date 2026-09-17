import request from 'supertest';
import { createTestApp } from '../helpers/create-test-server.js';

/**
 * E2E-тесты изоляции — проверка, что данные пользователей разделены.
 * Ключевое требование: каждый пользователь видит только свои задачи.
 */

describe('E2E — User Isolation', () => {
  let app;

  beforeEach(async () => {
    app = await createTestApp();
  });

  // ─── Регистрация двух пользователей ──────────────────────────

  // Извлекает userId из JWT payload (вторая часть токена)
  function extractUserId(token) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId;
  }

  async function registerUser(username, password = 'password123') {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password });
    return { token: res.body.token, userId: extractUserId(res.body.token) };
  }

  describe('GET /api/todos — only own todos', () => {
    let userA, userB;

    beforeEach(async () => {
      userA = await registerUser('alice_isolation');
      userB = await registerUser('bob_isolation');
    });

    test('user A sees only their own todos', async () => {
      // Создаём задачи для обоих
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Alice task' });

      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ text: 'Bob task' });

      // A видит только свои
      const resA = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(resA.body).toHaveLength(1);
      expect(resA.body[0].text).toBe('Alice task');
    });

    test('user B sees only their own todos', async () => {
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Alice task' });

      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ text: 'Bob task' });

      const resB = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userB.token}`);

      expect(resB.body).toHaveLength(1);
      expect(resB.body[0].text).toBe('Bob task');
    });
  });

  // ─── PUT /api/todos/:id — cannot modify other user's todo ────

  describe('PUT /api/todos/:id — cross-user access denied', () => {
    let userA, userB, todoId;

    beforeEach(async () => {
      userA = await registerUser('alice_put');
      userB = await registerUser('bob_put');

      // Создаём задачу от имени A
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Alice todo' });

      todoId = createRes.body.id;
    });

    test('user B cannot toggle A\'s todo (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ completed: true });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });

    test('user B cannot update A\'s todo text (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ text: 'Hacked!' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });

    test('user A CAN toggle their own todo', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    test('user A CAN update their own todo text', async () => {
      const res = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Updated by A' });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Updated by A');
    });
  });

  // ─── DELETE /api/todos/:id — cannot delete other user's todo ─

  describe('DELETE /api/todos/:id — cross-user access denied', () => {
    let userA, userB, todoId;

    beforeEach(async () => {
      userA = await registerUser('alice_del');
      userB = await registerUser('bob_del');

      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Alice todo to delete' });

      todoId = createRes.body.id;
    });

    test('user B cannot delete A\'s todo (returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });

    test('user A CAN delete their own todo', async () => {
      const res = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ─── DELETE /api/todos/completed — cannot clear other's ──────

  describe('DELETE /api/todos/completed — isolation', () => {
    let userA, userB;

    beforeEach(async () => {
      userA = await registerUser('alice_clear');
      userB = await registerUser('bob_clear');

      // Создаём задачи
      const tA = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Alice completed' });
      await request(app)
        .put(`/api/todos/${tA.body.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ completed: true });

      const tB = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ text: 'Bob active' });
    });

    test('user A clearing completed does not affect user B', async () => {
      await request(app)
        .delete('/api/todos/completed')
        .set('Authorization', `Bearer ${userA.token}`);

      // B's active task still exists
      const resB = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userB.token}`);

      expect(resB.body).toHaveLength(1);
      expect(resB.body[0].text).toBe('Bob active');
    });
  });

  // ─── POST /api/todos — userId matches token ──────────────────

  describe('POST /api/todos — userId bound to token', () => {
    test('created todo belongs to the authenticating user', async () => {
      const userA = await registerUser('alice_uid');
      const userB = await registerUser('bob_uid');

      // A создаёт задачу
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ text: 'Owned by A' });

      expect(created.body.userId).toBe(userA.userId);

      // B не может увидеть эту задачу
      const todosB = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userB.token}`);

      expect(todosB.body).toHaveLength(0);
    });
  });

  // ─── Protected routes — every one rejects without token ──────

  describe('All protected routes reject without token', () => {
    test('DELETE /api/todos/completed requires token', async () => {
      const res = await request(app)
        .delete('/api/todos/completed');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });

    test('DELETE /api/todos/:id requires token', async () => {
      const res = await request(app)
        .delete('/api/todos/1');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });

    test('PUT /api/todos/:id requires token', async () => {
      const res = await request(app)
        .put('/api/todos/1')
        .send({ completed: true });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });

    test('GET /api/todos requires token', async () => {
      const res = await request(app).get('/api/todos');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });
  });
});
