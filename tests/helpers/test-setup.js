/**
 * Общий helper для e2e-тестов: регистрирует пользователя и возвращает токен.
 */
import request from 'supertest';

const JWT_SECRET = 'test-secret-for-jest';

/**
 * Регистрирует тестового пользователя и возвращает { token, username }.
 */
export async function registerAndGetToken(app, username = 'testuser', password = 'password123') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password });

  if (!res.ok) {
    throw new Error(`Registration failed: ${res.body.error || res.status}`);
  }

  return {
    token: res.body.token,
    username: res.body.user.username,
  };
}

/**
 * Логинит тестового пользователя и возвращает { token, username }.
 */
export async function loginAndGetToken(app, username = 'testuser', password = 'password123') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.body.error || res.status}`);
  }

  return {
    token: res.body.token,
    username: res.body.user.username,
  };
}

/**
 * Создаёт авторизованный агент supertest с токеном.
 */
export function authAgent(token) {
  return request.agent
    ? request.agent().set('Authorization', `Bearer ${token}`)
    : ((method) => {
        const agent = request.agent();
        agent.set('Authorization', `Bearer ${token}`);
        return agent;
      });
}

/**
 * Создаёт базовый Express-приложение для тестов с реальными маршрутами.
 * Использует временную БД и фиксированный JWT-секрет.
 */
export async function createTestApp() {
  // Устанавливаем переменные окружения для тестов
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.DB_PATH = require('path').join(
    require('os').tmpdir(),
    `big-vibe-test-db-${Date.now()}`,
    'test.db'
  );

  // Удаляем старую БД если есть
  const { mkdirSync, existsSync, rmSync, dirname } = require('fs');
  const { dirname: pathDirname } = require('path');
  const dbDir = dirname(process.env.DB_PATH);
  if (existsSync(dbDir)) {
    rmSync(dbDir, { recursive: true, force: true });
  }
  mkdirSync(dbDir, { recursive: true });

  // Импортируем сервер (он вызовет db.init() в start())
  // Мы не вызываем start() — нам нужна только app (express instance)
  // Поэтому импортируем server.js и используем app напрямую
  const { createTestServer } = await import('./create-test-server.js');
  return createTestServer();
}

/**
 * Очистка после всех тестов.
 */
export function cleanupTestEnvironment() {
  const { dirname } = require('path');
  const { rmSync, existsSync } = require('fs');
  if (process.env.DB_PATH) {
    const dir = dirname(process.env.DB_PATH);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
