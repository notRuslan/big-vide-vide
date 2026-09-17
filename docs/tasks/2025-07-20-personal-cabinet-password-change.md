# Task: Личный кабинет и смена пароля

| Field | Value |
|-------|-------|
| **Status** | `planned` |
| **Created** | 2025-07-20 |
| **Priority** | `medium` |
| **Estimate** | 3–4 hours |

## Goal

> Добавить страницу «Личный кабинет» с отображением информации о пользователе и количеством его задач, а также функционал смены пароля (ввод старого пароля + новый пароль дважды).

## Context

### Current State
- **Что есть:**
  - Многопользовательская система с регистрацией/логин (username + password)
  - JWT-аутентификация через `authMiddleware`
  - Таблица `users` (id, username, password_hash, created_at) — bcrypt хеширование
  - Таблица `todos` — задачи привязаны к `user_id`
  - Фронтенд: 3 страницы — Login, Register, Dashboard
  - Dashboard показывает приветствие `Привет, {{ username }}!` и список задач
  - Навигация: router-guard для `meta.auth: true`

- **Чего нет:**
  - Страницы «Личный кабинет» (профиль пользователя)
  - API-эндпоинта для смены пароля
  - UI для смены пароля
  - Ссылки на профиль из Dashboard

### Related Files

| File | Роль |
|------|------|
| `apps/backend/server.js` | Express API — добавить endpoint смены пароля |
| `apps/backend/db.js` | SQLite — добавить функцию `changePassword` |
| `apps/frontend/src/main.js` | Vue Router — добавить маршруты |
| `apps/frontend/src/pages/Dashboard.vue` | Dashboard — добавить ссылку «Личный кабинет» |
| `apps/frontend/src/pages/Profile.vue` | **Новый** — страница личного кабинета |
| `apps/frontend/src/pages/ChangePassword.vue` | **Новый** — страница смены пароля |

## Requirements

### Functional Requirements

1. **Страница «Личный кабинет»** (`/profile`)
   - Отображает имя текущего пользователя (username)
   - Отображает количество задач пользователя (всего / активных / выполненных)
   - Кнопка «Сменить пароль» → переход на `/profile/change-password`

2. **Страница «Сменить пароль»** (`/profile/change-password`)
   - Форма с тремя полями:
     - «Старый пароль» — текущий пароль для верификации
     - «Новый пароль» — новый пароль (мин. 6 символов)
     - «Подтвердите новый пароль» — повтор нового пароля
   - Валидация: новый пароль должен совпадать с подтверждением
   - При успешной смене — сообщение об успехе + редирект на `/profile`
   - При ошибке (неверный старый пароль) — сообщение об ошибке

3. **Ссылка «Личный кабинет»** в Dashboard
   - Расположена сверху главного экрана (в хедере, рядом с приветствием)
   - Ведёт на `/profile`

4. **API — смена пароля**
   - `PUT /api/users/me/password` — верифицирует старый пароль, хеширует новый, обновляет БД
   - Требует аутентификацию (Bearer token)
   - Возвращает 200 при успехе, 401 при неверном старом пароле, 400 при ошибках валидации

### User Flow

```
Dashboard → [Клик «Личный кабинет»] → Profile (username + задачи + кнопка «Сменить пароль»)
                                                          │
                                                          ├─→ [Клик «Сменить пароль»] → ChangePassword (форма)
                                                          │                                        │
                                                          │                                        ├─→ Успех → Profile + toast «Пароль изменён»
                                                          │                                        └─→ Ошибка → показать сообщение
                                                          │
Profile → [Клик «Выйти»] → Login
```

### Edge Cases
- **Неверный старый пароль** → 401 «Неверный текущий пароль»
- **Новый пароль короче 6 символов** → 400 «Новый пароль должен быть минимум 6 символов»
- **Новый пароль не совпадает с подтверждением** → 400 «Пароли не совпадают» (frontend)
- **Попытка изменить пароль неавторизованным пользователем** → 401 «Unauthorized» (middleware)
- **Одновременная смена пароля двумя вкладками** → вторая получит 401 при следующем запросе (токен инвалидирован)

### Non-Functional Requirements
- **Безопасность:** пароль хешируется bcrypt (cost 10), новый хеш сохраняется вместо старого
- **UX:** все сообщения на русском языке, стиль согласован с текущим дизайном (gradient-bg, rounded-xl, dark mode)
- **Доступность:** формы с label, required поля, visible error states
- **Tёмная тема:** страница смены пароля поддерживает dark mode

### Constraints
- Must maintain Docker compatibility (`docker-compose.yml`, `Dockerfile`)
- Must follow existing coding patterns (ESM, sql.js, no raw SQL injection — use `escapeStr`)
- Must not break existing API contracts (todos endpoints, auth endpoints)
- Must not break existing tests (add new tests for the new feature)
- No new npm packages required (bcrypt уже есть)

## Technical Specification

### Files to Create

#### `apps/frontend/src/pages/Profile.vue`
```vue
<script setup>
// Личный кабинет:
// - Показывает username из /api/auth/me
// - Показывает количество задач (всего, активных, выполненных)
// - Кнопка «Сменить пароль» → router.push('/profile/change-password')
// - Кнопка «Назад к задачам» → router.push('/')
// - Кнопка «Выйти» → logout()
</script>

<template>
  <!-- gradient-bg + card как на Dashboard -->
  <!-- Header: «👤 Личный кабинет» + username -->
  <!-- Stats: всего задач / активных / выполненных -->
  <!-- Кнопка: «Сменить пароль» (primary blue) -->
  <!-- Кнопка: «Назад к задачам» (secondary gray) -->
</template>
```

#### `apps/frontend/src/pages/ChangePassword.vue`
```vue
<script setup>
// Смена пароля:
// - Поля: oldPassword, newPassword, confirmPassword
// - Валидация: newPassword === confirmPassword, minLength 6
// - PUT /api/users/me/password с { oldPassword, newPassword }
// - Успех → router.push('/profile') + success message
// - Ошибка → display error message
</script>

<template>
  <!-- gradient-bg + card -->
  <!-- Header: «🔑 Смена пароля» -->
  <!-- Form: old password, new password, confirm password -->
  <!-- Submit button: «Сохранить новый пароль» -->
  <!-- Link: «Назад» → /profile -->
</template>
```

### Files to Modify

#### `apps/backend/db.js`
**Change:** Добавить функцию `changePassword`

```javascript
function changePassword(userId, oldPassword, newPassword) {
  // 1. Get user by id
  const user = getUserById(userId);
  if (!user) return false;

  // 2. Verify old password
  const valid = comparePassword(oldPassword, user.password_hash);
  if (!valid) return false;

  // 3. Hash new password
  const newHash = hashPassword(newPassword);

  // 4. Update in DB
  const escapedHash = escapeStr(newHash);
  db.run(`UPDATE users SET password_hash = '${escapedHash}' WHERE id = ${userId}`);
  saveDb();
  return true;
}
```

**Export:** добавить `changePassword` в default export.

#### `apps/backend/server.js`
**Change:** Добавить endpoint смены пароля (ДО маршрута `GET /api/auth/me`)

```javascript
// PUT /api/users/me/password
app.put('/api/users/me/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Change password
    const success = db.changePassword(req.userId, oldPassword, newPassword);
    if (!success) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Важно:** этот маршрут должен быть ДО `GET /api/auth/me`, потому что `me` содержит `/me` как подстроку, и Express匹配顺序 имеет значение. (На самом деле, `PUT /api/users/me/password` и `GET /api/auth/me` — разные пути, порядок не важен. Но для безопасности можно разместить рядом.)

#### `apps/frontend/src/main.js`
**Change:** Добавить маршруты для Profile и ChangePassword

```javascript
import Profile from './pages/Profile.vue'
import ChangePassword from './pages/ChangePassword.vue'

// В routes добавить:
{ path: '/profile', component: Profile, meta: { auth: true } },
{ path: '/profile/change-password', component: ChangePassword, meta: { auth: true } },
```

#### `apps/frontend/src/pages/Dashboard.vue`
**Change:** Добавить ссылку «Личный кабинет» в хедер

В существующем хедере, рядом с `Привет, {{ username }}!`, добавить:

```vue
<router-link
  to="/profile"
  class="text-blue-500 hover:text-blue-600 font-medium text-sm transition"
>
  👤 Личный кабинет
</router-link>
```

### API Changes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/users/me/password` | PUT | Yes | Сменить пароль |

**Request/Response:**

```json
// PUT /api/users/me/password
// Headers: Authorization: Bearer <token>
{
  "oldPassword": "старый_пароль",
  "newPassword": "новый_пароль"
}

→ 200 { "ok": true }
→ 400 { "error": "Old and new passwords are required" }
→ 400 { "error": "New password must be at least 6 characters" }
→ 401 { "error": "Invalid current password" }
```

### Database Changes
- **Таблица `users`** — без изменений (колонка `password_hash` уже существует)
- **Миграция:** не требуется

### UI Changes
- **Dashboard хедер** — добавить ссылку «Личный кабинет» рядом с приветствием
- **Profile page** — карточка с:
  - Заголовок: «👤 Личный кабинет»
  - Username с аватаром/иконкой
  - Статистика: «Всего задач: X | Активных: Y | Выполненных: Z»
  - Кнопка «Сменить пароль» (синяя, primary)
  - Кнопка «Назад к задачам» (серая, secondary)
- **ChangePassword page** — форма с:
  - Заголовок: «🔑 Смена пароля»
  - Поле «Старый пароль» (type password)
  - Поле «Новый пароль» (type password, minlength 6)
  - Поле «Подтвердите новый пароль» (type password)
  - Кнопка «Сохранить новый пароль»
  - Ссылка «Назад» → /profile
  - Ошибки/успех в red/green alert boxes

### Dependencies
- **Новые пакеты:** нет (bcrypt, jsonwebtoken уже установлены)

### Testing Scenarios

Define the test scenarios that must be verified for this feature:

#### 1. Happy Path — смена пароля
- **Steps:** Зайти в Личный кабинет → нажать «Сменить пароль» → ввести старый пароль → ввести новый пароль (6+ символов) → подтвердить новый пароль → нажать «Сохранить»
- **Expected:** 200 OK, сообщение «Пароль изменён», редирект на `/profile`, при попытке войти со старым паролем — 401, со新ым — 200 OK
- **Priority:** must-have

#### 2. Неверный старый пароль
- **Steps:** Личный кабинет → Сменить пароль → ввести неправильный старый пароль → ввести новый → сохранить
- **Expected:** 401 «Invalid current password», сообщение об ошибке на UI
- **Priority:** must-have

#### 3. Новый пароль короче 6 символов
- **Steps:** Личный кабинет → Сменить пароль → ввести старый пароль → ввести новый пароль «12345» → сохранить
- **Expected:** 400 «New password must be at least 6 characters» (API), сообщение на UI
- **Priority:** must-have

#### 4. Несоответствие паролей
- **Steps:** Личный кабинет → Сменить пароль → ввести старый пароль → ввести новый «password123» → ввести подтверждение «password456» → сохранить
- **Expected:** 400 «Пароли не совпадают» (frontend валидация), запрос в API не отправляется
- **Priority:** must-have

#### 5. Личный кабинет без авторизации
- **Steps:** Выйти из аккаунта → попробовать перейти на `/profile`
- **Expected:** router-guard перенаправляет на `/login`
- **Priority:** must-have

#### 6. Личный кабинет — отображение статистики
- **Steps:** Зайти в Личный кабинет с 5 задачами (3 активных, 2 выполненных)
- **Expected:** Отображается «Всего: 5 | Активных: 3 | Выполненных: 2»
- **Priority:** must-have

#### 7. Regression — создание/удаление задач работает
- **Steps:** Перейти на Dashboard → создать задачу → переключить статус → удалить задачу
- **Expected:** Все существующие функции работают как прежде
- **Priority:** must-have

#### 8. Regression — вход/выход работает
- **Steps:** Выйти из аккаунта → войти с новым паролем
- **Expected:** Вход успешен, токен валиден, dashboard загружен
- **Priority:** must-have

## Acceptance Criteria

- [ ] API `PUT /api/users/me/password` верифицирует старый пароль и обновляет хеш
- [ ] API возвращает 401 при неверном старом пароле
- [ ] API возвращает 400 при newPassword < 6 символов
- [ ] Frontend страница `/profile` отображает username и статистику задач
- [ ] Frontend страница `/profile/change-password` содержит форму с тремя полями
- [ ] Frontend валидирует совпадение паролей и минимальную длину перед отправкой
- [ ] После успешной смены пароля — редирект на `/profile` с сообщением об успехе
- [ ] Ссылка «Личный кабинет» видна на Dashboard в хедере
- [ ] Router-guard защищает `/profile` и `/profile/change-password` (неавторизованные → `/login`)
- [ ] Тёмная тема поддерживается на всех новых страницах
- [ ] Все существующие тесты проходят
- [ ] Добавлены новые тесты для endpoint смены пароля
- [ ] Docker build и deploy работают без ошибок

## Implementation Notes

### Suggested Order
1. **Backend — db.js** → добавить `changePassword(userId, old, new)` функцию
2. **Backend — server.js** → добавить `PUT /api/users/me/password` endpoint
3. **Frontend — main.js** → добавить маршруты `/profile` и `/profile/change-password`
4. **Frontend — Profile.vue** → новая страница личного кабинета
5. **Frontend — ChangePassword.vue** → новая страница смены пароля
6. **Frontend — Dashboard.vue** → добавить ссылку «Личный кабинет»
7. **Тесты** → написать e2e-тест для нового endpoint + unit-тест для `changePassword`
8. **Docker** → проверить, что `docker compose build` и `docker compose up` работают

### Gotchas
- **Порядок маршрутов:** `PUT /api/users/me/password` и `GET /api/auth/me` — разные URL, конфликтов нет
- **sql.js vs better-sqlite3:** БД использует `sql.js` (in-memory SQLite with manual save), поэтому `escapeStr()` обязателен для всех user-supplied values в SQL
- **Token инвалидация:** после смены пароля текущий токен остаётся валидным (JWT не имеет mechanism для инвалидации). Если нужно — можно добавить `password_changed_at` timestamp в users и проверять его в middleware. Для MVP — не требуется.
- **Vue Router:** маршруты с `meta: { auth: true }` уже защищены в `main.js` — новые страницы автоматически защищены
- **Dark mode:** новые страницы должны использовать те же CSS-классы (`gradient-bg`, `dark:bg-gray-800/90` и т.д.)

### Testing Checklist
- [ ] `PUT /api/users/me/password` с валидными данными → 200
- [ ] `PUT /api/users/me/password` с неверным oldPassword → 401
- [ ] `PUT /api/users/me/password` с newPassword < 6 → 400
- [ ] `PUT /api/users/me/password` без Authorization → 401
- [ ] `PUT /api/users/me/password` без body → 400
- [ ] После смены пароля `POST /api/auth/login` со старым паролем → 401
- [ ] После смены пароля `POST /api/auth/login` с новым паролем → 200
- [ ] Frontend: `/profile` отображается только авторизованным
- [ ] Frontend: `/profile/change-password` валидирует совпадение паролей
- [ ] Frontend: после успешной смены → редирект + toast
