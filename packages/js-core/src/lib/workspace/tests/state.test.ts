// state.test.ts
import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClient } from "@/lib/common/api";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys } from "@/lib/common/utils";
import {
  addWorkspaceStateExpiryCheckListener,
  clearWorkspaceStateExpiryCheckListener,
  fetchWorkspaceState,
} from "@/lib/workspace/state";
import type { TWorkspaceState } from "@/types/config";

// Mock the ApiClient so we can control workspace.getWorkspaceState
vi.mock("@/lib/common/api", () => ({
  ApiClient: vi.fn(function MockApiClient(this: { getWorkspaceState: ReturnType<typeof vi.fn> }) {
    this.getWorkspaceState = vi.fn();
  }),
}));

// Mock logger (so we don't spam console)
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

  describe("fetchWorkspaceState()", () => {
    test("returns ok(...) with workspace state", async () => {
      // Setup mock
      (ApiClient as unknown as Mock).mockImplementationOnce(function MockApiClient() {
        return {
          getWorkspaceState: vi.fn().mockResolvedValue({
            ok: true,
            data: { data: { foo: "bar" }, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
          }),
        };
      });

      const result = await fetchWorkspaceState({
        appUrl: "https://fake.host",
        workspaceId: "env_123",
      });

      expect(result.ok).toBe(true);

      if (result.ok) {
        const val: TWorkspaceState = result.data;
        expect(val.data).toEqual({ foo: "bar" });
        expect(val.expiresAt).toBeInstanceOf(Date);
      }
    });

    test("returns err(...) if workspace.getWorkspaceState is not ok", async () => {
      const mockError = { code: "forbidden", status: 403, message: "Access denied" };

      (ApiClient as unknown as Mock).mockImplementationOnce(function MockApiClient() {
        return {
          getWorkspaceState: vi.fn().mockResolvedValue({
            ok: false,
            error: mockError,
          }),
        };
      });

      const result = await fetchWorkspaceState({
        appUrl: "https://fake.host",
        workspaceId: "env_123",
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

      (ApiClient as unknown as Mock).mockImplementationOnce(function MockApiClient() {
        return {
          getWorkspaceState: vi.fn().mockRejectedValue(mockNetworkError),
        };
      });

      const result = await fetchWorkspaceState({
        appUrl: "https://fake.host",
        workspaceId: "env_123",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(mockNetworkError.code);
        expect(result.error.message).toBe(mockNetworkError.message);
        expect(result.error.responseMessage).toBe(mockNetworkError.responseMessage);
      }
    });
  });

  describe("addWorkspaceStateExpiryCheckListener()", () => {
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
          workspaceState: {
            expiresAt: new Date(Date.now() + 60_000), // Not expired for now
          },
          user: {},
          workspaceId: "env_123",
          appUrl: "https://fake.host",
        }),
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      mockLoggerInstance = vi.spyOn(Logger, "getInstance");
      mockLoggerInstance.mockReturnValue(mockLogger as unknown as Logger);
    });

    afterEach(() => {
      clearWorkspaceStateExpiryCheckListener(); // clear after each test
    });

    test("starts interval check and updates state when expired", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceState: {
            expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
          },
          appUrl: "https://test.com",
          workspaceId: "env_123",
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

      (ApiClient as Mock).mockImplementation(function MockApiClient() {
        return {
          getWorkspaceState: vi.fn().mockResolvedValue({
            ok: true,
            data: mockNewState,
          }),
        };
      });

      (filterSurveys as Mock).mockReturnValue([]);

      // mock setInterval:
      // @ts-expect-error -- mock implementation
      vi.spyOn(window, "setInterval").mockImplementation((fn) => {
        const intervalId = 1;
        fn();
        return intervalId;
      });

      // Add listener
      addWorkspaceStateExpiryCheckListener();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000 * 60);

      // Verify the update was called
      expect(mockConfig.update).toHaveBeenCalled();
    });

    test("extends expiry on error", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceState: {
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          },
          appUrl: "https://test.com",
          workspaceId: "env_123",
        }),
        update: vi.fn(),
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      // Mock API to throw an error
      (ApiClient as Mock).mockImplementation(function MockApiClient() {
        return {
          getWorkspaceState: vi.fn().mockRejectedValue(new Error("Network error")),
        };
      });

      addWorkspaceStateExpiryCheckListener();

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000 * 60);

      // Verify the config was updated with extended expiry
      expect(mockConfig.update).toHaveBeenCalled();
    });

    test("does not fetch new state if not expired", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour in future
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceState: {
            expiresAt: futureDate.toISOString(),
          },
          appUrl: "https://test.com",
          workspaceId: "env_123",
        }),
        update: vi.fn(),
      };

      mockJsConfig.mockReturnValue(mockConfig as unknown as Config);

      const apiMock = vi.fn().mockImplementation(function MockApiClient() {
        return {
          getWorkspaceState: vi.fn(),
        };
      });

      (ApiClient as Mock).mockImplementation(apiMock);

      addWorkspaceStateExpiryCheckListener();

      // Fast-forward time by less than expiry
      await vi.advanceTimersByTimeAsync(1000 * 60);

      expect(mockConfig.update).not.toHaveBeenCalled();
    });

    test("clears interval when clearWorkspaceStateExpiryCheckListener is called", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      addWorkspaceStateExpiryCheckListener();
      clearWorkspaceStateExpiryCheckListener();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
