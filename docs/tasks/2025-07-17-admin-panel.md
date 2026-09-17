# Admin Panel — Управление пользователями

**Status:** `planned`
**Created:** 2025-07-17
**Goal:** Реализовать административную панель для управления пользователями: просмотр списка, изменение данных, назначение/снятие прав администратора.

---

## Context

### Что есть сейчас

- **Frontend:** Vue 3 + Vue Router + Tailwind CSS. Страницы: `Login`, `Register`, `Dashboard`.
- **Backend:** Express + sql.js (SQLite). JWT-аутентификация, middleware `authMiddleware`.
- **База:** Таблицы `users (id, username, password_hash, created_at)` и `todos (id, text, completed, created_at, user_id)`.
- **Деплой:** Docker — единый образ, Express раздаёт `/api` и статику frontend.
- **Фронтенд-роуты:** `/`, `/login`, `/register`. Navigation guard — проверка наличия `token` в localStorage.

### Что нужно добавить

- Поле `is_admin` в таблице `users`
- API-эндпоинты для управления пользователями (только для администраторов)
- Middleware `adminMiddleware`
- Frontend-страницы `/admin` (список) и `/admin/:id` (карточка пользователя)
- Кнопка навигации в админ-панель на Dashboard
- `/api/auth/me` должен возвращать `isAdmin`

---

## Requirements

### Functional

1. **Первый зарегистрированный пользователь — администратор.**
   - При создании первого пользователя (когда в БД нет других) автоматически устанавливается `is_admin = 1`.
   - Если БД уже заполнена — первый существующий пользователь становится админом при первом запуске (migration).

2. **Список пользователей (`GET /admin`).**
   - Показывает всех пользователей: username, id, date joined, isAdmin badge.
   - Доступно только администраторам.

3. **Карточка пользователя (`GET /admin/:id`).**
   - Показывает details пользователя.
   - Формы для изменения:
     - **Username** — inline edit.
     - **Password** — кнопка «Сбросить пароль», генерирует новый случайный пароль, показывает его админу (без повтора).
     - **Admin status** — toggle-кнопка «Назначить/Снять администратора».

4. **Кнопка в навигации.**
   - На Dashboard (только если текущий юзер — админ) показывается кнопка «Перейти в админ-панель» рядом с кнопкой «Выйти».

### Non-Functional

- **Security:** Все admin-эндпоинты защищены `authMiddleware` + `adminMiddleware`. Без isAdmin → 403.
- **Password reset:** Новый пароль генерируется случайно (12 символов, алфавит + цифры), отображается админу один раз. Старый хеш удаляется из ответа API (never leak).
- **Docker:** Все изменения должны работать в Docker-контейнере (DB migration через `ALTER TABLE`).
- **No new dependencies:** Используем существующий стек (sql.js, bcrypt, jsonwebtoken).
- **Consistent design:** Tailwind CSS, тёмная тема, анимации — в стиле существующих страниц.

---

## Technical Spec

### 1. Database Changes

#### `apps/backend/db.js`

**Migration (initDb):** Добавить `is_admin` column с migration-проверкой:

```javascript
// Add is_admin column to users table (idempotent)
try {
  db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
} catch (e) {
  // Column already exists
}
```

**Первый юзер — админ:** В функции `createUser`:

```javascript
function createUser(username, passwordHash) {
  // ... existing code ...
  
  // If this is the first user, make them admin
  const isAdmin = (countUsers() === 0) ? 1 : 0;
  // ... INSERT with is_admin = isAdmin ...
}
```

**rowToUser** — добавить `isAdmin` в маппинг:

```javascript
function rowToUser(row) {
  return {
    id: row[0],
    username: row[1],
    password_hash: row[2],
    createdAt: row[3],
    isAdmin: !!row[4],  // NEW
  };
}
```

**Новые функции БД:**

```javascript
// List all users (admin function)
function getAllUsers() { ... }

// Update username by id
function updateUserUsername(id, newUsername) { ... }

// Update password hash by id (admin resets)
function updateUserPasswordHash(id, newHash) { ... }

// Toggle admin status
function toggleAdminStatus(id) { ... }

// Count users
function countUsers() { ... }
```

### 2. Backend API Changes

#### `apps/backend/middleware/auth.js` — добавить `adminMiddleware`

```javascript
function adminMiddleware(req, res, next) {
  // req.userId already set by authMiddleware
  const user = db.getUserById(req.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export { authMiddleware, adminMiddleware, generateToken };
```

#### `apps/backend/server.js` — новые эндпоинты

```
GET    /api/admin/users          — Список всех пользователей (admin)
PUT    /api/admin/users/:id      — Обновить username (admin)
PUT    /api/admin/users/:id/reset-password — Сбросить пароль (admin)
PUT    /api/admin/users/:id/toggle-admin    — Переключить isAdmin (admin)
```

**GET /api/admin/users:**
```json
[
  { "id": 1, "username": "admin", "createdAt": "2025-07-17 10:00:00", "isAdmin": true },
  { "id": 2, "username": "user1", "createdAt": "2025-07-17 11:00:00", "isAdmin": false }
]
```

**PUT /api/admin/users/:id:**
```json
// Request: { username: "newname" }
// Response: { id, username, isAdmin, createdAt }
```

**PUT /api/admin/users/:id/reset-password:**
```json
// Request: {} (empty body)
// Response: { id, username, isAdmin, newPassword: "xK9mP2nR7qW4" }
// Password is hashed before saving, plaintext shown to admin only
```

**PUT /api/admin/users/:id/toggle-admin:**
```json
// Request: {} (empty body)
// Response: { id, username, isAdmin: true/false, createdAt }
```

#### `GET /api/auth/me` — добавить `isAdmin`

```javascript
// Before: res.json({ username: user.username })
// After:  res.json({ username: user.username, isAdmin: user.isAdmin })
```

### 3. Frontend Changes

#### `apps/frontend/src/main.js` — новые роуты

```javascript
import AdminList from './pages/AdminList.vue'
import AdminUserCard from './pages/AdminUserCard.vue'

routes: [
  // ... existing routes
  { path: '/admin', component: AdminList, meta: { auth: true, admin: true } },
  { path: '/admin/:id', component: AdminUserCard, meta: { auth: true, admin: true } },
]
```

**Navigation guard** — добавить проверку isAdmin:

```javascript
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('TOKEN_KEY')
  if (to.meta.auth && !token) {
    next('/login')
    return
  }
  if (to.meta.admin) {
    // Check isAdmin from cached user data or fetch
    const isAdmin = window.__isAdmin__ || false
    if (!isAdmin) {
      next('/')
      return
    }
  }
  next()
})
```

#### `apps/frontend/src/pages/Dashboard.vue` — кнопка админ-панели

Добавить кнопку в header (рядом с logout):

```html
<button
  v-if="isAdmin"
  @click="router.push('/admin')"
  class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors"
>
  ⚙️ Админ-панель
</button>
```

Функция `fetchCurrentUser` обновляется — возвращает `isAdmin`.

#### `apps/frontend/src/pages/AdminList.vue` — список пользователей

```
┌─────────────────────────────────────┐
│ ⚙️ Админ-панель           [← Назад] │
├─────────────────────────────────────┤
│ Список пользователей (N)            │
│                                     │
│ ┌─ User #1 ──────────────────────┐ │
│ │ ID: 1  • admin  • 👑 Admin     │ │
│ │ Join: 2025-07-17 10:00:00      │ │
│ └────────────────────────────────┘ │
│                                     │
│ ┌─ User #2 ──────────────────────┐ │
│ │ ID: 2  • user1  • 👤 User      │ │
│ │ Join: 2025-07-17 11:00:00      │ │
│ └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- Клик на карточку → переход на `/admin/:id`
- Пустое состояние: «Нет пользователей» (невозможно в теории)

#### `apps/frontend/src/pages/AdminUserCard.vue` — карточка пользователя

```
┌──────────────────────────────────────┐
│ ← Назад   Пользователь: admin  👑   │
├──────────────────────────────────────┤
│                                      │
│ Username:                            │
│ [admin____________] [Сохранить]      │
│                                      │
│ Password:                            │
│ •••••••••••• [Сбросить пароль]       │
│                                      │
│ Admin Status:                        │
│ [👑 Администратор ▼]                 │
│   ── Назначить администратора ──     │
│   ── Снять администратора ──         │
│                                      │
└──────────────────────────────────────┘
```

- **Username edit:** inline, кнопка «Сохранить», валидация на `^[a-zA-Z0-9_]{2,30}$`
- **Password reset:** кнопка → запрос → alert с новым паролем
- **Admin toggle:** переключатель, подтверждение через confirm()

### 4. Testing Scenarios

#### S1: Первый юзер — админ
- **Steps:** Register user «admin» with password
- **Expected:** User is created with isAdmin = true, `/api/auth/me` returns `isAdmin: true`, кнопка «Админ-панель» видна на Dashboard
- **Priority:** must-have

#### S2: Второй юзер — не админ
- **Steps:** Register user «user1», login as admin, check list
- **Expected:** user1 has isAdmin = false, не может зайти на /admin (редирект на /)
- **Priority:** must-have

#### S3: Admin может видеть список
- **Steps:** Login as admin → click «Админ-панель» → /admin
- **Expected:** Список всех пользователей, админ помечен badge 👑
- **Priority:** must-have

#### S4: Non-admin не может зайти в админ-панель
- **Steps:** Login as user1 → navigate to /admin
- **Expected:** Редирект на /, 403 при прямом API запросе
- **Priority:** must-have

#### S5: Admin меняет username
- **Steps:** /admin/:id → изменить username → сохранить
- **Expected:** Username обновлён, пользователь может войти с новым username
- **Priority:** must-have

#### S6: Admin сбрасывает пароль
- **Steps:** /admin/:id → «Сбросить пароль»
- **Expected:** Новый пароль показан админу, пользователь может войти с новым паролем, старый пароль не работает
- **Priority:** must-have

#### S7: Admin назначает/снимает статус
- **Steps:** /admin/:id → toggle admin
- **Expected:** isAdmin переключён, badge обновлён на списке
- **Priority:** must-have

#### S8: Regression — todos остаются при смене admin
- **Steps:** Admin создаёт todo → делает обычного юзера админом → проверяет todos
- **Expected:** Todos не затронуты, по-прежнему привязаны к user_id
- **Priority:** must-have

#### S9: Regression — logout / login после изменений
- **Steps:** Admin меняет данные → logout → login с теми же credentials
- **Expected:** Вход успешен,isAdmin статус корректен
- **Priority:** must-have

#### S10: Docker build
- **Steps:** `docker compose build` → `docker compose up` → register → admin panel works
- **Expected:** Всё работает в контейнере, DB persists
- **Priority:** must-have

---

## Acceptance Criteria

- [ ] Первый зарегистрированный пользователь автоматически получает `isAdmin: true`
- [ ] `GET /api/admin/users` возвращает всех пользователей (только для админа, 403 иначе)
- [ ] `PUT /api/admin/users/:id` обновляет username
- [ ] `PUT /api/admin/users/:id/reset-password` генерирует и возвращает новый пароль
- [ ] `PUT /api/admin/users/:id/toggle-admin` переключает isAdmin
- [ ] `/api/auth/me` возвращает `{ username, isAdmin }`
- [ ] `adminMiddleware` блокирует не-админов (403)
- [ ] Frontend: `/admin` — список пользователей, `/admin/:id` — карточка
- [ ] Frontend: navigation guard блокирует доступ к /admin без isAdmin
- [ ] Frontend: Dashboard показывает кнопку «Админ-панель» только для админа
- [ ] Все изменения работают в Docker (DB migration через ALTER TABLE)
- [ ] Тесты: unit (db functions), e2e (admin endpoints), frontend (components)

---

## Implementation Notes

### Порядок реализации

1. **DB:** Добавить `is_admin` column (migration), обновить `rowToUser`, добавить новые функции (`getAllUsers`, `updateUserUsername`, `updateUserPasswordHash`, `toggleAdminStatus`, `countUsers`)
2. **Auth middleware:** Добавить `adminMiddleware`
3. **API:** `/api/auth/me` → вернуть `isAdmin`; новые admin-эндпоинты
4. **Frontend router:** Добавить `/admin` и `/admin/:id`, обновить guard
5. **Frontend Dashboard:** Показать кнопку, обновить `fetchCurrentUser`
6. **Frontend AdminList:** Список пользователей
7. **Frontend AdminUserCard:** Карточка с edit-формами
8. **Tests:** Unit + E2E + Frontend

### Gotchas

- **SQL injection:** sql.js не использует параметризованные запросы — все строковые значения экранируются через `escapeStr()`. Новые функции БД должны использовать тот же паттерн.
- **Migration idempotent:** `ALTER TABLE ADD COLUMN` бросает ошибку если колонка уже есть — оборачивать в try/catch.
- **Docker volume:** При пересборке образа volume `sqlite_data` сохраняет DB — migration сработает при первом запуске.
- **Token payload:** JWT содержит только `userId` — isAdmin определяется по БД, а не по токену. Это правильно для безопасности.
- **Password reset UX:** Новый пароль показывается в alert/modal — админ должен передать его пользователю.
- **Vite proxy:** При dev-разработке `/api` проксируется на `localhost:3000` — admin-эндпоинты будут работать автоматически.

### Dependencies

- Никаких новых пакетов. Используются: `sql.js`, `bcrypt`, `jsonwebtoken`, `express`, `vue-router`, `tailwindcss`.
