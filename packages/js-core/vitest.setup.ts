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
