# Verification Reference

Quick reference for verifying task acceptance criteria locally.

## API Testing (curl)

```bash
# GET all todos
curl -s http://localhost:3000/api/todos

# POST create todo
curl -s -X POST http://localhost:3000/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"text":"test task"}'

# PUT update todo
curl -s -X PUT http://localhost:3000/api/todos/1 \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'

# DELETE todo
curl -s -X DELETE http://localhost:3000/api/todos/1

# DELETE all completed
curl -s -X DELETE http://localhost:3000/api/todos/completed
```

## Frontend Build Check

```bash
cd apps/frontend && npm run build
# Check for errors in output
```

## Backend Startup Check

```bash
cd apps/backend && node -e "require('./db.js'); console.log('DB OK')"
```

## Docker Build Check

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

## Smoke Test Sequence

```bash
# 1. Start backend
cd apps/backend && npm run dev &

# 2. Start frontend
cd apps/frontend && npm run dev -- --port 3001 &

# 3. Quick API test
curl -s http://localhost:3000/api/todos

# 4. Check frontend build
cd apps/frontend && npm run build
```

## Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Port already in use | Another dev server running; kill or change port |
| DB schema error | Migration missed; check `db.js` CREATE TABLE |
| CORS error in dev | CORS not configured; check `server.js` cors options |
| Build fails | Syntax error in Vue component; check `<script setup>` |
| 404 on API | Route not registered; check `server.js` router.use |
| Docker build fails | Missing COPY step or wrong path |
