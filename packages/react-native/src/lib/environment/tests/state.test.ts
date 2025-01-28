// environment-state.test.ts
import { RNConfig } from "@/lib/common/config";
// import { filterSurveys } from "@/lib/common/utils";
import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
  fetchEnvironmentState,
} from "@/lib/environment/state";
// import * as state from "@/lib/environment/state";
import type { TEnvironmentState } from "@/types/config";
import { Mock, MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FormbricksAPI } from "@formbricks/api";

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
}));

// Mock RNConfig
vi.mock("@/lib/common/config", () => {
  return {
    RN_ASYNC_STORAGE_KEY: "formbricks-react-native",
    RNConfig: {
      getInstance: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
      })),
    },
    // Export the mock object so we can adjust it in tests
    __mockConfig: {
      get: vi.fn(),
      update: vi.fn(),
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

  describe("addEnvironmentStateExpiryCheckListener()", () => {
    let mockRNConfig: MockInstance<() => RNConfig>;
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();

      mockRNConfig = vi.spyOn(RNConfig, "getInstance");
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

      mockRNConfig.mockReturnValue(mockConfig as unknown as RNConfig);
    });

    afterEach(() => {
      clearEnvironmentStateExpiryCheckListener(); // clear after each test
    });

    test("sets an interval if not already set, does nothing if environment not expired", () => {
      addEnvironmentStateExpiryCheckListener();
      // The first call sets the interval
      // Calling again shouldn't set a second one
      addEnvironmentStateExpiryCheckListener();

      // Advance time by a minute
      vi.advanceTimersByTime(60_000);

      // environment not expired => no fetch call
      const formbricksInstances = (FormbricksAPI as unknown as Mock).mock.instances;
      expect(formbricksInstances.length).toBe(0);
    });

    // test("when environment is expired, fetches new environment and updates config", async () => {
    //   // set environment expired right away

    //   const mockConfig = {
    //     get: vi.fn().mockReturnValue({
    //       environment: {
    //         expiresAt: new Date(Date.now() - 1), // already expired
    //       },
    //     }),
    //     update: vi.fn(),
    //   };

    //   mockRNConfig.mockReturnValue(mockConfig as unknown as RNConfig);

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

    //   const fetchEnvironmentStateMock = vi.spyOn(state, "fetchEnvironmentState").mockResolvedValue({
    //     ok: true,
    //     data: { env: "fresh" },
    //   });

    //   // expect(fetchEnvironmentStateMock).toHaveBeenCalled();

    //   // Expect we called environment.getState
    //   // const instances = (FormbricksAPI as unknown as Mock).mock.instances;
    //   // console.log("instances", instances);
    //   // expect(instances.length).toBe(1);
    //   // const client = instances[0].client.environment.getState;

    //   // expect(client).toHaveBeenCalled();

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
