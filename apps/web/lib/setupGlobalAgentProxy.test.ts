import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { env } from "./env";
// Note: We don't mock global-agent because the code uses dynamic require("global" + "-agent")
// which can't be easily mocked. The real module will run in tests, which is acceptable.

// Import after mocks are set up
import { setupGlobalAgentProxy } from "./setupGlobalAgentProxy";

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env
vi.mock("./env", () => ({
  env: {
    USE_GLOBAL_AGENT_PROXY: undefined,
    GLOBAL_AGENT_NO_PROXY: undefined,
    NO_PROXY: undefined,
  },
}));

describe("setupGlobalAgentProxy", () => {
  const originalWindow = globalThis.window;
  const originalProcess = globalThis.process;
  const originalGlobalAgentInitialized = globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global state
    delete (globalThis as any).window;
    delete (globalThis as any).__FORMBRICKS_GLOBAL_AGENT_INITIALIZED;
    // Reset process to valid Node.js
    globalThis.process = {
      release: { name: "node" },
      versions: { node: "20.0.0" },
      env: {},
    } as any;
    // Reset env mocks
    vi.mocked(env).USE_GLOBAL_AGENT_PROXY = undefined;
    vi.mocked(env).GLOBAL_AGENT_NO_PROXY = undefined;
    vi.mocked(env).NO_PROXY = undefined;
  });

  afterEach(() => {
    // Restore original values
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
    if (originalProcess !== undefined) {
      globalThis.process = originalProcess;
    }
    if (originalGlobalAgentInitialized !== undefined) {
      globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED = originalGlobalAgentInitialized;
    } else {
      delete (globalThis as any).__FORMBRICKS_GLOBAL_AGENT_INITIALIZED;
    }
  });

  describe("browser environment", () => {
    test("should return early if window is defined", () => {
      globalThis.window = {} as any;

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("non-Node environment", () => {
    test("should return early if process is undefined", () => {
      delete (globalThis as any).process;

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });

    test("should return early if process.release.name is not 'node'", () => {
      globalThis.process = {
        release: { name: "deno" },
        versions: { node: "20.0.0" },
        env: {},
      } as any;

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });

    test("should return early if process.versions.node is undefined", () => {
      globalThis.process = {
        release: { name: "node" },
        versions: {},
        env: {},
      } as any;

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("idempotent initialization", () => {
    test("should return early if already initialized", () => {
      globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED = true;
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "1";

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("opt-in flag", () => {
    test("should return early if USE_GLOBAL_AGENT_PROXY is not '1'", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "0";

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });

    test("should return early if USE_GLOBAL_AGENT_PROXY is undefined", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = undefined;

      setupGlobalAgentProxy();

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("NO_PROXY resolution", () => {
    test("should use GLOBAL_AGENT_NO_PROXY when set", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "1";
      vi.mocked(env).GLOBAL_AGENT_NO_PROXY = "keycloak.local,adfs.local";

      setupGlobalAgentProxy();

      expect(process.env.GLOBAL_AGENT_NO_PROXY).toBe("keycloak.local,adfs.local");
      // Verify bootstrap was attempted (either success or error logged)
      const infoCalled = vi
        .mocked(logger.info)
        .mock.calls.some(
          (call) => call[0] === "Enabled global-agent proxy support for outbound HTTP requests"
        );
      const errorCalled = vi.mocked(logger.error).mock.calls.length > 0;
      expect(infoCalled || errorCalled).toBe(true);
    });

    test("should use NO_PROXY when GLOBAL_AGENT_NO_PROXY is not set", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "1";
      vi.mocked(env).NO_PROXY = "auth.service.company.local";

      setupGlobalAgentProxy();

      expect(process.env.GLOBAL_AGENT_NO_PROXY).toBe("auth.service.company.local");
      // Verify bootstrap was attempted
      const infoCalled = vi
        .mocked(logger.info)
        .mock.calls.some(
          (call) => call[0] === "Enabled global-agent proxy support for outbound HTTP requests"
        );
      const errorCalled = vi.mocked(logger.error).mock.calls.length > 0;
      expect(infoCalled || errorCalled).toBe(true);
    });

    test("should prefer GLOBAL_AGENT_NO_PROXY over NO_PROXY", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "1";
      vi.mocked(env).GLOBAL_AGENT_NO_PROXY = "keycloak.local";
      vi.mocked(env).NO_PROXY = "auth.service.company.local";

      setupGlobalAgentProxy();

      expect(process.env.GLOBAL_AGENT_NO_PROXY).toBe("keycloak.local");
      // Verify bootstrap was attempted
      const infoCalled = vi.mocked(logger.info).mock.calls.length > 0;
      const errorCalled = vi.mocked(logger.error).mock.calls.length > 0;
      expect(infoCalled || errorCalled).toBe(true);
    });

    test("should not set GLOBAL_AGENT_NO_PROXY when neither is set", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "1";
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      const originalNoProxy = process.env.GLOBAL_AGENT_NO_PROXY;
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      delete process.env.GLOBAL_AGENT_NO_PROXY;

      setupGlobalAgentProxy();

      // eslint-disable-next-line turbo/no-undeclared-env-vars
      expect(process.env.GLOBAL_AGENT_NO_PROXY).toBeUndefined();
      // Verify bootstrap was attempted
      const infoCalled = vi
        .mocked(logger.info)
        .mock.calls.some(
          (call) => call[0] === "Enabled global-agent proxy support for outbound HTTP requests"
        );
      const errorCalled = vi.mocked(logger.error).mock.calls.length > 0;
      expect(infoCalled || errorCalled).toBe(true);

      // Restore
      if (originalNoProxy !== undefined) {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        process.env.GLOBAL_AGENT_NO_PROXY = originalNoProxy;
      }
    });
  });

  describe("successful initialization", () => {
    test("should attempt to bootstrap global-agent when enabled", () => {
      vi.mocked(env).USE_GLOBAL_AGENT_PROXY = "1";

      setupGlobalAgentProxy();

      // Verify bootstrap was attempted (either success or error)
      const infoCalled = vi
        .mocked(logger.info)
        .mock.calls.some(
          (call) => call[0] === "Enabled global-agent proxy support for outbound HTTP requests"
        );
      const errorCalled = vi.mocked(logger.error).mock.calls.length > 0;
      expect(infoCalled || errorCalled).toBe(true);

      // If successful, flag should be set
      if (infoCalled) {
        expect(globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED).toBe(true);
      }
    });
  });
});
