// environment-state.test.ts
// Mocks & types
import { RNConfig } from "@/lib/common/config";
// import { Logger } from "@/lib/common/logger";
import { filterSurveys } from "@/lib/common/utils";
import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
  fetchEnvironmentState,
} from "@/lib/environment/state";
import type { TEnvironmentState } from "@/types/config";
// import type { ApiErrorResponse } from "@/types/error";
// We import the real functions from the mock, then overshadow them
// import { setTimeout as realSetTimeout } from "node:timers";
import { Mock, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FormbricksAPI } from "@formbricks/api";

////////////////////////////////////////////////////////////////////////////////
// 1) MOCK DEPENDENCIES
////////////////////////////////////////////////////////////////////////////////

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
  Logger: class {
    debug = vi.fn();
    error = vi.fn();
    static getInstance() {
      return new this();
    }
  },
}));

// Mock filterSurveys
vi.mock("@/lib/common/utils", () => ({
  ...(vi.importActual<object>("@/lib/common/utils") as object), // if you want real 'wrapThrowsAsync', etc.
  filterSurveys: vi.fn(),
}));

// Mock RNConfig
vi.mock("@/lib/common/config", () => {
  // We'll provide a minimal mock appConfig
  const mockConfig = {
    get: vi.fn(),
    update: vi.fn(),
  };

  return {
    RN_ASYNC_STORAGE_KEY: "formbricks-react-native",
    RNConfig: class {
      private static instance: unknown;
      static getInstance(): unknown {
        if (!this.instance) {
          this.instance = new this();
        }
        return this.instance;
      }
      get() {
        return mockConfig.get();
      }
      update(newVal: any) {
        return mockConfig.update(newVal);
      }
    },
    // Export the mock object so we can adjust it in tests
    __mockConfig: mockConfig,
  };
});

// Because we cast
const mockRNConfig = RNConfig as unknown as {
  __mockConfig: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

////////////////////////////////////////////////////////////////////////////////
// 2) SETUP & IMPORT THE MODULE UNDER TEST
////////////////////////////////////////////////////////////////////////////////

describe("environment/state.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Use real timers so we don't pollute subsequent test code
    vi.useRealTimers();
  });

  ////////////////////////////////////////////////////////////////////////////////
  // fetchEnvironmentState
  ////////////////////////////////////////////////////////////////////////////////
  describe("fetchEnvironmentState()", () => {
    test("returns ok(...) with environment state and sets expiresAt", async () => {
      // Setup mock
      (FormbricksAPI as unknown as Mock).mockImplementationOnce(() => {
        return {
          client: {
            environment: {
              getState: vi.fn().mockResolvedValue({
                ok: true,
                data: { foo: "bar" },
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

  ////////////////////////////////////////////////////////////////////////////////
  // addEnvironmentStateExpiryCheckListener
  ////////////////////////////////////////////////////////////////////////////////
  describe("addEnvironmentStateExpiryCheckListener()", () => {
    beforeEach(() => {
      // We'll mock config.get() to return a known environment.expiresAt
      mockRNConfig.__mockConfig.get.mockReturnValue({
        environment: {
          expiresAt: new Date(Date.now() + 60_000), // Not expired for now
        },
        user: {},
        environmentId: "env_123",
        appUrl: "https://fake.host",
      });
      vi.useFakeTimers();
    });

    afterEach(() => {
      clearEnvironmentStateExpiryCheckListener(); // clear after each test
    });

    test("sets an interval if not already set, does nothing if environment not expired", () => {
      addEnvironmentStateExpiryCheckListener();
      // The first call sets the interval
      expect(setInterval).toHaveBeenCalledTimes(1);

      // Calling again shouldn't set a second one
      addEnvironmentStateExpiryCheckListener();
      expect(setInterval).toHaveBeenCalledTimes(1);

      // Advance time by a minute
      vi.advanceTimersByTime(60_000);
      // environment not expired => no fetch call
      const formbricksInstances = (FormbricksAPI as unknown as Mock).mock.instances;
      expect(formbricksInstances.length).toBe(0);
    });

    // test("when environment is expired, fetches new environment and updates config", async () => {
    //   // set environment expired right away
    //   mockRNConfig.__mockConfig.get.mockReturnValue({
    //     environment: {
    //       expiresAt: new Date(Date.now() - 1), // already expired
    //     },
    //     user: { data: {} },
    //     environmentId: "env_123",
    //     appUrl: "https://fake.host",
    //   });

    //   (filterSurveys as unknown as Mock).mockReturnValue([{ id: "s1" }]);
    //   (FormbricksAPI as unknown as Mock).mockImplementation(() => ({
    //     client: {
    //       environment: {
    //         getState: vi.fn().mockResolvedValue({
    //           ok: true,
    //           data: { env: "fresh" },
    //         }),
    //       },
    //     },
    //   }));

    //   addEnvironmentStateExpiryCheckListener();
    //   // interval triggers every minute, let's fast-forward
    //   vi.advanceTimersByTime(60_000);

    //   // Expect we called environment.getState
    //   const instances = (FormbricksAPI as unknown as Mock).mock.instances;
    //   expect(instances.length).toBe(1);
    //   const client = instances[0].client.environment.getState;
    //   expect(client).toHaveBeenCalled();

    //   // filterSurveys called
    //   expect(filterSurveys).toHaveBeenCalledWith(
    //     {
    //       data: { env: "fresh" },
    //       expiresAt: expect.any(Date),
    //     },
    //     { data: {} } // user
    //   );

    //   // config.update called with new environment + filteredSurveys
    //   expect(mockRNConfig.__mockConfig.update).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       environment: expect.objectContaining({
    //         data: { env: "fresh" },
    //       }),
    //       filteredSurveys: [{ id: "s1" }],
    //     })
    //   );
    // });

    // test("on error, logs and extends environment expiry by 30 minutes", async () => {
    //   mockRNConfig.__mockConfig.get.mockReturnValue({
    //     environment: {
    //       expiresAt: new Date(Date.now() - 1), // expired
    //     },
    //     user: {},
    //     environmentId: "env_123",
    //     appUrl: "https://fake.host",
    //   });

    //   (FormbricksAPI as unknown as vi.Mock).mockImplementation(() => ({
    //     client: {
    //       environment: {
    //         getState: vi.fn().mockResolvedValue({
    //           ok: false,
    //           error: { code: "forbidden", message: "No access" },
    //         }),
    //       },
    //     },
    //   }));

    //   addEnvironmentStateExpiryCheckListener();
    //   vi.advanceTimersByTime(60_000);

    //   expect(mockRNConfig.__mockConfig.update).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       environment: expect.objectContaining({
    //         expiresAt: expect.any(Date),
    //       }),
    //     })
    //   );
    // });
  });

  // ////////////////////////////////////////////////////////////////////////////////
  // // clearEnvironmentStateExpiryCheckListener
  // ////////////////////////////////////////////////////////////////////////////////
  // describe("clearEnvironmentStateExpiryCheckListener()", () => {
  //   test("clears interval and sets environmentStateSyncIntervalId to null", () => {
  //     addEnvironmentStateExpiryCheckListener(); // sets it
  //     expect(setInterval).toHaveBeenCalledTimes(1);
  //     clearEnvironmentStateExpiryCheckListener();
  //     expect(clearInterval).toHaveBeenCalledTimes(1);
  //     // Also ensures subsequent calls won't crash
  //     clearEnvironmentStateExpiryCheckListener();
  //     expect(clearInterval).toHaveBeenCalledTimes(1);
  //   });
  // });
});
