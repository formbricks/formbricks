// state.test.ts
import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FormbricksAPI } from "@formbricks/api";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys } from "@/lib/common/utils";
import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
  fetchEnvironmentState,
} from "@/lib/environment/state";
import type { TEnvironmentState } from "@/types/config";

// Mock the FormbricksAPI so we can control environment.getState
vi.mock("@formbricks/api", () => ({
  FormbricksAPI: vi.fn().mockImplementation(() => ({
    client: {
      environment: {
        getState: vi.fn(),
      },
    },
  })),
}));

// Mock logger (so we don’t spam console)
vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => {
      return {
        debug: vi.fn(),
        error: vi.fn(),
      };
    }),
  },
}));

// Mock filterSurveys
vi.mock("@/lib/common/utils", () => ({
  filterSurveys: vi.fn(),
  getIsDebug: vi.fn(),
}));

// Mock Config
vi.mock("@/lib/common/config", () => {
  return {
    JS_LOCAL_STORAGE_KEY: "formbricks-js",
    Config: {
      getInstance: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
      })),
    },
  };
});

describe("environment/state.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Use real timers so we don't pollute subsequent test code
    vi.useRealTimers();
  });

  describe("fetchEnvironmentState()", () => {
    test("returns ok(...) with environment state", async () => {
      // Setup mock
      (FormbricksAPI as unknown as Mock).mockImplementationOnce(() => {
        return {
          client: {
            environment: {
              getState: vi.fn().mockResolvedValue({
                ok: true,
                data: { data: { foo: "bar" }, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
              }),
            },
          },
        };
      });

      const result = await fetchEnvironmentState({
        appUrl: "https://fake.host",
        environmentId: "env_123",
      });

      expect(result.ok).toBe(true);

      if (result.ok) {
        const val: TEnvironmentState = result.data;
        expect(val.data).toEqual({ foo: "bar" });
        expect(val.expiresAt).toBeInstanceOf(Date);
      }
    });

    test("returns err(...) if environment.getState is not ok", async () => {
      const mockError = { code: "forbidden", status: 403, message: "Access denied" };

      (FormbricksAPI as unknown as Mock).mockImplementationOnce(() => {
        return {
          client: {
            environment: {
              getState: vi.fn().mockResolvedValue({
                ok: false,
                error: mockError,
              }),
            },
          },
        };
      });

      const result = await fetchEnvironmentState({
        appUrl: "https://fake.host",
        environmentId: "env_123",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(mockError.code);
        expect(result.error.status).toBe(mockError.status);
        expect(result.error.responseMessage).toBe(mockError.message);
      }
    });

    test("returns err(...) on network error catch", async () => {
      const mockNetworkError = {
        code: "network_error",
        message: "Timeout",
        responseMessage: "Network fail",
      };

      (FormbricksAPI as unknown as Mock).mockImplementationOnce(() => {
        return {
          client: {
            environment: {
              getState: vi.fn().mockRejectedValue(mockNetworkError),
            },
          },
        };
      });

      const result = await fetchEnvironmentState({
        appUrl: "https://fake.host",
        environmentId: "env_123",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(mockNetworkError.code);
        expect(result.error.message).toBe(mockNetworkError.message);
        expect(result.error.responseMessage).toBe(mockNetworkError.responseMessage);
      }
    });
  });

  describe("addEnvironmentStateExpiryCheckListener()", () => {
    let mockJsConfig: MockInstance<() => Config>;
    let mockLoggerInstance: MockInstance<() => Logger>;

    const mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();

      mockJsConfig = vi.spyOn(Config, "getInstance");
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environment: {
            expiresAt: new Date(Date.now() + 60_000), // Not expired for now
          },
          user: {},
          environmentId: "env_123",
          appUrl: "https://fake.host",
        }),
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      mockLoggerInstance = vi.spyOn(Logger, "getInstance");
      mockLoggerInstance.mockReturnValue(mockLogger as unknown as Logger);
    });

    afterEach(() => {
      clearEnvironmentStateExpiryCheckListener(); // clear after each test
    });

    test("starts interval check and updates state when expired", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environment: {
            expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
          },
          appUrl: "https://test.com",
          environmentId: "env_123",
          user: { data: {} },
        }),
        update: vi.fn(),
      };

      const mockNewState = {
        data: {
          expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        },
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      (FormbricksAPI as Mock).mockImplementation(() => ({
        client: {
          environment: {
            getState: vi.fn().mockResolvedValue({
              ok: true,
              data: mockNewState,
            }),
          },
        },
      }));

      (filterSurveys as Mock).mockReturnValue([]);

      // mock setInterval:
      // @ts-expect-error -- mock implementation
      vi.spyOn(window, "setInterval").mockImplementation((fn) => {
        const intervalId = 1;
        fn();
        return intervalId;
      });

      // Add listener
      addEnvironmentStateExpiryCheckListener();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000 * 60);

      // Verify the update was called
      expect(mockConfig.update).toHaveBeenCalled();
    });

    test("extends expiry on error", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environment: {
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          },
          appUrl: "https://test.com",
          environmentId: "env_123",
        }),
        update: vi.fn(),
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      // Mock API to throw an error
      (FormbricksAPI as Mock).mockImplementation(() => ({
        client: {
          environment: {
            getState: vi.fn().mockRejectedValue(new Error("Network error")),
          },
        },
      }));

      addEnvironmentStateExpiryCheckListener();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000 * 60);

      // Verify the config was updated with extended expiry
      expect(mockConfig.update).toHaveBeenCalled();
    });

    test("does not fetch new state if not expired", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour in future
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environment: {
            expiresAt: futureDate.toISOString(),
          },
          appUrl: "https://test.com",
          environmentId: "env_123",
        }),
        update: vi.fn(),
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      const apiMock = vi.fn().mockImplementation(() => ({
        client: {
          environment: {
            getState: vi.fn(),
          },
        },
      }));

      (FormbricksAPI as Mock).mockImplementation(apiMock);

      addEnvironmentStateExpiryCheckListener();

      // Fast-forward time by less than expiry
      await vi.advanceTimersByTimeAsync(1000 * 60);

      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    test("clears interval when clearEnvironmentStateExpiryCheckListener is called", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      addEnvironmentStateExpiryCheckListener();
      clearEnvironmentStateExpiryCheckListener();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
