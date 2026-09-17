# Big Vibe Todo List

## Описание

SPA-приложение **Todo List** — менеджер задач с красивым градиентным дизайном.
Стек: **Vue 3** + **Vite** + **Tailwind CSS** (frontend) и **Express** + **SQLite** (backend).

Задачи хранятся в таблице `todos` базы SQLite, тёмная тема запоминается в `localStorage`.

## Структура проекта

```
├── apps/
│   ├── frontend/        # Vue 3 SPA (Vite dev-сервер на порту 3001)
│   │   ├── src/
│   │   │   ├── main.js
│   │   │   └── App.vue
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   └── package.json
│   └── backend/         # Express API + SQLite
│       ├── server.js    # Express-сервер (порт 3000)
│       ├── db.js        # SQLite (better-sqlite3), таблица todos
│       └── package.json
├── data/                # 🚫 Не коммитится (SQLite-файлы + WAL)
├── Dockerfile           # Единый образ: frontend build → backend serve
├── docker-compose.yml   # 8080:3000 + volume sqlite_data для БД
├── package.json         # Корневой (scripts для dev/build/install)
├── .gitignore           # node_modules, dist, data/, *.db
└── AGENTS.md
```

## Backend API

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/todos` | Все задачи |
| `POST` | `/api/todos` | Создать задачу (`{ text }`) |
| `PUT` | `/api/todos/:id` | Переключить/обновить (`{ completed }` или `{ text }`) |
| `DELETE` | `/api/todos/:id` | Удалить одну задачу |
| `DELETE` | `/api/todos/completed` | Очистить выполненные |

В продакшене (Docker) Express раздаёт и API (`/api/*`), и статические файлы frontend (`/`).

## База данных

- **SQLite** через `better-sqlite3`
- Таблица: `todos (id, text, completed, created_at)`
- Файл БД: `data/todos.db`
- **Локально**: БД создаётся при первом запуске бэкенда, не коммитится в git
- **Дocker**: volume `sqlite_data` привязан к `/app/data` — данные сохраняются между перезапусками

## Запуск

### Локально (только JS, без Docker)

```bash
cd I:/projects/test/pi-dev/big-vibe-vide

# 1. Установить зависимости для обоих приложений
npm run install:all

# 2. Запустить бэкенд (порт 3000) и фронтенд (порт 3001) параллельно
npm run dev:full
# или по отдельности:
# cd apps/backend && npm run dev    → API на :3000
# cd apps/frontend && npm run dev  → UI на :3001 (проксирует /api на :3000)

# Открыть http://localhost:3001
```

### Docker (единый образ)

```bash
cd I:/projects/test/pi-dev/big-vibe-vide

# Пересобрать и запустить
docker compose down
docker compose build
docker compose up -d

# Быстрый перезапуск (если код не менялся)
docker compose restart

# Логи
docker compose logs -f
```

Docker-образ:
- Собирает frontend (`npm run build`)
- Запускает backend (`npm start`) — Express раздаёт `/api` как API, `/` как статику frontend
- Volume `sqlite_data` → `/app/data` для persistance БД

Сейчас запущен через Docker: `http://localhost:8080`

## Функционал

- ➕ Добавление задач (кнопка или Enter)
- ✅ Переключение статуса (выполнена / не выполнена)
- 🗑️ Удаление задач
- 🔍 Фильтры: Все / Активные / Выполненные
- 🧹 Очистка всех выполненных задач
- 🌙 Тёмная тема (переключатель, localStorage)
- 💾 Автосохранение в SQLite (через API)
- ✨ Анимации (градиентный фон, появление элементов)

## Обновление

```bash
cd I:/projects/test/pi-dev/big-vibe-vide

# Локальный dev
npm run install:all
npm run dev:full

# Docker (пересобрать образ)
docker compose down
docker compose build
docker compose up -d
```

## Тестирование

Смотри [docs/testing.md](docs/testing.md) для полного руководства.

```bash
# Все тесты
npm run test

# Только unit тесты
npm run test:unit

# Только e2e тесты
npm run test:e2e

# Watch mode
npm run test:watch

# С покрытием
npm run test -- --coverage
```

## Правила безопасности

### ⛔ ЗАПРЕЩЕНО убивать все node-процессы

Никогда не выполняй команды, которые убивают **все** node-процессы на системе (например, `killall node`, `taskkill /im node.exe`, `pkill node`, или `docker compose down` без крайней необходимости).

### ✅ Как правильно управлять процессами

1. **Убивай только те процессы, которые явно нужны для задачи** — например, если нужно перезапустить бэкенд, убей только его PID, а не все node-процессы.
2. **Если не уверен, какой процесс убить** — спроси пользователя, прежде чем убивать.
3. **Предпочитай перезапуск через Docker** (`docker compose restart`) вместо остановки контейнера (`docker compose down`), если возможно.
4. **При `docker compose down`** — предупреждай пользователя, что это остановит контейнер, и получай подтверждение.

### Примеры

❌ **Плохо:**
```bash
killall node          # Убил ВСЕ node-процессы
pkill -f "npm run"    # Убил все npm-процессы
docker compose down   # Остановил контейнер без предупреждения
```

✅ **Хорошо:**
```bash
# Перезапуск конкретного контейнера
docker compose restart web

# Убить только бэкенд (если знаем PID)
kill <backend-pid>

# Спросить перед деструктивными действиями
"Хочу выполнить docker compose down, чтобы пересобрать образ. Продолжить?"
```
