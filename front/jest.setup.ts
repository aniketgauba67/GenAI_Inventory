/******************************** jest.setup.ts ***************************************
 *
 *  Module: Jest Setup
 *
 *  This module configures Jest support for the frontend test suite.
 *
 *  The module provides:
 *
 *  - test environment settings for React and Next.js code.
 *  - shared setup behavior for assertions and console handling.
 *  - path aliases and test discovery rules used by CI.
 *
 *  Key Structures Used:
 *
 *  - Jest configuration objects, setup hooks, and Testing Library helpers.
 *
 *  This module ensures:
 *
 *  - unit and component tests run consistently locally and in GitHub Actions.
 *  - frontend tests share the same project aliases as production code.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 *****************************************************************************/
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
