import request from 'supertest';
import { createTestApp } from '../helpers/create-test-server.js';

/**
 * E2E-тесты авторизации — полная проверка регистрации, логина, токенов.
 */

describe('E2E — Auth API', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  // ─── POST /api/auth/register ───────────────────────────────────

  describe('POST /api/auth/register', () => {
    test('creates a new user and returns token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.username).toBe('newuser');
      // Token — JWT (3 части через точку)
      expect(res.body.token.split('.')).toHaveLength(3);
    });

    test('returns 409 for duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'dupuser', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'dupuser', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Username already taken');
    });

    test('rejects too-short username (1 char)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'a', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username must be 2-30 chars, alphanumeric or underscore');
    });

    test('rejects username with special characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'user@name!', password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('rejects too-long username (>30 chars)', async () => {
      const longName = 'a'.repeat(31);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: longName, password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('rejects short password (<6 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'longpass', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 6 characters');
    });

    test('rejects missing username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('rejects empty username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: '', password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('validates username as string type', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 123, password: 'password123' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const testUser = 'logintest';
    const testPass = 'correctpass';

    beforeAll(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: testUser, password: testPass });
    });

    test('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser, password: testPass });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.username).toBe(testUser);
    });

    test('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser, password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid username or password');
    });

    test('returns 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid username or password');
    });

    test('rejects missing username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: testPass });

      expect(res.status).toBe(400);
    });

    test('rejects missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser });

      expect(res.status).toBe(400);
    });

    test('rejects both fields missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/auth/me ──────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    let token;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'logintest', password: 'correctpass' });

      token = res.body.token;
    });

    test('returns user info with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('logintest');
    });

    test('returns 401 without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });

    test('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });
});
