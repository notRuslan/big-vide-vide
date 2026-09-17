/**
 * @jest-environment jsdom
 *
 * Unit-тесты Login.vue — логика обработки формы входа.
 * Тестирует handleLogin: fetch, localStorage, router.push, error handling.
 */

/**
 * Minimal mock localStorage matching the API used in Login.vue.
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
 * Minimal mock router matching the API used in Login.vue.
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
 * Копируем логику handleLogin из Login.vue для изолированного тестирования.
 */
async function simulateLogin({ username, password }, mocks) {
  const { fetch: { fetch: mockFetch }, router: mockRouter, localStorage: mockStorage } = mocks;
  const error = { value: '' };
  const loading = { value: false };

  error.value = '';
  loading.value = true;
  try {
    const res = await mockFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: password }),
    });
    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || 'Login failed';
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

describe('Login Logic — Unit Tests', () => {
  let mocks;

  beforeEach(() => {
    mocks = {
      localStorage: createMockLocalStorage(),
      router: createMockRouter(),
      fetch: createMockFetch(),
    };
  });

  describe('Successful login', () => {
    test('sets token in localStorage on success', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'jwt-token-123', user: { username: 'testuser' } },
      });

      await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      expect(mocks.localStorage.getItem('token')).toBe('jwt-token-123');
    });

    test('redirects to / on success', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'jwt-token', user: { username: 'testuser' } },
      });

      await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      expect(mocks.router.getPushCalls()).toEqual(['/']);
    });

    test('clears error on successful login', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'jwt-token', user: { username: 'testuser' } },
      });

      const result = await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      expect(result.success).toBe(true);
      expect(result.error).toBe('');
    });

    test('trims username before sending', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'jwt-token', user: { username: 'testuser' } },
      });

      await simulateLogin({ username: '  testuser  ', password: 'password123' }, mocks);

      const call = mocks.fetch.getCalls()[0];
      const body = JSON.parse(call.options.body);
      expect(body.username).toBe('testuser');
    });

    test('sends POST to /api/auth/login', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'jwt-token', user: { username: 'testuser' } },
      });

      await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      const call = mocks.fetch.getCalls()[0];
      expect(call.url).toBe('/api/auth/login');
      expect(call.options.method).toBe('POST');
      expect(call.options.headers['Content-Type']).toBe('application/json');
    });

    test('mock fetch records calls', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'jwt', user: { username: 't' } },
      });

      await simulateLogin({ username: 't', password: 'password' }, mocks);
      expect(mocks.fetch.getCalls()).toHaveLength(1);
    });
  });

  describe('Failed login — invalid credentials', () => {
    test('sets error for wrong password', async () => {
      mocks.fetch = createMockFetch({
        status: 401,
        body: { error: 'Invalid username or password' },
      });

      const result = await simulateLogin({ username: 'testuser', password: 'wrongpass' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid username or password');
      expect(mocks.localStorage.getItem('token')).toBeNull();
    });

    test('sets error for non-existent user', async () => {
      mocks.fetch = createMockFetch({
        status: 401,
        body: { error: 'Invalid username or password' },
      });

      const result = await simulateLogin({ username: 'nobody', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid username or password');
    });

    test('does not redirect on failure', async () => {
      mocks.fetch = createMockFetch({
        status: 401,
        body: { error: 'Invalid username or password' },
      });

      await simulateLogin({ username: 'testuser', password: 'wrongpass' }, mocks);

      expect(mocks.router.getPushCalls()).toEqual([]);
    });

    test('does not set token on failure', async () => {
      mocks.fetch = createMockFetch({
        status: 401,
        body: { error: 'Invalid username or password' },
      });

      await simulateLogin({ username: 'testuser', password: 'wrongpass' }, mocks);

      expect(mocks.localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Failed login — server errors', () => {
    test('handles 500 server error', async () => {
      mocks.fetch = createMockFetch({
        status: 500,
        body: { error: 'Internal server error' },
      });

      const result = await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    test('uses generic "Login failed" when server error has no message', async () => {
      mocks.fetch = createMockFetch({
        status: 500,
        body: {},
      });

      const result = await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed');
    });
  });

  describe('Network errors', () => {
    test('catches network errors', async () => {
      const errorFetch = async () => { throw new Error('Network down'); };
      mocks.fetch = errorFetch;

      const result = await simulateLogin({ username: 'testuser', password: 'password123' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Edge cases', () => {
    test('handles response with no error field on failure', async () => {
      mocks.fetch = createMockFetch({
        status: 401,
        body: {},
      });

      const result = await simulateLogin({ username: 'test', password: 'pass' }, mocks);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed');
    });

    test('handles token that is a JWT string (3 parts)', async () => {
      mocks.fetch = createMockFetch({
        status: 200,
        body: { token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoxfQ.signature', user: { username: 'test' } },
      });

      await simulateLogin({ username: 'test', password: 'password123' }, mocks);

      const token = mocks.localStorage.getItem('token');
      expect(token.split('.')).toHaveLength(3);
    });
  });
});
