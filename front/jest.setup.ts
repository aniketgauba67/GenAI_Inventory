// jest.setup.ts — runs once before each test file

// Extend Jest's expect with @testing-library/jest-dom matchers
import "@testing-library/jest-dom";

// Silence console.error in tests unless they're meaningful failures
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    // Allow React testing library warnings through
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("inside a test was not wrapped"))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});
afterEach(() => {
  console.error = originalConsoleError;
});
