import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import db from '../../../apps/backend/db.js';

/**
 * Юнит-тесты для apps/backend/db.js — реальный модуль БД.
 *
 * Подход: один экземпляр db с временным файлом БД.
 * Перед каждым тестом — переустановка БД (удаляем файл, вызываем init).
 */

let testDbPath;

beforeAll(async () => {
  const testDir = join(tmpdir(), `big-vibe-db-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  testDbPath = join(testDir, 'test.db');
  process.env.DB_PATH = testDbPath;

  // Первый init
  await db.init();
});

afterAll(() => {
  if (testDbPath && existsSync(dirname(testDbPath))) {
    rmSync(dirname(testDbPath), { recursive: true, force: true });
  }
  delete process.env.DB_PATH;
});

/**
 * Переустанавливает БД перед каждым тестом.
 */
async function resetDb() {
  if (existsSync(testDbPath)) {
    rmSync(testDbPath, { force: true });
  }
  await db.init();
}

beforeEach(async () => {
  await resetDb();
});

/** Уникальное имя пользователя для каждого вызова */
let userCounter = 0;
function uniqueUsername(prefix = 'u') {
  userCounter++;
  return `${prefix}_${userCounter}`;
}

function setupWithUser() {
  const hash = db.hashPassword('pass');
  const user = db.createUser(uniqueUsername('todo'), hash);
  return user;
}

describe('DB Layer — Unit Tests (real db.js module)', () => {
  // ─── User functions ────────────────────────────────────────────

  describe('createUser', () => {
    test('creates a user and returns it with all fields', () => {
      const hash = db.hashPassword('password123');
      const user = db.createUser('testuser', hash);

      expect(user).toBeDefined();
      expect(user.id).toBe(1);
      expect(user.username).toBe('testuser');
      expect(user.password_hash).toBe(hash);
      expect(user.createdAt).toBeTruthy();
    });

    test('each user gets a unique id', () => {
      const hash1 = db.hashPassword('pass1');
      const hash2 = db.hashPassword('pass2');

      const u1 = db.createUser(uniqueUsername('u'), hash1);
      const u2 = db.createUser(uniqueUsername('u'), hash2);

      expect(u1.id).not.toBe(u2.id);
      expect(u2.id).toBe(u1.id + 1);
    });
  });

  describe('hashPassword / comparePassword', () => {
    test('hashPassword creates a bcrypt hash', () => {
      const hash = db.hashPassword('mysecret');
      expect(hash).not.toBe('mysecret');
      expect(hash.startsWith('$2')).toBe(true);
    });

    test('comparePassword returns true for correct password', () => {
      const hash = db.hashPassword('correct');
      expect(db.comparePassword('correct', hash)).toBe(true);
    });

    test('comparePassword returns false for wrong password', () => {
      const hash = db.hashPassword('correct');
      expect(db.comparePassword('wrong', hash)).toBe(false);
    });
  });

  describe('getUserByUsername', () => {
    test('returns user by username', () => {
      const hash = db.hashPassword('pass');
      const username = uniqueUsername('alice');
      db.createUser(username, hash);

      const found = db.getUserByUsername(username);
      expect(found).toBeDefined();
      expect(found.username).toBe(username);
    });

    test('returns null for non-existent user', () => {
      expect(db.getUserByUsername('nobody')).toBeNull();
    });
  });

  describe('getUserById', () => {
    test('returns user by id', () => {
      const hash = db.hashPassword('pass');
      const user = db.createUser(uniqueUsername('bob'), hash);

      const found = db.getUserById(user.id);
      expect(found).toBeDefined();
      expect(found.username).toBe(user.username);
    });

    test('returns null for non-existent id', () => {
      expect(db.getUserById(999)).toBeNull();
    });
  });

  // ─── Todo functions (user-scoped) ──────────────────────────────

  describe('createForUser', () => {
    test('creates a todo for a specific user', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Buy milk');

      expect(todo).toBeDefined();
      expect(todo.text).toBe('Buy milk');
      expect(todo.completed).toBe(false);
      expect(todo.userId).toBe(user.id);
    });

    test('todo has an auto-incremented id', () => {
      const user = setupWithUser();
      const t1 = db.createForUser(user.id, 'First');
      const t2 = db.createForUser(user.id, 'Second');

      expect(t2.id).toBe(t1.id + 1);
    });

    test('text is stored as-is (no trimming)', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, '  spaced  ');

      expect(todo.text).toBe('  spaced  ');
    });
  });

  describe('getAllByUserId', () => {
    test('returns todos for the given user', () => {
      const user = setupWithUser();
      db.createForUser(user.id, 'Task 1');
      db.createForUser(user.id, 'Task 2');

      const todos = db.getAllByUserId(user.id);

      expect(todos).toHaveLength(2);
      expect(todos.map(t => t.text)).toEqual(['Task 1', 'Task 2']);
    });

    test('does not return todos of other users', () => {
      const hash = db.hashPassword('pass');
      const user1 = db.createUser(uniqueUsername('u1'), hash);
      const user2 = db.createUser(uniqueUsername('u2'), hash);

      db.createForUser(user1.id, 'U1 task');
      db.createForUser(user2.id, 'U2 task');

      const u1Todos = db.getAllByUserId(user1.id);
      expect(u1Todos).toHaveLength(1);
      expect(u1Todos[0].text).toBe('U1 task');
    });

    test('returns empty array for user with no todos', () => {
      const user = setupWithUser();
      expect(db.getAllByUserId(user.id)).toEqual([]);
    });
  });

  describe('toggleForUser', () => {
    test('toggles completed from false to true', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Toggle me');
      expect(todo.completed).toBe(false);

      const toggled = db.toggleForUser(user.id, todo.id);
      expect(toggled.completed).toBe(true);
    });

    test('toggles completed from true to false', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Toggle back');
      db.toggleForUser(user.id, todo.id); // false → true

      const toggled = db.toggleForUser(user.id, todo.id);
      expect(toggled.completed).toBe(false);
    });

    test('returns null if todo belongs to another user', () => {
      const hash = db.hashPassword('pass');
      const u1 = db.createUser(uniqueUsername('a'), hash);
      const u2 = db.createUser(uniqueUsername('b'), hash);

      const todo = db.createForUser(u1.id, 'Other user todo');
      expect(db.toggleForUser(u2.id, todo.id)).toBeNull();
    });

    test('returns null for non-existent todo', () => {
      const user = setupWithUser();
      expect(db.toggleForUser(user.id, 9999)).toBeNull();
    });
  });

  describe('updateTextForUser', () => {
    test('updates todo text', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Original');

      const updated = db.updateTextForUser(user.id, todo.id, 'Updated');
      expect(updated.text).toBe('Updated');
    });

    test('text is updated as-is (no trimming)', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Text');
      const updated = db.updateTextForUser(user.id, todo.id, '  New text  ');

      expect(updated.text).toBe('  New text  ');
    });

    test('returns null if todo belongs to another user', () => {
      const hash = db.hashPassword('pass');
      const u1 = db.createUser(uniqueUsername('a'), hash);
      const u2 = db.createUser(uniqueUsername('b'), hash);

      const todo = db.createForUser(u1.id, 'Other');
      expect(db.updateTextForUser(u2.id, todo.id, 'Hacked')).toBeNull();
    });
  });

  describe('deleteForUser', () => {
    test('deletes a todo and returns true', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Delete me');

      const result = db.deleteForUser(user.id, todo.id);
      expect(result).toBe(true);

      const todos = db.getAllByUserId(user.id);
      expect(todos).toHaveLength(0);
    });

    test('returns false if todo belongs to another user', () => {
      const hash = db.hashPassword('pass');
      const u1 = db.createUser(uniqueUsername('a'), hash);
      const u2 = db.createUser(uniqueUsername('b'), hash);

      const todo = db.createForUser(u1.id, 'Not yours');
      expect(db.deleteForUser(u2.id, todo.id)).toBe(false);
    });

    test('returns false for non-existent todo', () => {
      const user = setupWithUser();
      expect(db.deleteForUser(user.id, 9999)).toBe(false);
    });
  });

  describe('clearCompletedForUser', () => {
    test('removes only completed todos', () => {
      const user = setupWithUser();
      const t1 = db.createForUser(user.id, 'Active');
      const t2 = db.createForUser(user.id, 'Done');
      db.toggleForUser(user.id, t2.id); // mark done

      db.clearCompletedForUser(user.id);

      const todos = db.getAllByUserId(user.id);
      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe('Active');
    });

    test('does nothing when no completed todos', () => {
      const user = setupWithUser();
      db.createForUser(user.id, 'Just active');

      db.clearCompletedForUser(user.id);

      const todos = db.getAllByUserId(user.id);
      expect(todos).toHaveLength(1);
    });
  });

  // ─── Legacy functions (backward compatibility) ─────────────────
  // Тестируем через createForUser, т.к. legacy create не вставляет user_id

  describe('legacy: getAll, toggle, deleteTodo, clearCompleted', () => {
    test('getAll returns all todos from DB', () => {
      const user = setupWithUser();
      db.createForUser(user.id, 'Task A');
      db.createForUser(user.id, 'Task B');

      const all = db.getAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    test('toggle works on existing todo', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Toggle me');

      const toggled = db.toggle(todo.id);
      expect(toggled).toBeDefined();
      expect(toggled.completed).toBe(true);
    });

    test('deleteTodo works on existing todo', () => {
      const user = setupWithUser();
      const todo = db.createForUser(user.id, 'Gone');

      expect(db.deleteTodo(todo.id)).toBe(true);
      expect(db.getOne(todo.id)).toBeNull();
    });

    test('clearCompleted removes completed todos', () => {
      const user = setupWithUser();
      const t1 = db.createForUser(user.id, 'Keep');
      const t2 = db.createForUser(user.id, 'Bye');
      db.toggle(t2.id);

      db.clearCompleted();

      const all = db.getAll();
      const kept = all.filter(t => t.completed === false);
      expect(kept.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Count helpers ─────────────────────────────────────────────

  describe('count / countCompleted', () => {
    test('count returns total todos in DB', () => {
      const user = setupWithUser();
      db.createForUser(user.id, 'A');
      db.createForUser(user.id, 'B');
      db.createForUser(user.id, 'C');

      expect(db.count()).toBe(3);
    });

    test('countCompleted returns only completed', () => {
      const user = setupWithUser();
      const t1 = db.createForUser(user.id, 'Active');
      const t2 = db.createForUser(user.id, 'Done');
      db.toggle(t2.id);

      expect(db.countCompleted()).toBe(1);
    });
  });
});
