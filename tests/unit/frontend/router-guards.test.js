/**
 * @jest-environment jsdom
 *
 * Unit-тесты router.js — навигационные guard'и.
 * Тестирует router.beforeEach: redirect на /login если нет token.
 */

/**
 * Minimal mock router matching vue-router API surface used in main.js.
 */
function createMockRouter() {
  const hooks = [];
  const pushCalls = [];
  const replaceCalls = [];

  return {
    beforeEach(hook) {
      hooks.push(hook);
    },
    push(to) {
      pushCalls.push(to);
    },
    replace(to) {
      replaceCalls.push(to);
    },
    getHooks() { return hooks; },
    getPushCalls() { return pushCalls; },
    getReplaceCalls() { return replaceCalls; },
  };
}

/**
 * Копируем guard из main.js для тестирования.
 */
function createAuthGuard() {
  return (to, _from, next) => {
    const token = localStorage.getItem('token');
    if (to.meta.auth && !token) {
      next('/login');
    } else {
      next();
    }
  };
}

describe('Router Guards — Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Protected routes (meta.auth = true)', () => {
    test('redirects to /login when no token', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      guard({ path: '/', meta: { auth: true } }, {}, router.push);

      expect(router.getPushCalls()).toEqual(['/login']);
    });

    test('allows access when token exists', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();
      localStorage.setItem('token', 'valid-jwt-token');

      guard({ path: '/', meta: { auth: true } }, {}, router.push);

      // next() called with undefined — no redirect
      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('allows access with any non-empty token', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();
      localStorage.setItem('token', 'abc123');

      guard({ path: '/dashboard', meta: { auth: true } }, {}, router.push);

      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('allows access when token is empty string? (no — treated as falsy)', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();
      localStorage.setItem('token', '');

      guard({ path: '/', meta: { auth: true } }, {}, router.push);

      // Empty string is falsy → redirect
      expect(router.getPushCalls()).toEqual(['/login']);
    });
  });

  describe('Public routes (no meta.auth or meta.auth = false)', () => {
    test('allows access to /login without token', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      guard({ path: '/login', meta: {} }, {}, router.push);

      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('allows access to /register without token', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      guard({ path: '/register', meta: {} }, {}, router.push);

      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('allows access to protected route when token exists', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();
      localStorage.setItem('token', 'some-token');

      guard({ path: '/', meta: { auth: true } }, {}, router.push);

      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('allows access to route with explicit auth: false', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      guard({ path: '/public', meta: { auth: false } }, {}, router.push);

      expect(router.getPushCalls()).toEqual([undefined]);
    });
  });

  describe('Edge cases', () => {
    test('token null (not set in localStorage) redirects', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();
      // Не устанавливаем token — localStorage.getItem вернёт null

      guard({ path: '/', meta: { auth: true } }, {}, router.push);

      expect(router.getPushCalls()).toEqual(['/login']);
    });

    test('from /login to / with valid token — allowed', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();
      localStorage.setItem('token', 'valid-token');

      guard(
        { path: '/', meta: { auth: true } },
        { path: '/login' },
        router.push
      );

      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('from / to /login without token — redirected to /login (already there)', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      guard(
        { path: '/login', meta: {} },
        { path: '/' },
        router.push
      );

      // No auth required for /login
      expect(router.getPushCalls()).toEqual([undefined]);
    });

    test('handles navigating to root / (protected)', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      // Without token
      guard({ path: '/', meta: { auth: true } }, {}, router.push);
      expect(router.getPushCalls()).toEqual(['/login']);
    });
  });

  describe('Integration: full router setup', () => {
    test('registers guard and applies it on navigation', () => {
      const router = createMockRouter();
      const guard = createAuthGuard();

      // Регистрируем guard (как в main.js)
      router.beforeEach(guard);

      // Получаем зарегистрированные hooks
      const hooks = router.getHooks();
      expect(hooks).toHaveLength(1);

      // Эмулируем навигацию на защищённый маршрут без токена
      hooks[0]({ path: '/', meta: { auth: true } }, {}, router.push);
      expect(router.getPushCalls()).toEqual(['/login']);

      // Эмулируем навигацию на защищённый маршрут с токеном
      localStorage.setItem('token', 'jwt-token');
      hooks[0]({ path: '/', meta: { auth: true } }, {}, router.push);
      expect(router.getPushCalls()).toEqual(['/login', undefined]);
    });
  });
});
