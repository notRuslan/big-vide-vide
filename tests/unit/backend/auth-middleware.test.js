// Фиксируем секрет ДО импорта auth module
process.env.JWT_SECRET = 'test-jwt-secret';

import { jest } from '@jest/globals';
import { authMiddleware, generateToken } from '../../../apps/backend/middleware/auth.js';

describe('Auth Middleware — Unit Tests', () => {
  let mockReq;
  let mockRes;
  let nextSpy;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextSpy = jest.fn();
  });

  describe('generateToken', () => {
    test('generates a JWT token for a user id', () => {
      const token = generateToken(42);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT состоит из 3 частей, разделённых точками
      expect(token.split('.')).toHaveLength(3);
    });

    test('token contains the userId in payload', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      const token = generateToken(7);

      const decoded = jwt.verify(token, 'test-jwt-secret');
      expect(decoded.userId).toBe(7);
    });

    test('different user ids produce different tokens', () => {
      const t1 = generateToken(1);
      const t2 = generateToken(2);
      expect(t1).not.toBe(t2);
    });
  });

  describe('authMiddleware', () => {
    test('rejects request without Authorization header', () => {
      authMiddleware(mockReq, mockRes, nextSpy);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authorization token required' });
      expect(nextSpy).not.toHaveBeenCalled();
    });

    test('rejects request with non-Bearer Authorization header', () => {
      mockReq.headers.authorization = 'Basic abc123';

      authMiddleware(mockReq, mockRes, nextSpy);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authorization token required' });
      expect(nextSpy).not.toHaveBeenCalled();
    });

    test('rejects request with empty Bearer token', () => {
      mockReq.headers.authorization = 'Bearer ';

      authMiddleware(mockReq, mockRes, nextSpy);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      // Either "token required" or "invalid token" — both are 401
      expect(mockRes.json).toHaveBeenCalled();
      expect(nextSpy).not.toHaveBeenCalled();
    });

    test('rejects request with invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid-token-here';

      authMiddleware(mockReq, mockRes, nextSpy);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(nextSpy).not.toHaveBeenCalled();
    });

    test('accepts valid token and calls next()', () => {
      const token = generateToken(42);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextSpy);

      expect(nextSpy).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    test('sets req.userId from decoded token', () => {
      const token = generateToken(99);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextSpy);

      expect(mockReq.userId).toBe(99);
    });

    test('rejects expired token', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      // Создаём токен с истёкшим сроком
      const expiredToken = jwt.sign({ userId: 1 }, 'test-jwt-secret', { expiresIn: '0s' });
      // Даем время истечь
      await new Promise(r => setTimeout(r, 1100));

      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      authMiddleware(mockReq, mockRes, nextSpy);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(nextSpy).not.toHaveBeenCalled();
    });
  });
});
