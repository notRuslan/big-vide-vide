# User Authentication System

**Status:** planned  
**Created:** 2026-09-17  
**Goal:** Добавить систему регистрации и авторизации пользователей с индивидуальными списками задач для каждого аккаунта.

---

## Context

Сейчас приложение — единый todo-лист без привязки к пользователям. Все задачи хранятся в общей таблице `todos` и доступны любому посетителю. Нужна multi-user архитектура: каждый пользователь регистрируется, входит в систему, и видит только **свои** задачи.

### Текущий стек

| Слой | Технологии |
|------|-----------|
| Frontend | Vue 3 + Vite + Tailwind CSS (один `App.vue`, без роутера) |
| Backend | Express + `sql.js` (JS-реализация SQLite) |
| Auth | отсутствует |
| Deployment | Docker (единый образ, Express раздаёт API + статику) |

### Текущая БД (`sql.js`)

```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

---

## Requirements

### Functional

1. **Регистрация**
   - Поля: `username` (логин, уникальный), `password` (мин. 6 символов)
   - После успешной регистрации — автоматический вход (auto-login) с JWT
   - Валидация: username обязателен (2-30 символов, a-zA-Z0-9_), password ≥ 6 символов

2. **Вход (Login)**
   - Поля: `username`, `password`
   - При успехе — вернуть JWT token
   - При ошибке — 401 с понятным сообщением

3. **Выход (Logout)**
   - Фронтенд: очистить localStorage (токен)
   - Бэкенд: опционально — добавить токен в blacklist (для начала можно без этого)

4. **Индивидуальные todo-листы**
   - Все существующие API `/api/todos/*` фильтруются по `userId` из JWT
   - Пользователь видит только свои задачи
   - Нельзя создавать/изменять/удалять чужие задачи

5. **Защита routes (frontend)**
   - `/login` и `/register` — доступны всем
   - `/` (dashboard) — только авторизованным; неавторизованный перенаправляется на `/login`
   - Ссылки Login/Register скрыты на dashboard, если пользователь已进入

### Non-Functional

- **Безопасность паролей:** bcrypt (salt rounds = 10)
- **JWT:**
  - `JWT_SECRET` — env var (если не задан, генерировать случайный при старте)
  - Токен живёт 30 дней (`exp: 30d`)
  - Хранится в `localStorage` на фронтенде
  - Отправляется в headers: `Authorization: Bearer <token>`
- **Совместимость:** Docker build + run без изменений (кроме env vars)
- **Бrowsers:** все современные (Chrome, Firefox, Safari, Edge)

### Constraints

- Использовать `sql.js` (не заменять на better-sqlite3 — это слишком крупный рефакторинг)
- Сохранить текущий стиль кода (ES modules, minimal dependencies)
- Tailwind CSS — без новых CSS-файлов, всё через utility classes
- Vue Router — для навигации между страницами

---

## Technical Specification

### Files to Create

#### 1. `apps/backend/middleware/auth.js`

```js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-' + Date.now();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export { authMiddleware, generateToken };
```

#### 2. `apps/frontend/src/pages/Login.vue`

```vue
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value.trim(), password: password.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error || 'Login failed'
      return
    }
    localStorage.setItem('token', data.token)
    router.push('/')
  } catch (err) {
    error.value = 'Network error'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-white text-center mb-2">🔑 Вход</h1>
        <p class="text-gray-500 dark:text-gray-400 text-center mb-6">Войдите в свой аккаунт</p>

        <div v-if="error" class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm text-center">
          {{ error }}
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              v-model="username"
              type="text"
              placeholder="Введите логин"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Введите пароль"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              required
            />
          </div>
          <button
            type="submit"
            class="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            :disabled="loading"
          >
            {{ loading ? 'Входим...' : 'Войти' }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Нет аккаунта? <router-link to="/register" class="text-blue-500 hover:text-blue-600 font-medium">Зарегистрироваться</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
```

#### 3. `apps/frontend/src/pages/Register.vue`

Аналогичный шаблон, но с полями username + password (мин. 6 символов), POST на `/api/auth/register`, после успеха — redirect на `/`.

#### 4. `apps/frontend/src/pages/Dashboard.vue`

Переработка текущего `App.vue` под dashboard:
- Тот же UI todo-списка, но с фильтрацией по userId
- Кнопка Logout в header
- Отображение username
- Тёмная тема сохраняется

### Files to Modify

#### 1. `apps/backend/package.json`

Добавить зависимости:
```json
{
  "bcrypt": "^5.1.1",
  "jsonwebtoken": "^9.0.2"
}
```

#### 2. `apps/backend/db.js`

**Новая таблица `users`:**
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

**Модификация таблицы `todos`:**
```sql
-- Добавить user_id (если таблица уже существует, выполнить ALTER)
ALTER TABLE todos ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
```
> ⚠️ Нужно проверить: если таблица уже существует и заполнена, можно либо привязать все todos к `user_id = 1`, либо очистить таблицу. Для чистого старта — привязать к `user_id = 1`.

**Новые функции db.js:**
```js
// Users
createUser(username, passwordHash) → { id, username, createdAt }
getUserByUsername(username) → user | null
getUserById(id) → user | null

// Todos by user
getAllByUserId(userId) → todos[]
```

#### 3. `apps/backend/server.js`

**Новый middleware import:**
```js
import { authMiddleware } from './middleware/auth.js';
```

**Новые routes:**
```js
// POST /api/auth/register — регистрация
app.post('/api/auth/register', async (req, res) => {
  // validate: username (2-30 chars, alphanumeric+underscore), password (≥6)
  // hash password with bcrypt
  // insert into users
  // generate JWT
  // return { token, user: { username } }
});

// POST /api/auth/login — вход
app.post('/api/auth/login', async (req, res) => {
  // find user by username
  // compare password with bcrypt.compare
  // generate JWT
  // return { token, user: { username } }
});

// GET /api/auth/me — текущий пользователь (для проверки токена)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await db.getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username });
});
```

**Модификация существующих routes (`/api/todos/*`):**
Каждый route получить `userId` из `req.userId` (middleware `authMiddleware`) и фильтровать запросы:
- `GET /api/todos` → `SELECT * FROM todos WHERE user_id = ?`
- `POST /api/todos` → вставлять `user_id = req.userId`
- `PUT /api/todos/:id` → проверять, что `todos.user_id = req.userId`
- `DELETE /api/todos/:id` → проверять, что `todos.user_id = req.userId`
- `DELETE /api/todos/completed` → только completed задачи текущего пользователя

#### 4. `apps/frontend/package.json`

Добавить зависимость:
```json
"vue-router": "^4.3.0"
```

#### 5. `apps/frontend/src/main.js`

Подключить Vue Router:
```js
import { createApp } from 'vue'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'

import Login from './pages/Login.vue'
import Register from './pages/Register.vue'
import Dashboard from './pages/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard, meta: { auth: true } },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
  ],
})

// Navigation guard
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.auth && !token) {
    next('/login')
  } else {
    next()
  }
})

createApp(App).use(router).mount('#app')
```

#### 6. `apps/frontend/src/App.vue`

Упростить — оставить только `<router-view />` как основной контент:
```vue
<template>
  <router-view />
</template>
```

Или оставить как layout wrapper с общим градиентным фоном.

#### 7. `apps/frontend/src/pages/Dashboard.vue`

Перенести весь текущий функционал из `App.vue` (todo-список, фильтры, тёмная тема) в `Dashboard.vue`, добавив:
- Получение токена из localStorage
- `userId` из JWT (декодирование) или запрос к `/api/auth/me`
- Все API-вызовы с header `Authorization: Bearer <token>`
- Кнопка Logout (очистка localStorage, redirect на `/login`)
- Отображение текущего username в header

### API Changes

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/auth/register` | Регистрация `{ username, password }` → `{ token, user }` |
| `POST` | `/api/auth/login` | Вход `{ username, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | Текущий пользователь (auth required) → `{ username }` |
| `GET` | `/api/todos` | Все задачи текущего пользователя (auth required) |
| `POST` | `/api/todos` | Создать задачу для текущего пользователя (auth required) |
| `PUT` | `/api/todos/:id` | Обновить задачу (auth required, только свои) |
| `DELETE` | `/api/todos/:id` | Удалить задачу (auth required, только свои) |
| `DELETE` | `/api/todos/completed` | Очистить выполненные (auth required, только свои) |

### Database Changes

```sql
-- Новая таблица
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Модификация todos
ALTER TABLE todos ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
```

> Примечание: `ALTER TABLE ADD COLUMN` с `DEFAULT` работает в sql.js. Все существующие todos получат `user_id = 1`.

### UI Changes

**Страницы:**
- `Login.vue` — форма входа (username + password, ссылка на регистрацию)
- `Register.vue` — форма регистрации (username + password, ссылка на вход)
- `Dashboard.vue` — todo-лист текущего пользователя (с Logout, username в header)

**Общий layout:**
- Градиентный фон сохраняется для всех страниц
- Тёмная тема через `localStorage('darkMode')` (без изменений)
- Адаптивный дизайн

### Dependencies

| Пакет | Версия | Назначение |
|-------|--------|-----------|
| `bcrypt` | ^5.1.1 | Хеширование паролей (backend) |
| `jsonwebtoken` | ^9.0.2 | JWT tokens (backend) |
| `vue-router` | ^4.3.0 | SPA навигация (frontend) |

---

## Acceptance Criteria

1. ✅ Регистрация по username + password (мин. 6 символов) работает
2. ✅ Вход по username + password возвращает JWT token
3. ✅ Неверный пароль / несуществующий пользователь → 401
4. ✅ JWT токен хранится в localStorage на фронтенде
5. ✅ Все API-запросы к `/api/todos/*` требуют авторизацию (401 без токена)
6. ✅ Каждый пользователь видит **только свои** задачи
7. ✅ Нельзя создать/изменить/удалить чужую задачу (403/404)
8. ✅ Vue Router: `/` → Dashboard (с guard), `/login`, `/register`
9. ✅ Неавторизованный пользователь перенаправляется на `/login` при попытке зайти на `/`
10. ✅ Кнопка Logout на Dashboard очищает токен и перенаправляет на `/login`
11. ✅ Docker build и run работают (env var `JWT_SECRET` опционален)
12. ✅ Тёмная тема сохраняется после входа/выхода
13. ✅ Tailwind CSS — без дополнительных CSS-файлов

---

## Implementation Notes

### Порядок выполнения

1. **Backend — БД**
   - Добавить таблицу `users` и `user_id` в `todos` в `db.js`
   - Функции `createUser`, `getUserByUsername`, `getUserById`, `getAllByUserId`

2. **Backend — Auth**
   - Создать `middleware/auth.js` (JWT sign/verify)
   - Добавить bcrypt хеширование в `createUser`
   - Создать routes `/api/auth/register`, `/api/auth/login`, `/api/auth/me`

3. **Backend — Защита существующих routes**
   - Добавить `authMiddleware` ко всем `/api/todos/*`
   - Фильтровать запросы по `req.userId`

4. **Frontend — Router**
   - Установить `vue-router`
   - Настроить router в `main.js` с navigation guard
   - Упростить `App.vue` (только `<router-view />`)

5. **Frontend — Страницы**
   - Создать `Login.vue`, `Register.vue`
   - Перенести todo-логику из `App.vue` в `Dashboard.vue`
   - Добавить Authorization header во все fetch-запросы
   - Добавить Logout

6. **Docker**
   - Проверить, что `JWT_SECRET` не обязателен (fallback в middleware)
   - Пересобрать образ

### Gotchas

- **sql.js и ALTER TABLE:** sql.js поддерживает ALTER TABLE ADD COLUMN. Если таблица `todos` уже существует и заполнена, все старые todos получат `user_id = 1`.
- **sql.js и bcrypt:** bcrypt работает синхронно, sql.js тоже синхронный — проблем нет.
- **SQL injection:** текущий `db.js` использует string interpolation с `escapeStr`. При добавлении `user_id` в запросы использовать параметры или `escapeStr` — не забыть.
- **Frontend proxy:** Vite dev-сервер проксирует `/api` на `localhost:3000`. Это будет работать и для новых auth routes.
- **Docker production:** Express раздаёт `/api` как API, `/` как статику. Auth routes на `/api/*` — проблем не будет. SPA fallback на `/*` перенаправит `/login`, `/register` на `index.html` — Vue Router обработает client-side.

### Тестирование

- Зарегистрировать 2 разных пользователей
- Убедиться, что задачи пользователя A не видны пользователю B
- Проверить, что без токена все `/api/*` возвращают 401
- Проверить Docker build + run
