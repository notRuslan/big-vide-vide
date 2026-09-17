import SQL from 'sql.js';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'todos.db');

// Позволяем переопределить DB_PATH через process.env.DB_PATH (для тестов)
function getDBPath() {
  return process.env.DB_PATH || DB_PATH;
}

let db;

async function initDb() {
  const SQLModule = await SQL();

  const dbPath = getDBPath();
  // Ensure data directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQLModule.Database(buffer);
  } else {
    db = new SQLModule.Database();
  }

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // Add is_admin column for existing databases (migration)
  try {
    db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    // Column already exists — ignore
  }

  // Create todos table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Add user_id column if it doesn't exist yet (for existing DBs without it)
  try {
    db.run('ALTER TABLE todos ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1');
  } catch (e) {
    // Column already exists — ignore
  }

  return db;
}

function saveDb() {
  const dbPath = getDBPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

function escapeStr(s) {
  return String(s).replace(/'/g, "''");
}

function rowToTodo(row) {
  return {
    id: row[0],
    text: row[1],
    completed: !!row[2],
    createdAt: row[3],
    userId: row[4],
  };
}

function getOne(id) {
  const result = db.exec(`SELECT * FROM todos WHERE id = ${id}`);
  if (!result || !result[0] || !result[0].values) return null;
  const rows = result[0].values;
  return rows.length > 0 ? rowToTodo(rows[0]) : null;
}

function getLastId() {
  const result = db.exec('SELECT MAX(id) as max_id FROM todos');
  const rows = result[0]?.values ?? [];
  return rows.length > 0 ? rows[0][0] : null;
}

// ─── User functions ────────────────────────────────────────────

function createUser(username, passwordHash) {
  const escapedUsername = escapeStr(username);
  const escapedHash = escapeStr(passwordHash);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // First user becomes admin
  const userCount = getUserCount();
  const isAdmin = userCount === 0 ? 1 : 0;

  db.run(`INSERT INTO users (username, password_hash, is_admin, created_at) VALUES ('${escapedUsername}', '${escapedHash}', ${isAdmin}, '${now}')`);
  saveDb();
  return getUserByUsername(username);
}

function getUserCount() {
  const result = db.exec('SELECT COUNT(*) as total FROM users');
  if (!result || !result[0] || !result[0].values) return 0;
  return result[0].values[0][0] ?? 0;
}

function getAllUsers() {
  const result = db.exec('SELECT * FROM users ORDER BY created_at ASC');
  if (!result || !result[0] || !result[0].values) {
    saveDb();
    return [];
  }
  const rows = result[0].values;
  saveDb();
  return rows.map(rowToUser);
}

function updateUser(id, fields) {
  const parts = [];
  const values = [];
  if (fields.username !== undefined) {
    parts.push(`username = '${escapeStr(fields.username)}'`);
  }
  if (fields.password_hash !== undefined) {
    parts.push(`password_hash = '${escapeStr(fields.password_hash)}'`);
  }
  if (fields.is_admin !== undefined) {
    parts.push(`is_admin = ${fields.is_admin ? 1 : 0}`);
  }
  if (parts.length === 0) return null;

  db.run(`UPDATE users SET ${parts.join(', ')} WHERE id = ${id}`);
  saveDb();
  return getUserById(id);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function getUserByUsername(username) {
  const escaped = escapeStr(username);
  const result = db.exec(`SELECT * FROM users WHERE username = '${escaped}'`);
  if (!result || !result[0] || !result[0].values) return null;
  const rows = result[0].values;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

function getUserById(id) {
  const result = db.exec(`SELECT * FROM users WHERE id = ${id}`);
  if (!result || !result[0] || !result[0].values) return null;
  const rows = result[0].values;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

function rowToUser(row) {
  return {
    id: row[0],
    username: row[1],
    password_hash: row[2],
    isAdmin: !!row[3],
    createdAt: row[4],
  };
}

// ─── Todo functions ────────────────────────────────────────────

function getAllByUserId(userId) {
  const result = db.exec(`SELECT * FROM todos WHERE user_id = ${userId} ORDER BY created_at ASC`);
  if (!result || !result[0] || !result[0].values) {
    saveDb();
    return [];
  }
  const rows = result[0].values;
  saveDb();
  return rows.map(rowToTodo);
}

function createForUser(userId, text) {
  const escaped = escapeStr(text);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.run(`INSERT INTO todos (text, completed, created_at, user_id) VALUES ('${escaped}', 0, '${now}', ${userId})`);
  saveDb();
  const id = getLastId();
  // getOne уже вызывает rowToTodo и возвращает готовый объект
  return getOne(id);
}

function toggleForUser(userId, id) {
  const todo = getOne(id);
  if (!todo || todo.userId !== userId) return null;
  const newCompleted = todo.completed ? 0 : 1;
  db.run(`UPDATE todos SET completed = ${newCompleted} WHERE id = ${id} AND user_id = ${userId}`);
  saveDb();
  return getOne(id);
}

function updateTextForUser(userId, id, text) {
  const escaped = escapeStr(text);
  db.run(`UPDATE todos SET text = '${escaped}' WHERE id = ${id} AND user_id = ${userId}`);
  if (db.getRowsModified() === 0) return null;
  saveDb();
  return getOne(id);
}

function deleteForUser(userId, id) {
  db.run(`DELETE FROM todos WHERE id = ${id} AND user_id = ${userId}`);
  const changed = db.getRowsModified() > 0;
  if (changed) saveDb();
  return changed;
}

function clearCompletedForUser(userId) {
  db.run('DELETE FROM todos WHERE completed = 1 AND user_id = ' + userId);
  saveDb();
}

// ─── Legacy unfiltered functions (kept for compatibility) ─────

function getAll() {
  const result = db.exec('SELECT * FROM todos ORDER BY created_at ASC');
  if (!result || !result[0] || !result[0].values) {
    saveDb();
    return [];
  }
  const rows = result[0].values;
  saveDb();
  return rows.map(rowToTodo);
}

function create(text) {
  const escaped = escapeStr(text);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.run(`INSERT INTO todos (text, completed, created_at) VALUES ('${escaped}', 0, '${now}')`);
  saveDb();
  const id = getLastId();
  const row = getOne(id);
  return rowToTodo(row);
}

function toggle(id) {
  const todo = getOne(id);
  if (!todo) return null;
  const newCompleted = todo.completed ? 0 : 1;
  db.run(`UPDATE todos SET completed = ${newCompleted} WHERE id = ${id}`);
  saveDb();
  return getOne(id);
}

function updateText(id, text) {
  const escaped = escapeStr(text);
  db.run(`UPDATE todos SET text = '${escaped}' WHERE id = ${id}`);
  if (db.getRowsModified() === 0) return null;
  saveDb();
  return getOne(id);
}

function deleteTodo(id) {
  db.run(`DELETE FROM todos WHERE id = ${id}`);
  const changed = db.getRowsModified() > 0;
  if (changed) saveDb();
  return changed;
}

function clearCompleted() {
  db.run('DELETE FROM todos WHERE completed = 1');
  saveDb();
}

export default {
  init: initDb,
  save: saveDb,

  // Legacy
  getAll,
  getOne,
  create,
  toggle,
  updateText,
  deleteTodo,
  clearCompleted,
  count() {
    const result = db.exec('SELECT COUNT(*) as total FROM todos');
    if (!result || !result[0] || !result[0].values) return 0;
    return result[0].values[0][0] ?? 0;
  },
  countCompleted() {
    const result = db.exec('SELECT COUNT(*) as total FROM todos WHERE completed = 1');
    if (!result || !result[0] || !result[0].values) return 0;
    return result[0].values[0][0] ?? 0;
  },

  // Auth
  hashPassword,
  comparePassword,
  createUser,
  getUserByUsername,
  getUserById,
  getUserCount,
  getAllUsers,
  updateUser,

  // User-scoped todos
  getAllByUserId,
  createForUser,
  toggleForUser,
  updateTextForUser,
  deleteForUser,
  clearCompletedForUser,
};
