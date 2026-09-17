# Testing Guide

This project uses **Jest v30** with ESM support for both unit and e2e tests.

## Running Tests

```bash
# All tests
npm run test

# Only unit tests
npm run test:unit

# Only e2e tests
npm run test:e2e

# Single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/backend/db.test.js

# Single test
npm run test -- -t "should create a todo"

# Watch mode
npm run test:watch

# With coverage
npm run test -- --coverage
```

## Test Structure

```
tests/
├── unit/
│   ├── backend/
│   │   ├── db.test.js              # Database functions
│   │   └── auth-middleware.test.js # Auth middleware
│   └── frontend/
│       └── Dashboard.test.js       # Vue component tests (requires setup)
├── e2e/
│   ├── api.test.js                 # Todo API e2e tests
│   └── auth.test.js                # Auth API e2e tests
└── helpers/
    ├── create-test-server.js       # Express app factory for e2e tests
    ├── db-test-helper.js           # DB test utilities
    └── test-setup.js               # Test environment setup
```

## Test Isolation

Each e2e test gets a fresh SQLite database (temp file) to ensure isolation. Unit tests use a single DB instance with file reset between tests.

## Adding New Tests

1. Create test file in appropriate directory (`unit/` or `e2e/`)
2. Use ESM imports (no `require`)
3. For e2e tests, import `{ createTestApp }` from helpers
4. For unit tests, import module directly and use test helpers

### Example E2E Test

```javascript
import request from 'supertest';
import { createTestApp } from '../helpers/create-test-server.js';

describe('API — New Feature', () => {
  let app;
  let token;

  beforeEach(async () => {
    app = await createTestApp();
    // Register user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test', password: 'password123' });
    token = res.body.token;
  });

  test('GET /api/new-feature returns 200', async () => {
    const res = await request(app)
      .get('/api/new-feature')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});
```

### Example Unit Test

```javascript
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import db from '../../apps/backend/db.js';

describe('DB — New Function', () => {
  beforeAll(() => db.init());
  beforeEach(() => { /* reset state */ });
  afterAll(() => db.close());

  test('should do something', () => {
    const result = db.newFunction();
    expect(result).toBeDefined();
  });
});
```

## Configuration

See `jest.config.js` for full configuration. Key settings:

- **Test Environment**: `node` (for backend), `jsdom` (for frontend)
- **Module Type**: ESM (`--experimental-vm-modules`)
- **Vue SFC Transform**: Custom transformer in `tests/transformers/`

## Coverage

```bash
npm run test -- --coverage
```

Reports are generated in `coverage/` directory.
