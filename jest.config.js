/** @type {import('jest').Config} */
export default {
  // --- Е2Е тесты: node (Express API) ---
  // --- Юнит-тесты frontend: jsdom (Vue-компоненты) ---
  // Переопределяется в файлах тестов через /** @jest-environment jsdom */

  testEnvironment: 'node',

  // ESM: Node.js 24+ стабилизирует VM Modules — Jest v30 поддерживает ESM нативно
  // Запускаем через: node --experimental-vm-modules ./node_modules/jest/bin/jest.js

  // Трансформеры
  transform: {
    '^.+\\.vue$': '<rootDir>/tests/transformers/vue-transform.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@vue|vue-router|vue|@pinia)/)',
  ],

  // Map @/ to frontend src
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/frontend/src/$1',
    '\\.vue$': '<rootDir>/tests/transformers/vue-transform.js',
  },

  // Ищем модули также в node_modules каждого приложения
  moduleDirectories: ['node_modules', 'apps/frontend/node_modules', 'apps/backend/node_modules'],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.vue',
  ],

  // Test directories
  roots: ['<rootDir>/tests'],

  // Cleanup between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Timeout per test (e2e tests need more time)
  testTimeout: 15000,

  // Coverage (optional, can be enabled with --coverage)
  collectCoverageFrom: [
    'apps/backend/**/*.js',
    'apps/frontend/src/**/*.vue',
    '!**/node_modules/**',
    '!tests/**',
  ],

  coverageDirectory: 'coverage',
};
