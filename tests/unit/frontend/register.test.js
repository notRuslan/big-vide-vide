/**
 * @jest-environment jsdom
 *
 * Unit-тесты Register.vue — логика обработки формы регистрации.
 * Тестирует handleRegister: fetch, localStorage, router.push, error handling.
 */

/**
 * Minimal mock localStorage matching the API used in Register.vue.
 */
function createMockLocalStorage() {
  const store = {};
  return {
    getItem(key) { return store[key] || null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    getStore() { return { ...store }; },
  };
}

/**
 * Mock fetch that returns controllable responses.
 */
function createMockFetch(responseOverrides = {}) {
  const calls = [];

  const mockFetch = async (url, options) => {
    calls.push({ url, options });

    const status = responseOverrides.status || 200;
    const body = responseOverrides.body || {};

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };

  return { fetch: mockFetch, getCalls: () => calls };
}

/**
 * Minimal mock router matching the API used in Register.vue.
 */
function createMockRouter() {
  const pushCalls = [];
  return {
    push(to) { pushCalls.push(to); },
    getPushCalls() { return [...pushCalls]; },
    clearPushCalls() { pushCalls.length = 0; },
  };
}

/**
 * Копируем логику handleRegister из Register.vue для изолированного тестирования.
 */
async function simulateRegister({ username, password }, mocks) {
  const { fetch: { fetch: mockFetch }, router: mockRouter, localStorage: mockStorage } = mocks;
  const error = { value: '' };
  const loading = { value: false };

  error.value = '';
  loading.value = true;
  try {
    const res = await mockFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: password }),
    });
    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || 'Registration failed';
      return { error: error.value, success: false };
    }
    mockStorage.setItem('token', data.token);
    mockRouter.push('/');
    return { error: '', success: true };
  } catch (err) {
    error.value = 'Network error';
    return { error: 'Network error', success: false };
  } finally {
    loading.value = false;
  }
}

describe('Register Logic — Unit Tests', () => {
  let mocks;

  beforeEach(() => {
    mocks = {
      localStorage: createMockLocalStorage(),
      router: createMockRouter(),
      fetch: createMockFetch(),
    };
  });

  describe('Successful registration', () => {
    test('sets token in localStorage on success', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'jwt-token-new', user: { username: 'newuser' } },
      });

      await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      expect(mocks.localStorage.getItem('token')).toBe('jwt-token-new');
    });

    test('redirects to / on success', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'jwt-token-new', user: { username: 'newuser' } },
      });

      await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      expect(mocks.router.getPushCalls()).toEqual(['/']);
    });

    test('clears error on successful registration', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'jwt-token-new', user: { username: 'newuser' } },
      });

      const result = await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      expect(result.success).toBe(true);
      expect(result.error).toBe('');
    });

    test('trims username before sending', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'jwt-token-new', user: { username: 'newuser' } },
      });

      await simulateRegister({ username: '  newuser  ', password: 'password123' }, mocks);

      const call = mocks.fetch.getCalls()[0];
      const body = JSON.parse(call.options.body);
      expect(body.username).toBe('newuser');
    });

    test('sends POST to /api/auth/register', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'jwt-token', user: { username: 'newuser' } },
      });

      await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      const call = mocks.fetch.getCalls()[0];
      expect(call.url).toBe('/api/auth/register');
      expect(call.options.method).toBe('POST');
      expect(call.options.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Failed registration — validation errors', () => {
    test('sets error for duplicate username (409)', async () => {
      mocks.fetch = createMockFetch({
        status: 409,
        body: { error: 'Username already taken' },
      });

      const result = await simulateRegister({ username: 'taken', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Username already taken');
      expect(mocks.localStorage.getItem('token')).toBeNull();
    });

    test('sets error for short username (400)', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: { error: 'Username must be 2-30 chars, alphanumeric or underscore' },
      });

      const result = await simulateRegister({ username: 'a', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Username must be 2-30 chars, alphanumeric or underscore');
    });

    test('sets error for special characters in username (400)', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: { error: 'Username must be 2-30 chars, alphanumeric or underscore' },
      });

      const result = await simulateRegister({ username: 'user@name', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toContain('alphanumeric');
    });

    test('sets error for too-long username (400)', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: { error: 'Username must be 2-30 chars, alphanumeric or underscore' },
      });

      const result = await simulateRegister({ username: 'a'.repeat(31), password: 'password123' }, mocks);

      expect(result.success).toBe(false);
    });

    test('sets error for short password (400)', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: { error: 'Password must be at least 6 characters' },
      });

      const result = await simulateRegister({ username: 'newuser', password: 'short' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password must be at least 6 characters');
    });

    test('does not redirect on validation failure', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: { error: 'Password must be at least 6 characters' },
      });

      await simulateRegister({ username: 'newuser', password: 'short' }, mocks);

      expect(mocks.router.getPushCalls()).toEqual([]);
    });

    test('does not set token on validation failure', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: { error: 'Username is required' },
      });

      await simulateRegister({ username: '', password: 'password123' }, mocks);

      expect(mocks.localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Failed registration — server errors', () => {
    test('handles 500 server error', async () => {
      mocks.fetch = createMockFetch({
        status: 500,
        body: { error: 'Internal server error' },
      });

      const result = await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    test('uses generic "Registration failed" when server error has no message', async () => {
      mocks.fetch = createMockFetch({
        status: 500,
        body: {},
      });

      const result = await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });

  describe('Network errors', () => {
    test('catches network errors', async () => {
      const errorFetch = async () => { throw new Error('Network down'); };
      mocks.fetch = errorFetch;

      const result = await simulateRegister({ username: 'newuser', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Edge cases', () => {
    test('handles response with no error field on failure', async () => {
      mocks.fetch = createMockFetch({
        status: 400,
        body: {},
      });

      const result = await simulateRegister({ username: 'test', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });

    test('handles 201 status with token (3 JWT parts)', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoxfQ.signature', user: { username: 'new' } },
      });

      await simulateRegister({ username: 'new', password: 'password123' }, mocks);

      const token = mocks.localStorage.getItem('token');
      expect(token.split('.')).toHaveLength(3);
    });

    test('sends correct payload format', async () => {
      mocks.fetch = createMockFetch({
        status: 201,
        body: { token: 'jwt', user: { username: 'test' } },
      });

      await simulateRegister({ username: 'test', password: 'pass123' }, mocks);

      const call = mocks.fetch.getCalls()[0];
      const body = JSON.parse(call.options.body);
      expect(body).toEqual({ username: 'test', password: 'pass123' });
    });
  });
});
