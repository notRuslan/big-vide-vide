import request from 'supertest';
import { createTestApp } from '../helpers/create-test-server.js';

/**
 * E2E-тесты админ-панели — регистрация первого админа, CRUD пользователей, middleware.
 *
 * Подход: createTestApp() в beforeEach для изоляции БД.
 * beforeAll в nested describe — НЕ используется (beforeEach затирает его).
 * Все тесты самодостаточны.
 */

describe('E2E — Admin API', () => {
  let app;

  beforeEach(async () => {
    app = await createTestApp();
  });

  // ─── First user becomes admin ──────────────────────────────────

  test('first registered user gets isAdmin=true', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'admin1', password: 'password123' });

    expect(res.status).toBe(201);
    const token = res.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.isAdmin).toBe(true);
    expect(meRes.body.username).toBe('admin1');
  });

  test('second registered user does NOT get admin', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'admin2', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'regular2', password: 'password123' });

    expect(res.status).toBe(201);
    const token = res.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.isAdmin).toBe(false);
  });

  // ─── Admin access control ──────────────────────────────────────

  test('admin can access GET /api/admin/users', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminCtrl', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'regularCtrl', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminCtrl', password: 'password123' });
    const adminToken = adminRes.body.token;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).not.toHaveProperty('password_hash');
    expect(res.body[0]).toHaveProperty('isAdmin');
  });

  test('regular user gets 403 on admin routes', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminCtrl', password: 'password123' });

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'regularCtrl', password: 'password123' });
    const regularToken = regRes.body.token;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${regularToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });

  test('no auth header returns 401 on admin routes', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  // ─── GET /api/admin/users/:id ──────────────────────────────────

  test('admin can get single user by id', async () => {
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminId', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminId = listRes.body.find(u => u.username === 'adminId').id;

    const res = await request(app)
      .get(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(adminId);
    expect(res.body.username).toBe('adminId');
    expect(res.body.isAdmin).toBe(true);
  });

  test('GET /api/admin/users/:id returns 404 for non-existent', async () => {
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminId404', password: 'password123' });
    const adminToken = adminRes.body.token;

    const res = await request(app)
      .get('/api/admin/users/99999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  // ─── PUT /api/admin/users/:id ──────────────────────────────────

  test('PUT updates username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newTargetName' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('newTargetName');
  });

  test('PUT updates is_admin to true', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_admin: true });

    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });

  test('PUT updates password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'newpassword456' });

    expect(res.status).toBe(200);
  });

  test('can login with new password after update', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    // Update username + password
    await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newTargetName', password: 'newpassword456' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'newTargetName', password: 'newpassword456' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
  });

  test('PUT rejects invalid username format', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username must be 2-30 chars, alphanumeric or underscore');
  });

  test('PUT rejects short password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password must be at least 6 characters');
  });

  test('PUT rejects duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'targetUpd', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'uniqueName', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = listRes.body.find(u => u.username === 'targetUpd');

    const res = await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'uniqueName' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Username already taken');
  });

  test('PUT rejects update for non-existent user', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminUpd', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminUpd', password: 'password123' });
    const adminToken = adminRes.body.token;

    const res = await request(app)
      .put('/api/admin/users/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  // ─── Edge cases ────────────────────────────────────────────────

  test('PUT with no fields returns 400', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminEdge', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'regEdge', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminEdge', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const regUser = listRes.body.find(u => u.username === 'regEdge');

    const res = await request(app)
      .put(`/api/admin/users/${regUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No fields to update');
  });

  test('admin can toggle is_admin off and back', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminEdge', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'regEdge', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminEdge', password: 'password123' });
    const adminToken = adminRes.body.token;

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const regUser = listRes.body.find(u => u.username === 'regEdge');

    // Make admin
    const makeAdmin = await request(app)
      .put(`/api/admin/users/${regUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_admin: true });
    expect(makeAdmin.body.isAdmin).toBe(true);

    // Remove admin
    const removeAdmin = await request(app)
      .put(`/api/admin/users/${regUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_admin: false });
    expect(removeAdmin.body.isAdmin).toBe(false);
  });

  test('GET /api/admin/users does not expose password_hash', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminEdge', password: 'password123' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'regEdge', password: 'password123' });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'adminEdge', password: 'password123' });
    const adminToken = adminRes.body.token;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const user of res.body) {
      expect(user).not.toHaveProperty('password_hash');
    }
  });
});
