import { beforeEach, vi } from "vitest";

// Create a minimal window mock
const windowMock = {
  document: {
    createElement: vi.fn(() => ({
      setAttribute: vi.fn(),
      style: {},
    })),
    head: {
      appendChild: vi.fn(),
    },
    body: {
      appendChild: vi.fn(),
    },
    getElementById: vi.fn(),
  },
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  },
  location: {
    search: "formbricksDebug=true",
    protocol: "https:",
    host: "formbricks.com",
    pathname: "/",
  },
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
  // The event bus (lib/common/events.ts) dispatches on window; a plain vi.fn() keeps every suite
  // that transitively emits from crashing, and event tests assert on this mock directly.
  dispatchEvent: vi.fn(),
};

// Stub globals
vi.stubGlobal("window", windowMock);
vi.stubGlobal("document", windowMock.document);
vi.stubGlobal("localStorage", windowMock.localStorage);

// Clear mocks between tests
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
