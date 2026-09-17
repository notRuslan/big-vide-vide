# Project Analysis Guide

Quick reference for analyzing a project when preparing a task description.

## Key Files to Read

### 1. Project Overview
| File | Why |
|------|-----|
| `AGENTS.md` | Architecture, tech stack, API, DB schema, deployment |
| `README.md` | General project info (if AGENTS.md doesn't exist) |

### 2. Backend
| File | What to Look For |
|------|-----------------|
| `apps/backend/server.js` | Express routes, middleware, error handling patterns |
| `apps/backend/db.js` | SQLite schema, query patterns, connection config |
| `apps/backend/package.json` | Dependencies, scripts |

### 3. Frontend
| File | What to Look For |
|------|-----------------|
| `apps/frontend/src/App.vue` | Vue components, composition API usage, styling patterns |
| `apps/frontend/src/main.js` | Vue app initialization, plugins |
| `apps/frontend/vite.config.js` | Dev server config, proxy settings |
| `apps/frontend/index.html` | HTML template, meta tags |
| `apps/frontend/package.json` | Dependencies, scripts |

### 4. Infrastructure
| File | What to Look For |
|------|-----------------|
| `docker-compose.yml` | Services, ports, volumes, env vars |
| `Dockerfile` | Build steps, base image, production setup |
| `.gitignore` | Excluded files (DB files, .env, etc.) |
| `package.json` (root) | Monorepo scripts, workspace config |

## Analysis Checklist

When analyzing a project for task creation:

- [ ] **Tech stack identified** — framework, language, DB, styling
- [ ] **Architecture patterns** — MVC, component-based, service layer
- [ ] **Naming conventions** — file naming, variable naming, route naming
- [ ] **Error handling** — how errors are returned, middleware patterns
- [ ] **Styling approach** — CSS classes, Tailwind, CSS modules
- [ ] **State management** — localStorage, Pinia, Vuex, etc.
- [ ] **Deployment** — Docker, hosting, build process
- [ ] **Dev workflow** — hot reload, proxy, concurrent servers

## Common Patterns in This Project

### Backend (Express + SQLite)
- Routes defined in `server.js` with `router.get/post/put/delete`
- DB queries in `db.js` using `better-sqlite3`
- Error handling with try/catch + status codes
- CORS enabled for frontend dev
- SQLite WAL mode for concurrency

### Frontend (Vue 3 + Tailwind)
- Composition API (`<script setup>`)
- Tailwind classes for styling
- Direct API calls (no Vuex/Pinia)
- localStorage for theme/auth state
- Gradient backgrounds, animations

### Docker
- Multi-stage: build frontend → serve with backend
- Single port (8080) in production
- Volume for SQLite persistence
- Node 20 base image
