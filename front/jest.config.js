const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Points to the Next.js app root so jest can read next.config.ts and .env files
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",

  // Use jsdom for browser-like environment in component tests
  testEnvironment: "jsdom",

  // Run after Jest is set up but before each test file
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Module name mapping — mirrors the @/* alias from tsconfig.json
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // Coverage settings
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "app/api/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],

  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },

  // Test file patterns
  testMatch: [
    "<rootDir>/__tests__/**/*.{test,spec}.{ts,tsx}",
    "<rootDir>/__tests__/**/*.{test,spec}.ts",
  ],

  // Ignore e2e (handled by Playwright separately)
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/e2e/",
  ],
};

module.exports = createJestConfig(config);
