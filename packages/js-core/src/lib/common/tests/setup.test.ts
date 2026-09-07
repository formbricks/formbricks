import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { JS_LOCAL_STORAGE_KEY } from "@/lib/common/constants";
import { addCleanupEventListeners, addEventListeners } from "@/lib/common/event-listeners";
import { Logger } from "@/lib/common/logger";
import { handleErrorOnFirstSetup, setup, tearDown } from "@/lib/common/setup";
import { setIsSetup } from "@/lib/common/status";
import { filterSurveys, getIsDebug, isNowExpired } from "@/lib/common/utils";
import type * as Utils from "@/lib/common/utils";
import { addLiveRegionContainer } from "@/lib/survey/widget";
import { DEFAULT_USER_STATE_NO_USER_ID } from "@/lib/user/state";
import { sendUpdatesToBackend } from "@/lib/user/update";
import { fetchWorkspaceState } from "@/lib/workspace/state";
import type { TConfig, TConfigUpdateInput } from "@/types/config";

const setItemMock = localStorage.setItem as unknown as Mock;

// 2) Mock Config
vi.mock("@/lib/common/config", () => ({
  JS_LOCAL_STORAGE_KEY: "formbricks-js",
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
      resetConfig: vi.fn(),
    })),
  },
}));

// 3) Mock logger
vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      configure: vi.fn(),
    })),
  },
}));

// 4) Mock event-listeners
vi.mock("@/lib/common/event-listeners", () => ({
  addEventListeners: vi.fn(),
  addCleanupEventListeners: vi.fn(),
  removeAllEventListeners: vi.fn(),
}));

// 5) Mock fetchWorkspaceState
vi.mock("@/lib/workspace/state", () => ({
  fetchWorkspaceState: vi.fn(),
}));

// 6) Mock filterSurveys
vi.mock("@/lib/common/utils", async (importOriginal) => {
  const originalModule = await importOriginal<typeof Utils>();
  return {
    ...originalModule,
    filterSurveys: vi.fn(),
    isNowExpired: vi.fn(),
    getIsDebug: vi.fn(),
  };
});

// 7) Mock user/update
vi.mock("@/lib/user/update", () => ({
  sendUpdatesToBackend: vi.fn(),
}));

// 8) Mock checkPageUrl
vi.mock("@/lib/survey/no-code-action", () => ({
  checkPageUrl: vi.fn(),
}));

// 9) Mock survey widget
vi.mock("@/lib/survey/widget", () => ({
  closeSurvey: vi.fn(),
  prefetchSurveysScript: vi.fn(),
  addLiveRegionContainer: vi.fn(),
}));

interface StatefulConfigMock {
  get: Mock;
  update: Mock;
  resetConfig: Mock;
  read: () => TConfig | undefined;
}

// Stateful stand-in for Config: `get()` throws until something is written and then returns the last
// value written, like the real one. A mock whose `get()` always throws cannot observe whether state
// survived the migration at all, which is the whole question these tests ask.
const createStatefulConfigMock = (): StatefulConfigMock => {
  let stored: TConfig | undefined;

  return {
    get: vi.fn(() => {
      if (!stored) throw new Error("config is null");
      return stored;
    }),
    update: vi.fn((next: TConfigUpdateInput) => {
      stored = { ...next, status: { value: "success", expiresAt: null } };
    }),
    resetConfig: vi.fn(() => {
      stored = undefined;
    }),
    read: () => stored,
  };
};

describe("setup.ts", () => {
  let getInstanceConfigMock: MockInstance<() => Config>;
  let getInstanceLoggerMock: MockInstance<() => Logger>;

  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    configure: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // By default, set isSetup to false so we can test setup logic from scratch
    setIsSetup(false);

    getInstanceConfigMock = vi.spyOn(Config, "getInstance");
    getInstanceLoggerMock = vi.spyOn(Logger, "getInstance").mockReturnValue(mockLogger as unknown as Logger);
    (getIsDebug as unknown as Mock).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setup()", () => {
    test("returns ok if already setup", async () => {
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      setIsSetup(true);
      const result = await setup({ workspaceId: "ws_id", appUrl: "https://my.url" });
      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith("Already set up, skipping setup.");
    });

    test("the already-setup early return does NOT re-emit formbricks_setup_successful", async () => {
      // The event's exactly-once guarantee is structural: the emit sits at the tail every fresh
      // setup converges on, and this branch returns before reaching it. A re-fire would re-trigger
      // every GTM tag listening for readiness.
      delete (window as { dataLayer?: unknown }).dataLayer;
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      setIsSetup(true);

      const result = await setup({ workspaceId: "ws_id", appUrl: "https://my.url" });

      expect(result.ok).toBe(true);
      expect(window.dataLayer).toBeUndefined();
    });

    test("a failed setup (missing field) does not emit formbricks_setup_successful", async () => {
      delete (window as { dataLayer?: unknown }).dataLayer;
      const result = await setup({ appUrl: "https://my.url" });

      expect(result.ok).toBe(false);
      expect(window.dataLayer).toBeUndefined();
    });

    test("fails if no environmentId or workspaceId is provided", async () => {
      const result = await setup({ appUrl: "https://my.url" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("missing_field");
        expect(result.error).toHaveProperty("field", "workspaceId");
      }
    });

    test("fails if empty environmentId is provided without workspaceId", async () => {
      const result = await setup({ environmentId: "", appUrl: "https://my.url" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("missing_field");
      }
    });

    test("fails if no appUrl is provided", async () => {
      const result = await setup({ workspaceId: "ws_123", appUrl: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("missing_field");
      }
    });

    test("succeeds with workspaceId instead of environmentId", async () => {
      delete (window as { dataLayer?: unknown }).dataLayer;
      const mockConfig = {
        get: vi.fn().mockReturnValue(undefined),
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          data: {
            surveys: [],
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://my.url" });
      expect(result.ok).toBe(true);
      expect(addLiveRegionContainer).toHaveBeenCalledOnce();
      expect(fetchWorkspaceState).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws_123",
        })
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws_123",
        })
      );
      // ENG-1846: the readiness signal fires exactly once, at the tail every fresh setup converges
      // on, carrying the resolved workspace id.
      expect(window.dataLayer).toEqual([
        {
          event: "formbricks_setup_successful",
          formbricks: {
            workspaceId: "ws_123",
            surveyId: null,
            responseId: null,
            finished: null,
            action: null,
          },
        },
      ]);
    });

    test("prefers workspaceId over environmentId when both provided", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue(undefined),
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          data: {
            surveys: [],
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({
        workspaceId: "ws_123",
        environmentId: "env_456",
        appUrl: "https://my.url",
      });
      expect(result.ok).toBe(true);
      expect(fetchWorkspaceState).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws_123",
        })
      );
    });

    test("logs deprecation warning when only environmentId is used", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceId: "env_123",
          appUrl: "https://my.url",
          workspace: { expiresAt: new Date(Date.now() - 5000), data: { actionClasses: [] } },
          user: { data: {}, expiresAt: null },
          status: { value: "success", expiresAt: null },
        }),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      await setup({ environmentId: "env_123", appUrl: "https://my.url" });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "environmentId is deprecated and will be removed in a future version. Please use workspaceId instead."
      );
    });

    test("skips setup if existing config is in error state and not expired (debug mode)", async () => {
      (getIsDebug as unknown as Mock).mockReturnValue(true);
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceId: "env_123",
          appUrl: "https://my.url",
          workspace: {},
          user: { data: {}, expiresAt: null },
          status: { value: "error", expiresAt: new Date(Date.now() + 10000) },
        }),
        resetConfig: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (isNowExpired as unknown as Mock).mockReturnValue(false); // Not expired

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://my.url" });
      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Formbricks is in error state, but debug mode is active. Resetting config and continuing."
      );
    });

    test("skips initialization if error state is active (not expired)", async () => {
      (getIsDebug as unknown as Mock).mockReturnValue(false);
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceId: "ws_123",
          appUrl: "https://my.url",
          workspace: {},
          user: { data: {}, expiresAt: null },
          status: { value: "error", expiresAt: new Date(Date.now() + 10000) },
        }),
        resetConfig: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      (isNowExpired as unknown as Mock).mockReturnValue(false); // Time is NOT up

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://my.url" });

      expect(result.ok).toBe(true);
      // Should NOT fetch workspace or user state
      expect(fetchWorkspaceState).not.toHaveBeenCalled();
      expect(mockConfig.resetConfig).not.toHaveBeenCalled();
    });

    test("continues initialization if error state is expired", async () => {
      (getIsDebug as unknown as Mock).mockReturnValue(false);
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceId: "ws_123",
          appUrl: "https://my.url",
          workspace: { data: { surveys: [] }, expiresAt: new Date() },
          user: { data: {}, expiresAt: null },
          status: { value: "error", expiresAt: new Date(Date.now() - 10000) },
        }),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      (isNowExpired as unknown as Mock).mockReturnValue(true); // Time IS up

      // Mock successful fetch to allow setup to proceed
      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [] }, expiresAt: new Date() },
      });
      (filterSurveys as unknown as Mock).mockReturnValue([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://my.url" });

      expect(result.ok).toBe(true);
      expect(fetchWorkspaceState).toHaveBeenCalled();
    });

    test("uses existing config if workspaceId/appUrl match, checks for expiration sync", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceId: "ws_123",
          appUrl: "https://my.url",
          workspace: { expiresAt: new Date(Date.now() - 5000), data: { actionClasses: [] } }, // workspace expired
          user: {
            data: { userId: "user_abc" },
            expiresAt: new Date(Date.now() - 5000), // also expired
          },
          status: { value: "success", expiresAt: null },
        }),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (isNowExpired as unknown as Mock).mockReturnValue(true);

      // Mock workspace state fetch success
      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [] }, expiresAt: new Date(Date.now() + 60_000) },
      });

      // Mock sendUpdatesToBackend success
      (sendUpdatesToBackend as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          state: {
            expiresAt: new Date(),
            data: { userId: "user_abc", segments: [] },
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([{ name: "S1" }, { name: "S2" }]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://my.url" });
      expect(result.ok).toBe(true);

      // workspace was fetched
      expect(fetchWorkspaceState).toHaveBeenCalled();
      // user state was updated
      expect(sendUpdatesToBackend).toHaveBeenCalled();
      // filterSurveys called
      expect(filterSurveys).toHaveBeenCalled();
      // config updated
      expect(mockConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matchers are any-typed
          user: expect.objectContaining({
            data: { userId: "user_abc", segments: [] },
          }),
          filteredSurveys: [{ name: "S1" }, { name: "S2" }],
        })
      );
    });

    test("resets config if no valid config found, fetches workspace state, sets default user", async () => {
      const mockConfig = {
        get: () => {
          throw new Error("no config found");
        },
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          data: {
            surveys: [{ name: "SurveyA" }],
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([{ name: "SurveyA" }]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });
      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith("No existing configuration found.");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "No valid configuration found. Resetting config and creating new one."
      );
      expect(mockConfig.resetConfig).toHaveBeenCalled();
      expect(fetchWorkspaceState).toHaveBeenCalled();
      expect(mockConfig.update).toHaveBeenCalledWith({
        appUrl: "https://urlX",
        workspaceId: "ws_123",
        user: DEFAULT_USER_STATE_NO_USER_ID,
        workspace: {
          data: {
            surveys: [{ name: "SurveyA" }],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matchers are any-typed
            expiresAt: expect.any(Date),
          },
        },
        filteredSurveys: [{ name: "SurveyA" }],
      });
    });

    test("migrates a user-less legacy config and still resets + resyncs instead of throwing", async () => {
      // Old first-migration configs could be persisted without a `user` state.
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
        })
      );

      const mockConfig = {
        get: () => {
          throw new Error("no config found");
        },
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          data: {
            surveys: [],
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      // the migrated user-less state was stored with the default user substituted
      expect(mockConfig.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ workspaceId: "ws_123", user: DEFAULT_USER_STATE_NO_USER_ID })
      );
      // and the fresh-sync path still ran
      expect(mockConfig.resetConfig).toHaveBeenCalled();
      expect(fetchWorkspaceState).toHaveBeenCalled();
    });

    test("migrates a legacy config whose user has no data instead of throwing", async () => {
      // A legacy blob can carry a shapeless `user` (present but without `data`).
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          user: {},
        })
      );

      const mockConfig = {
        get: () => {
          throw new Error("no config found");
        },
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          data: {
            surveys: [],
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      // the shapeless user was replaced by the default user state
      expect(mockConfig.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ workspaceId: "ws_123", user: DEFAULT_USER_STATE_NO_USER_ID })
      );
      expect(mockConfig.resetConfig).toHaveBeenCalled();
      expect(fetchWorkspaceState).toHaveBeenCalled();
    });

    test("rebuilds a complete user state when a legacy user has data but no expiresAt", async () => {
      const legacyUserData = {
        userId: null,
        contactId: null,
        segments: [],
        displays: [],
        responses: [],
        lastDisplayAt: null,
      };
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          user: { data: legacyUserData },
        })
      );

      const mockConfig = {
        get: () => {
          throw new Error("no config found");
        },
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          data: {
            surveys: [],
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      });

      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      // the surviving data was kept and the missing expiresAt filled in
      expect(mockConfig.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ user: { expiresAt: null, data: legacyUserData } })
      );
    });

    test("keeps an identified legacy user through the migration", async () => {
      const legacyUserData = {
        userId: "user_1",
        contactId: "contact_1",
        segments: ["seg_1"],
        displays: [],
        responses: [],
        lastDisplayAt: null,
      };
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          user: { expiresAt: null, data: legacyUserData },
        })
      );

      const mockConfig = createStatefulConfigMock();

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [], expiresAt: new Date(Date.now() + 60000) } },
      });
      (sendUpdatesToBackend as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { state: { expiresAt: new Date(Date.now() + 60000), data: legacyUserData } },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      // the identified user was persisted rather than dropped with the reset config
      expect(mockConfig.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ workspaceId: "ws_123", user: { expiresAt: null, data: legacyUserData } })
      );
      // and the fresh-sync path re-identified from it instead of falling back to anonymous
      expect(sendUpdatesToBackend).toHaveBeenCalledWith(
        expect.objectContaining({ updates: { userId: "user_1" } })
      );
      expect(mockConfig.read()?.user.data.userId).toBe("user_1");
    });

    // The migrated config below belongs to ws_123 on https://urlX. Either mismatch means a
    // different integration, whose user must not be carried across.
    test.each([
      { label: "workspace", input: { workspaceId: "ws_999", appUrl: "https://urlX" } },
      { label: "app URL", input: { workspaceId: "ws_123", appUrl: "https://other.url" } },
    ])("does not carry a migrated user into a different $label", async ({ input }) => {
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          user: {
            expiresAt: null,
            data: {
              userId: "user_1",
              contactId: "contact_1",
              segments: [],
              displays: [],
              responses: [],
              lastDisplayAt: null,
            },
          },
        })
      );

      const mockConfig = createStatefulConfigMock();

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [], expiresAt: new Date(Date.now() + 60000) } },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup(input);

      expect(result.ok).toBe(true);
      expect(sendUpdatesToBackend).not.toHaveBeenCalled();
      expect(mockConfig.read()?.user.data.userId).toBeNull();
    });

    test("keeps the migrated user when the identify call fails", async () => {
      const legacyUserData = {
        userId: "user_1",
        contactId: "contact_1",
        segments: ["seg_1"],
        displays: [],
        responses: [],
        lastDisplayAt: null,
      };
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          user: { expiresAt: null, data: legacyUserData },
        })
      );

      const mockConfig = createStatefulConfigMock();

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [], expiresAt: new Date(Date.now() + 60000) } },
      });
      (sendUpdatesToBackend as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        error: { code: "network_error", responseMessage: "boom" },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      // the migration is one-shot, so a failed sync must not persist the anonymous default
      expect(mockConfig.read()?.user.data).toEqual(legacyUserData);
      // kept expired, so the next load retries the sync
      expect(mockConfig.read()?.user.expiresAt).toEqual(new Date(0));
    });

    test("repairs a legacy user whose data holds the wrong types", async () => {
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          // a spread over the default keeps this null, and `filterSurveys` calls `.filter` on it
          user: { data: { userId: "user_1", displays: null, responses: [], segments: [] } },
        })
      );

      const mockConfig = createStatefulConfigMock();

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [], expiresAt: new Date(Date.now() + 60000) } },
      });
      (sendUpdatesToBackend as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        error: { code: "network_error", responseMessage: "boom" },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      const [migrated] = mockConfig.update.mock.calls[0] as [TConfigUpdateInput];
      expect(migrated.user.data.displays).toEqual([]);
    });

    test("re-syncs a migrated user whose data had to be completed", async () => {
      // `segments` is missing. Completing it to [] and trusting it would send an identified user
      // through `filterSurveys`'s `if (!segments.length) return []` — no surveys at all.
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          environment: {
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            data: { surveys: [], settings: {} },
          },
          user: {
            // not expired on its own — only the repair marks it for a re-sync
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            data: { userId: "user_1", contactId: "contact_1", displays: [], responses: [] },
          },
        })
      );

      const mockConfig = createStatefulConfigMock();

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      (isNowExpired as unknown as Mock).mockImplementation(
        (date: Date) => new Date(date).getTime() < Date.now()
      );
      (sendUpdatesToBackend as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: {
          state: {
            expiresAt: new Date(Date.now() + 60000),
            data: { userId: "user_1", segments: ["seg_1"], displays: [], responses: [] },
          },
        },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      expect(sendUpdatesToBackend).toHaveBeenCalledWith(
        expect.objectContaining({ updates: { userId: "user_1" } })
      );
      expect(mockConfig.read()?.user.data.segments).toEqual(["seg_1"]);
    });

    test("completes a legacy user whose data is present but empty", async () => {
      // `Partial<TUserState>` types a present `data` as complete, so an empty one reaches
      // `filterSurveys`, which destructures `displays` and calls `.filter` on it.
      (localStorage.getItem as unknown as Mock).mockReturnValueOnce(
        JSON.stringify({
          appUrl: "https://urlX",
          environmentId: "ws_123",
          user: { data: {} },
        })
      );

      const mockConfig = {
        get: () => {
          throw new Error("no config found");
        },
        resetConfig: vi.fn(),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [], expiresAt: new Date(Date.now() + 60000) } },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_123", appUrl: "https://urlX" });

      expect(result.ok).toBe(true);
      // completed from the default, and expired so setup re-syncs rather than trusting the repair
      expect(mockConfig.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          user: {
            expiresAt: new Date(0),
            data: {
              userId: null,
              contactId: null,
              segments: [],
              displays: [],
              responses: [],
              lastDisplayAt: null,
            },
          },
        })
      );
    });

    test("calls handleErrorOnFirstSetup if workspace state fetch fails initially", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn(),
        resetConfig: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValueOnce(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        error: { code: "forbidden", responseMessage: "No access" },
      });

      await expect(setup({ workspaceId: "ws_123", appUrl: "https://urlX" })).rejects.toThrow(
        "Could not set up formbricks"
      );
    });

    test("adds event listeners and sets isSetup", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspaceId: "ws_abc",
          appUrl: "https://test.app",
          workspace: { expiresAt: new Date(Date.now() - 5000), data: { actionClasses: [] } }, // workspace expired
          user: { data: {}, expiresAt: null },
          status: { value: "success", expiresAt: null },
        }),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (fetchWorkspaceState as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        data: { data: { surveys: [] }, expiresAt: new Date(Date.now() + 60_000) },
      });
      (filterSurveys as unknown as Mock).mockReturnValueOnce([]);

      const result = await setup({ workspaceId: "ws_abc", appUrl: "https://test.app" });
      expect(result.ok).toBe(true);
      expect(addEventListeners).toHaveBeenCalled();
      expect(addCleanupEventListeners).toHaveBeenCalled();
    });
  });

  describe("tearDown()", () => {
    test("resets user state to default", () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          workspace: { data: { surveys: [] } },
          user: { data: { userId: "XYZ" } },
        }),
        update: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      tearDown();

      expect(mockConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          user: DEFAULT_USER_STATE_NO_USER_ID,
        })
      );
      expect(filterSurveys).toHaveBeenCalled();
    });
  });

  describe("handleErrorOnFirstSetup()", () => {
    test("stores error state in AsyncStorage, throws error", async () => {
      // We import the function directly
      const errorObj = { code: "forbidden", responseMessage: "No access" };

      await expect(async () => {
        await handleErrorOnFirstSetup(errorObj);
      }).rejects.toThrow("Could not set up formbricks");

      expect(setItemMock).toHaveBeenCalledWith(
        JS_LOCAL_STORAGE_KEY,
        expect.stringContaining('"value":"error"')
      );
    });
  });
});
