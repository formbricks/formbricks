import { afterEach, beforeEach, vi } from "vitest";

/**
 * Standard test environment setup with consistent cleanup patterns.
 * Call this function once at the top of your test file to ensure
 * mocks are properly cleaned up between tests.
 *
 * @example
 * ```typescript
 * import { setupTestEnvironment } from "@/lib/testing/setup";
 *
 * setupTestEnvironment();
 *
 * describe("MyModule", () => {
 *   test("should work correctly", () => {
 *     // Your test code here
 *   });
 * });
 * ```
 *
 * Note: This replaces manual beforeEach/afterEach blocks in individual test files.
 */
export function setupTestEnvironment() {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
}
