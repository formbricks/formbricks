// @vitest-environment happy-dom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import { ResponseQueue, _syncLocks, delay } from "./response-queue";
import { SurveyState } from "./survey-state";

// Suppress noisy console output from retry logic during tests
beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

vi.mock("./offline-storage", () => ({
  addPendingResponse: vi.fn().mockResolvedValue(1),
  countPendingResponses: vi.fn().mockResolvedValue(0),
  getPendingResponses: vi.fn().mockResolvedValue([]),
  removePendingResponse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./api-client", () => ({
  ApiClient: vi.fn(function ApiClient() {
    return {
      updateResponse: vi.fn(),
      createResponse: vi.fn(),
    };
  }),
}));

const getSurveyState: () => SurveyState = () => ({
  responseId: null,
  displayId: "display1",
  userId: "user1",
  contactId: "contact1",
  surveyId: "survey1",
  singleUseId: "single1",
  shouldCreateResponseFromState: false,
  responseAcc: { finished: false, data: {}, ttc: {}, variables: {} },
  updateResponseId: vi.fn(),
  updateDisplayId: vi.fn(),
  updateUserId: vi.fn(),
  updateContactId: vi.fn(),
  enableBootstrapResponseCreate: vi.fn(),
  disableBootstrapResponseCreate: vi.fn(),
  accumulateResponse: vi.fn(),
  isResponseFinished: vi.fn(),
  clear: vi.fn(),
  copy: vi.fn(),
  setSurveyId: vi.fn(),
});

const getConfig = (overrides = {}) => ({
  appUrl: "http://localhost",
  environmentId: "env1",
  retryAttempts: 2,
  setSurveyState: vi.fn(),
  onResponseSendingFailed: vi.fn(),
  onResponseSendingFinished: vi.fn(),
  ...overrides,
});

const responseUpdate: TResponseUpdate = {
  data: { foo: "bar" },
  hiddenFields: {},
  finished: true,
};

describe("delay", () => {
  test("resolves after specified ms", async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(49); // Using 49 to account for execution time
  });
});

describe("ResponseQueue", () => {
  let surveyState: SurveyState;
  let config: ReturnType<typeof getConfig>;
  let queue: ResponseQueue;
  let apiMock: any;

  beforeEach(() => {
    surveyState = getSurveyState();
    config = getConfig();
    queue = new ResponseQueue(config, surveyState);
    apiMock = queue.api;
    vi.clearAllMocks();
    _syncLocks.clear();
  });

  test("constructor initializes properties", () => {
    expect(queue.config).toBe(config);
    expect(queue.api).toBeDefined();
    expect(queue["surveyState"]).toBe(surveyState);
    expect(queue.queue).toEqual([]);
  });

  test("setResponseRecaptchaToken sets token", () => {
    queue.setResponseRecaptchaToken("token123");
    expect(queue["responseRecaptchaToken"]).toBe("token123");
  });

  test("add accumulates response, sets survey state, and processes queue", async () => {
    vi.spyOn(queue, "processQueue").mockImplementation(() => Promise.resolve({ success: true }));
    queue.add(responseUpdate);
    expect(surveyState.accumulateResponse).toHaveBeenCalledWith(responseUpdate);
    expect(config.setSurveyState).toHaveBeenCalledWith(surveyState);
    expect(queue.queue[0]).toBe(responseUpdate);
    expect(queue.processQueue).toHaveBeenCalled();
  });

  test("processQueue does nothing if request in progress or queue empty", async () => {
    queue["isRequestInProgress"] = true;
    await queue.processQueue();
    queue["isRequestInProgress"] = false;
    queue.queue.length = 0;
    await queue.processQueue();
    expect(true).toBe(true); // just to ensure no errors
  });

  test("processQueue sends response and removes from queue on success", async () => {
    queue.queue.push(responseUpdate);
    vi.spyOn(queue, "sendResponse").mockResolvedValue(ok(true));
    await queue.processQueue();
    expect(queue.queue.length).toBe(0);
    expect(queue["isRequestInProgress"]).toBe(false);
  });

  test("processQueue retries and calls onResponseSendingFailed on recaptcha error", async () => {
    queue.queue.push(responseUpdate);

    vi.spyOn(queue, "sendResponse").mockResolvedValue(
      err({
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
        details: {
          code: "recaptcha_verification_failed",
        },
      })
    );
    await queue.processQueue();
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.RecaptchaError
    );
    expect(queue["isRequestInProgress"]).toBe(false);
  });

  test("processQueue retries and calls onResponseSendingFailed after max attempts", async () => {
    queue.queue.push(responseUpdate);
    vi.spyOn(queue, "sendResponse").mockResolvedValue(
      err({
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
      })
    );
    await queue.processQueue();
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseSendingError
    );
    expect(queue["isRequestInProgress"]).toBe(false);
  });

  test("processQueue calls onResponseSendingFinished if finished", async () => {
    queue.queue.push({ ...responseUpdate, finished: true });
    vi.spyOn(queue, "sendResponse").mockResolvedValue(ok(true));
    await queue.processQueue();
    expect(config.onResponseSendingFinished).toHaveBeenCalled();
  });

  test("sendResponse calls updateResponse if responseId exists", async () => {
    surveyState.responseId = "resp1";
    apiMock.updateResponse.mockResolvedValue({ ok: true, data: { quotaFull: false } });
    const result = await queue.sendResponse(responseUpdate);
    expect(apiMock.updateResponse).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  test("sendResponse calls createResponse if no responseId, updates responseId", async () => {
    apiMock.createResponse.mockResolvedValue({ ok: true, data: { id: "newid" } });
    const result = await queue.sendResponse(responseUpdate);
    expect(apiMock.createResponse).toHaveBeenCalled();
    expect(surveyState.updateResponseId).toHaveBeenCalledWith("newid");
    expect(surveyState.disableBootstrapResponseCreate).toHaveBeenCalled();
    expect(config.setSurveyState).toHaveBeenCalledWith(surveyState);
    expect(result.ok).toBe(true);
  });

  test("sendResponse uses accumulated response state when bootstrap create is enabled", async () => {
    surveyState.shouldCreateResponseFromState = true;
    surveyState.responseAcc = {
      finished: true,
      data: { q1: "saved", q2: "latest" },
      ttc: { q1: 100, q2: 200 },
      variables: { locale: "en" },
      language: "en",
      meta: { url: "https://example.com" },
      endingId: "ending-1",
    };
    apiMock.createResponse.mockResolvedValue({ ok: true, data: { id: "newid" } });

    await queue.sendResponse({
      data: { q2: "latest" },
      hiddenFields: { hidden: "value" },
      finished: false,
      language: "de",
      endingId: null,
    });

    expect(apiMock.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        finished: true,
        data: { q1: "saved", q2: "latest", hidden: "value" },
        ttc: { q1: 100, q2: 200 },
        variables: { locale: "en" },
        language: "en",
        meta: { url: "https://example.com" },
        endingId: "ending-1",
        displayId: "display1",
      })
    );
  });

  test("sendResponse notifies when a responseId is created", async () => {
    const onResponseCreated = vi.fn();
    queue = new ResponseQueue(getConfig({ onResponseCreated }), surveyState);
    apiMock = queue.api;
    apiMock.createResponse.mockResolvedValue({ ok: true, data: { id: "newid" } });

    await queue.sendResponse(responseUpdate);

    expect(onResponseCreated).toHaveBeenCalledWith("newid");
  });

  test("sendResponse returns err if createResponse fails", async () => {
    apiMock.createResponse.mockResolvedValue({ ok: false, error: { code: "internal_server_error" } });
    const result = await queue.sendResponse(responseUpdate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("internal_server_error");
    }
  });

  test("sendResponse handles unexpected errors", async () => {
    apiMock.createResponse.mockRejectedValue(new Error("Unexpected error"));
    const result = await queue.sendResponse(responseUpdate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("internal_server_error");
    }
  });

  test("updateSurveyState updates surveyState", () => {
    const newState = getSurveyState();
    queue.updateSurveyState(newState);
    expect(queue["surveyState"]).toBe(newState);
  });

  test("processQueueAsync returns success false if queue empty", async () => {
    const result = await queue.processQueue();
    expect(result.success).toBe(false);
  });

  test("processQueueAsync returns success false if request in progress", async () => {
    queue["isRequestInProgress"] = true;
    const result = await queue.processQueue();
    expect(result.success).toBe(false);
  });

  test("processQueueAsync returns success true on successful send", async () => {
    queue.queue.push(responseUpdate);
    vi.spyOn(queue, "sendResponse").mockResolvedValue(ok(true));
    const result = await queue.processQueue();
    expect(result.success).toBe(true);
    expect(queue.queue.length).toBe(0);
  });

  test("processQueueAsync returns success false after max attempts", async () => {
    queue.queue.push(responseUpdate);
    vi.spyOn(queue, "sendResponse").mockResolvedValue(
      err({
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
      })
    );
    const result = await queue.processQueue();
    expect(result.success).toBe(false);
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseSendingError
    );
  });

  test("processQueueAsync returns success false on recaptcha error", async () => {
    queue.queue.push(responseUpdate);
    vi.spyOn(queue, "sendResponse").mockResolvedValue(
      err({
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
        details: {
          code: "recaptcha_verification_failed",
        },
      })
    );
    const result = await queue.processQueue();
    expect(result.success).toBe(false);
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.RecaptchaError
    );
  });

  test("getUnsentData returns empty object when queue is empty", () => {
    const unsentData = queue.getUnsentData();
    expect(unsentData).toEqual({});
  });

  test("getUnsentData returns data from single item in queue", () => {
    queue.queue.push({ data: { q1: "answer1" }, hiddenFields: {}, finished: false });
    const unsentData = queue.getUnsentData();
    expect(unsentData).toEqual({ q1: "answer1" });
  });

  test("getUnsentData aggregates data from multiple items in queue", () => {
    queue.queue.push({ data: { q1: "answer1" }, hiddenFields: {}, finished: false });
    queue.queue.push({ data: { q2: "answer2" }, hiddenFields: {}, finished: false });
    queue.queue.push({ data: { q3: "answer3" }, hiddenFields: {}, finished: true });
    const unsentData = queue.getUnsentData();
    expect(unsentData).toEqual({ q1: "answer1", q2: "answer2", q3: "answer3" });
  });

  test("getUnsentData overwrites duplicate keys with latest value", () => {
    queue.queue.push({ data: { q1: "answer1" }, hiddenFields: {}, finished: false });
    queue.queue.push({ data: { q1: "updated_answer1", q2: "answer2" }, hiddenFields: {}, finished: false });
    const unsentData = queue.getUnsentData();
    expect(unsentData).toEqual({ q1: "updated_answer1", q2: "answer2" });
  });

  // --- Offline persistence tests ---

  test("processQueue returns false when offline and persistOffline is enabled", async () => {
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push(responseUpdate);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const result = await offlineQueue.processQueue();
    expect(result.success).toBe(false);
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  test("processQueue returns false when isSyncing is true", async () => {
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push(responseUpdate);
    _syncLocks.set("s1", true);
    const result = await offlineQueue.processQueue();
    expect(result.success).toBe(false);
  });

  test("processQueue defers to sync when multiple IDB entries exist", async () => {
    const { countPendingResponses } = await import("./offline-storage");
    vi.mocked(countPendingResponses).mockResolvedValue(3);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push({ data: { q1: "answer" }, finished: false });

    const syncSpy = vi.spyOn(offlineQueue, "syncPersistedResponses").mockResolvedValue({
      success: true,
      syncedCount: 3,
    });

    const result = await offlineQueue.processQueue();
    expect(result.success).toBe(false);
    expect(syncSpy).toHaveBeenCalled();
    expect(_syncLocks.getRequestInProgress("s1")).toBe(false);
  });

  test("processQueue bails out if syncPersistedResponses starts during countPendingResponses await", async () => {
    const { countPendingResponses } = await import("./offline-storage");
    // Simulate syncPersistedResponses starting during the async gap
    vi.mocked(countPendingResponses).mockImplementation(async () => {
      // While countPendingResponses is resolving, isSyncing becomes true
      _syncLocks.set("s1", true);
      return 1;
    });

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push({ data: { q1: "answer" }, finished: false });

    const sendSpy = vi.spyOn(offlineQueue as any, "sendResponseWithRetry");

    const result = await offlineQueue.processQueue();
    expect(result.success).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  test("processQueue sends directly when it is the only IDB entry", async () => {
    const { countPendingResponses } = await import("./offline-storage");
    vi.mocked(countPendingResponses).mockResolvedValue(1);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push({ data: { q1: "answer" }, finished: false });

    vi.spyOn(offlineQueue as any, "sendResponseWithRetry").mockResolvedValue({ success: true });

    const result = await offlineQueue.processQueue();
    expect(result.success).toBe(true);
  });

  test("loadPersistedQueue returns 0 when persistOffline is disabled", async () => {
    const count = await queue.loadPersistedQueue();
    expect(count).toBe(0);
  });

  test("loadPersistedQueue delegates to countPendingResponses", async () => {
    const { countPendingResponses } = await import("./offline-storage");
    vi.mocked(countPendingResponses).mockResolvedValue(3);
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const count = await offlineQueue.loadPersistedQueue();
    expect(count).toBe(3);
    expect(countPendingResponses).toHaveBeenCalledWith("s1");
  });

  test("getPendingCount returns 0 when persistOffline is disabled", async () => {
    const count = await queue.getPendingCount();
    expect(count).toBe(0);
  });

  test("syncPersistedResponses returns early when persistOffline is disabled", async () => {
    const result = await queue.syncPersistedResponses();
    expect(result).toEqual({ success: true, syncedCount: 0 });
  });

  test("syncPersistedResponses returns early when already syncing", async () => {
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    _syncLocks.set("s1", true);
    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: false, syncedCount: 0 });
  });

  test("syncPersistedResponses returns early when a processQueue request is in flight", async () => {
    _syncLocks.setRequestInProgress("s1", true);
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: false, syncedCount: 0 });
  });

  test("syncPersistedResponses on a new instance sees isRequestInProgress from an old instance", async () => {
    // Simulate instance A having a request in flight (module-level lock)
    _syncLocks.setRequestInProgress("s1", true);
    // Instance B is newly created (e.g. React useMemo recomputation)
    const instanceB = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const result = await instanceB.syncPersistedResponses();
    expect(result).toEqual({ success: false, syncedCount: 0 });
  });

  test("syncPersistedResponses sends entries and clears queue on success", async () => {
    const { getPendingResponses, removePendingResponse } = await import("./offline-storage");
    vi.mocked(getPendingResponses).mockResolvedValue([
      {
        id: 10,
        surveyId: "s1",
        responseUpdate,
        surveyStateSnapshot: {
          responseId: null,
          displayId: "d1",
          surveyId: "s1",
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: { finished: false, data: {} },
        },
        createdAt: Date.now(),
      },
    ]);

    const offlineState = getSurveyState();
    const offlineQueue = new ResponseQueue(getConfig({ persistOffline: true, surveyId: "s1" }), offlineState);
    offlineQueue.queue.push(responseUpdate);

    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));

    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: true, syncedCount: 1 });
    expect(removePendingResponse).toHaveBeenCalledWith(10);
    expect(offlineQueue.queue.length).toBe(0);
    expect(_syncLocks.get("s1")).toBe(false);
  });

  test("syncPersistedResponses stops on server error", async () => {
    const { getPendingResponses } = await import("./offline-storage");
    vi.mocked(getPendingResponses).mockResolvedValue([
      {
        id: 10,
        surveyId: "s1",
        responseUpdate,
        surveyStateSnapshot: {
          responseId: null,
          displayId: "d1",
          surveyId: "s1",
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: { finished: false, data: {} },
        },
        createdAt: Date.now(),
      },
    ]);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(
      err({ code: "internal_server_error", message: "fail", status: 500 })
    );

    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: false, syncedCount: 0 });
    expect(_syncLocks.get("s1")).toBe(false);
  });

  test("syncPersistedResponses retries 404 as createResponse by resetting responseId", async () => {
    const { getPendingResponses, removePendingResponse } = await import("./offline-storage");
    vi.mocked(getPendingResponses).mockResolvedValue([
      {
        id: 10,
        surveyId: "s1",
        responseUpdate,
        surveyStateSnapshot: {
          responseId: "r1",
          displayId: "d1",
          surveyId: "s1",
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: { finished: false, data: {} },
        },
        createdAt: Date.now(),
      },
    ]);

    // Use a state that actually mutates on updateResponseId/updateDisplayId
    const offlineState = getSurveyState();
    offlineState.updateResponseId = vi.fn((id: string) => {
      offlineState.responseId = id;
    });
    offlineState.updateDisplayId = vi.fn((id: string) => {
      offlineState.displayId = id;
    });

    const offlineQueue = new ResponseQueue(getConfig({ persistOffline: true, surveyId: "s1" }), offlineState);

    // First call: 404 (updateResponse fails), second call: retry as createResponse succeeds
    vi.spyOn(offlineQueue, "sendResponse")
      .mockResolvedValueOnce(err({ code: "not_found", message: "not found", status: 404 }))
      .mockResolvedValueOnce(ok(true));

    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: true, syncedCount: 1 });
    expect(offlineQueue.sendResponse).toHaveBeenCalledTimes(2);
    expect(removePendingResponse).toHaveBeenCalledWith(10);
    // responseId should have been reset to null for the retry
    expect(offlineState.responseId).toBeNull();
  });

  test("syncPersistedResponses removes non-404 4xx entries and continues", async () => {
    const { getPendingResponses, removePendingResponse } = await import("./offline-storage");
    vi.mocked(getPendingResponses).mockResolvedValue([
      {
        id: 10,
        surveyId: "s1",
        responseUpdate,
        surveyStateSnapshot: {
          responseId: null,
          displayId: "d1",
          surveyId: "s1",
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: { finished: false, data: {} },
        },
        createdAt: Date.now(),
      },
      {
        id: 11,
        surveyId: "s1",
        responseUpdate,
        surveyStateSnapshot: {
          responseId: null,
          displayId: "d1",
          surveyId: "s1",
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: { finished: false, data: {} },
        },
        createdAt: Date.now(),
      },
    ]);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    vi.spyOn(offlineQueue, "sendResponse")
      .mockResolvedValueOnce(err({ code: "bad_request", message: "already completed", status: 409 }))
      .mockResolvedValueOnce(ok(true));

    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: true, syncedCount: 1 });
    expect(removePendingResponse).toHaveBeenCalledWith(10);
    expect(removePendingResponse).toHaveBeenCalledWith(11);
  });
});
