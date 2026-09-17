import SQL from 'sql.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

/**
 * Создаёт изолированную in-memory базу данных для тестов.
 * Все тесты получают свой экземпляр — никаких побочных эффектов.
 */
export async function createTestDb() {
  const SQLModule = await SQL();
  const db = new SQLModule.Database();

  // Создаём таблицы (дублируем логику из db.js)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1
    )
  `);

  return db;
}

/**
 * Создаёт временный файл БД для e2e-тестов, где нужно сохранять данные.
 */
export function createTempDbPath() {
  const tmpPath = join(tmpdir(), `big-vibe-test-${Date.now()}`);
  mkdirSync(tmpPath, { recursive: true });
  return join(tmpPath, 'test.db');
}

/**
 * Удаляет временную БД и директорию.
 */
export function cleanupTempDb(dbPath) {
  try {
    const { dirname } = require('path');
    const { rmSync, existsSync } = require('fs');
    const dir = dirname(dbPath);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}
