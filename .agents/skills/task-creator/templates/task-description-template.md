# Task: <TASK_TITLE>

| Field | Value |
|-------|-------|
| **Status** | `planned` |
| **Created** | YYYY-MM-DD |
| **Priority** | `high` / `medium` / `low` |
| **Estimate** | X hours / Y story points |

## Goal

> One-sentence summary of what this task accomplishes.

**Example:** "Add user authentication with JWT tokens to enable personalized todo lists per user."

## Context

### Current State
- **What exists:** [brief description of current architecture/features relevant to this task]
- **What needs to change:** [high-level description of the change]

### Related Files
| File | Role |
|------|------|
| `apps/backend/server.js` | Express API routes |
| `apps/backend/db.js` | SQLite schema & queries |
| `apps/frontend/src/App.vue` | Main Vue component |
| `docker-compose.yml` | Docker configuration |

## Requirements

### Functional Requirements
1. [Requirement 1 — what the feature does]
2. [Requirement 2]
3. [Requirement 3]

**User Flow:**
```
User Action → System Response → Result
     ↓              ↓              ↓
  [describe]   [describe]   [describe]
```

**Edge Cases:**
- [Case 1]
- [Case 2]

### Non-Functional Requirements
- [Performance / Security / Compatibility / Accessibility notes]

### Constraints
- Must maintain Docker compatibility
- Must follow existing coding patterns from project
- Must not break existing API contracts

## Technical Specification

### Files to Create

#### `apps/backend/middleware/auth.js`
```javascript
// JWT authentication middleware
// - Verify token from Authorization header
// - Attach user.id to request
// - Reject invalid/expired tokens
```

#### `apps/frontend/src/services/auth.js`
```javascript
// Auth service
// - login/logout/register API calls
// - localStorage token management
// - Protected route helpers
```

### Files to Modify

#### `apps/backend/db.js`
**Change:** Add `users` table
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `apps/backend/server.js`
**Change:** Add auth routes
- `POST /api/auth/register` — create user
- `POST /api/auth/login` — return JWT
- `GET /api/auth/me` — return current user
- Middleware: `authMiddleware` for protected routes

#### `apps/frontend/src/App.vue`
**Change:** Add auth UI
- Login/Register modals or pages
- User avatar/greeting when authenticated
- Protected todo list (per-user data)

### API Changes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | No | Register new user |
| `/api/auth/login` | POST | No | Login, get JWT |
| `/api/auth/me` | GET | Yes | Current user info |
| `/api/todos` | GET | Yes | User's todos (filtered by user.id) |

**Request/Response Examples:**

```json
// POST /api/auth/register
{ "email": "user@example.com", "password": "secret123" }
→ 201 { "id": 1, "email": "user@example.com", "token": "eyJ..." }
```

```json
// GET /api/todos (with Authorization: Bearer <token>)
→ 200 [ { "id": 1, "text": "...", "completed": false, "user_id": 1 } ]
```

### Database Changes

| Table | Operation | Details |
|-------|-----------|---------|
| `users` | CREATE | email, password_hash, created_at |
| `todos` | ALTER | Add `user_id` column (FK → users) |

### UI Changes
- **Login page** — email + password fields, submit button
- **Register page** — email + password + confirm password
- **Header** — user greeting + logout button (when authenticated)
- **Todo list** — same layout, data scoped to current user

## Acceptance Criteria

- [ ] User can register with email + password
- [ ] User can login and receive JWT token
- [ ] Token is stored in localStorage
- [ ] Protected endpoints reject requests without valid token
- [ ] Expired tokens return 401 with clear error message
- [ ] Todo list shows only the current user's todos
- [ ] Logout clears token and redirects to login
- [ ] Docker build/deploy still works
- [ ] No existing functionality is broken

## Implementation Notes

### Suggested Order
1. **Backend first** — DB schema → auth middleware → auth routes
2. **Frontend services** — auth.js service → API calls
3. **Frontend UI** — login/register pages → protected layout
4. **Integration** — connect auth to todo list
5. **Docker** — test full stack in Docker

### Gotchas
- Use `bcrypt` for password hashing (add to backend deps)
- JWT secret from env var `JWT_SECRET` (set in docker-compose)
- SQLite WAL mode for concurrent access
- Frontend proxy in `vite.config.js` already routes `/api` to backend

### Testing Checklist
- [ ] Register with valid email → 201
- [ ] Register with duplicate email → 409
- [ ] Login with wrong password → 401
- [ ] Access protected endpoint without token → 401
- [ ] Access protected endpoint with expired token → 401
- [ ] Todos scoped correctly per user
