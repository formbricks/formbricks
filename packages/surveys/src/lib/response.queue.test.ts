// @vitest-environment happy-dom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { RESPONSE_ALREADY_FINISHED_ERROR_CODE } from "@formbricks/types/errors";
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
  countPendingResponsesStrict: vi.fn().mockResolvedValue(0),
  getPendingResponsesStrict: vi.fn().mockResolvedValue([]),
  removePendingResponseStrict: vi.fn().mockResolvedValue(undefined),
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
  pinAuthToken: null,
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
  workspaceId: "ws1",
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

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
    expect(queue.queue).toHaveLength(0);
    expect(queue["isRequestInProgress"]).toBe(false);
  });

  // These specs keep the real sendResponse()/sendResponseWithRetry() classification+retry path and
  // only mock the lower-level api.updateResponse dependency, so terminal-vs-retryable behavior and
  // the error passthrough are actually exercised. responseId is set so the real update path runs
  // (the ENG-1319 scenario is a PUT update rejected server-side).
  test("processQueue retries and calls onResponseSendingFailed on recaptcha error", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);

    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: {
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
        details: { code: "recaptcha_verification_failed" },
      },
    });

    await queue.processQueue();
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.RecaptchaError
    );
    expect(queue["isRequestInProgress"]).toBe(false);
  });

  test("processQueue retries and calls onResponseSendingFailed after max attempts", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);
    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: {
        code: "internal_server_error",
        message: "An error occurred while sending the response.",
        status: 500,
      },
    });
    await queue.processQueue();
    expect(apiMock.updateResponse).toHaveBeenCalledTimes(config.retryAttempts); // 5xx retried until exhausted
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseSendingError
    );
    expect(queue["isRequestInProgress"]).toBe(false);
  }, 10000);

  test("processQueue does not retry 400 'already finished', drops item, surfaces ResponseAlreadyCompleted", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);
    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: {
        code: "bad_request",
        message: "Response is already finished",
        status: 400,
      },
    });

    const result = await queue.processQueue();

    expect(result.success).toBe(false);
    expect(apiMock.updateResponse).toHaveBeenCalledTimes(1); // no exponential-backoff retries
    expect(queue.queue).toHaveLength(0); // dead item dropped so manual Retry can't loop
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseAlreadyCompleted
    );
    expect(queue["isRequestInProgress"]).toBe(false);
  });

  test("processQueue detects already-completed via the stable details.code marker, ignoring message wording", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);
    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: {
        code: "bad_request",
        // Deliberately NOT the English "already finished" wording — detection must rely on the marker.
        message: "Réponse déjà terminée",
        status: 400,
        details: { code: RESPONSE_ALREADY_FINISHED_ERROR_CODE },
      },
    });

    await queue.processQueue();

    expect(apiMock.updateResponse).toHaveBeenCalledTimes(1);
    expect(queue.queue).toHaveLength(0);
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseAlreadyCompleted
    );
  });

  test("processQueue treats 409 as already-completed and drops the item", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);
    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: { code: "bad_request", message: "conflict", status: 409 },
    });

    await queue.processQueue();

    expect(apiMock.updateResponse).toHaveBeenCalledTimes(1);
    expect(queue.queue).toHaveLength(0);
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseAlreadyCompleted
    );
  });

  test("processQueue drops other 4xx client errors without retry and surfaces a non-retryable code", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);
    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: { code: "bad_request", message: "Validation failed", status: 400 },
    });

    await queue.processQueue();

    expect(apiMock.updateResponse).toHaveBeenCalledTimes(1);
    expect(queue.queue).toHaveLength(0);
    // Non-retryable code (dropped item) — NOT ResponseSendingError, which would render a dead Retry CTA.
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseSendingErrorPermanent
    );
  });

  test("processQueue keeps retrying 404 (not treated as terminal) and leaves item in queue", async () => {
    surveyState.responseId = "resp1";
    queue.queue.push(responseUpdate);
    apiMock.updateResponse.mockResolvedValue({
      ok: false,
      error: { code: "not_found", message: "Response not found", status: 404 },
    });

    await queue.processQueue();

    expect(apiMock.updateResponse).toHaveBeenCalledTimes(config.retryAttempts); // retried, not dropped on first 4xx
    expect(queue.queue).toHaveLength(1);
    expect(config.onResponseSendingFailed).toHaveBeenCalledWith(
      responseUpdate,
      TResponseErrorCodesEnum.ResponseSendingError
    );
  }, 10000);

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
    expect(queue.queue).toHaveLength(0);
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

  test("add processes the in-memory queue when IndexedDB persistence rejects", async () => {
    const { addPendingResponse } = await import("./offline-storage");
    const error = new Error("quota exceeded");
    vi.mocked(addPendingResponse).mockRejectedValueOnce(error);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const processSpy = vi.spyOn(offlineQueue, "processQueue").mockResolvedValue({ success: true });

    offlineQueue.add(responseUpdate);
    await flushPromises();

    expect(processSpy).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to persist pending response to IndexedDB",
      expect.objectContaining({ error, surveyId: "s1" })
    );
  });

  test("add processes the in-memory queue when IndexedDB persistence is unavailable", async () => {
    const { addPendingResponse } = await import("./offline-storage");
    vi.mocked(addPendingResponse).mockResolvedValueOnce(-1);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const processSpy = vi.spyOn(offlineQueue, "processQueue").mockResolvedValue({ success: true });

    offlineQueue.add(responseUpdate);
    await flushPromises();

    expect(processSpy).toHaveBeenCalled();
    expect(offlineQueue["pendingDbIds"].has(responseUpdate)).toBe(false);
  });

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

  test("processQueue bails out when counting IndexedDB entries rejects", async () => {
    const { countPendingResponsesStrict } = await import("./offline-storage");
    const error = new Error("count failed");
    vi.mocked(countPendingResponsesStrict).mockRejectedValueOnce(error);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push(responseUpdate);
    const sendSpy = vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));

    const result = await offlineQueue.processQueue();

    expect(result.success).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to count pending responses in IndexedDB",
      expect.objectContaining({ error, surveyId: "s1" })
    );
  });

  test("processQueue defers to sync when multiple IDB entries exist", async () => {
    const { countPendingResponsesStrict } = await import("./offline-storage");
    vi.mocked(countPendingResponsesStrict).mockResolvedValue(3);

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

  test("processQueue logs rejected background sync attempts", async () => {
    const { countPendingResponsesStrict } = await import("./offline-storage");
    const error = new Error("sync failed");
    vi.mocked(countPendingResponsesStrict).mockResolvedValueOnce(3);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push({ data: { q1: "answer" }, finished: false });
    vi.spyOn(offlineQueue, "syncPersistedResponses").mockRejectedValueOnce(error);

    const result = await offlineQueue.processQueue();
    await flushPromises();

    expect(result.success).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to sync persisted responses in background",
      expect.objectContaining({ error, surveyId: "s1" })
    );
  });

  test("processQueue bails out if syncPersistedResponses starts during countPendingResponsesStrict await", async () => {
    const { countPendingResponsesStrict } = await import("./offline-storage");
    // Simulate syncPersistedResponses starting during the async gap
    vi.mocked(countPendingResponsesStrict).mockImplementation(async () => {
      // While countPendingResponsesStrict is resolving, isSyncing becomes true
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
    const { countPendingResponsesStrict } = await import("./offline-storage");
    vi.mocked(countPendingResponsesStrict).mockResolvedValue(1);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push({ data: { q1: "answer" }, finished: false });

    vi.spyOn(offlineQueue as any, "sendResponseWithRetry").mockImplementation(async () => {
      offlineQueue.queue.shift();
      return { success: true };
    });

    const result = await offlineQueue.processQueue();
    expect(result.success).toBe(true);
  });

  test("processQueue keeps pendingDbIds until IndexedDB removal resolves", async () => {
    const { countPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    vi.mocked(countPendingResponsesStrict).mockResolvedValueOnce(1);

    let resolveRemove!: () => void;
    vi.mocked(removePendingResponseStrict).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRemove = resolve;
        })
    );

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push(responseUpdate);
    offlineQueue["pendingDbIds"].set(responseUpdate, 10);
    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));

    const resultPromise = offlineQueue.processQueue();
    await flushPromises();

    expect(removePendingResponseStrict).toHaveBeenCalledWith(10);
    expect(offlineQueue["pendingDbIds"].has(responseUpdate)).toBe(true);

    resolveRemove();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(offlineQueue["pendingDbIds"].has(responseUpdate)).toBe(false);
  });

  test("processQueue keeps pendingDbIds and clears request lock when IndexedDB removal rejects", async () => {
    const { countPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    const error = new Error("delete failed");
    vi.mocked(countPendingResponsesStrict).mockResolvedValueOnce(1);
    vi.mocked(removePendingResponseStrict).mockRejectedValueOnce(error);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push(responseUpdate);
    offlineQueue["pendingDbIds"].set(responseUpdate, 10);
    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));

    const result = await offlineQueue.processQueue();

    expect(result.success).toBe(true);
    expect(offlineQueue["pendingDbIds"].has(responseUpdate)).toBe(true);
    expect(_syncLocks.getRequestInProgress("s1")).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to remove sent response from IndexedDB",
      expect.objectContaining({ error, surveyId: "s1" })
    );
  });

  test("processQueue ignores already-sent rows while IndexedDB cleanup is pending", async () => {
    const { countPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    const firstUpdate = { ...responseUpdate, data: { step: "first" } };
    const secondUpdate = { ...responseUpdate, data: { step: "second" } };
    const error = new Error("delete failed");

    vi.mocked(countPendingResponsesStrict).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    vi.mocked(removePendingResponseStrict)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const sendSpy = vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));
    const syncSpy = vi.spyOn(offlineQueue, "syncPersistedResponses");

    offlineQueue.queue.push(firstUpdate);
    offlineQueue["pendingDbIds"].set(firstUpdate, 10);
    await offlineQueue.processQueue();

    offlineQueue.queue.push(secondUpdate);
    offlineQueue["pendingDbIds"].set(secondUpdate, 11);
    const result = await offlineQueue.processQueue();

    expect(result.success).toBe(true);
    expect(syncSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy).toHaveBeenNthCalledWith(1, firstUpdate);
    expect(sendSpy).toHaveBeenNthCalledWith(2, secondUpdate);
    expect(removePendingResponseStrict).toHaveBeenNthCalledWith(2, 10);
    expect(removePendingResponseStrict).toHaveBeenNthCalledWith(3, 11);
  });

  test("loadPersistedQueue returns 0 when persistOffline is disabled", async () => {
    const count = await queue.loadPersistedQueue();
    expect(count).toBe(0);
  });

  test("loadPersistedQueue delegates to countPendingResponsesStrict", async () => {
    const { countPendingResponsesStrict } = await import("./offline-storage");
    vi.mocked(countPendingResponsesStrict).mockResolvedValue(3);
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    const count = await offlineQueue.loadPersistedQueue();
    expect(count).toBe(3);
    expect(countPendingResponsesStrict).toHaveBeenCalledWith("s1");
  });

  test("getPendingCount returns 0 when counting IndexedDB entries rejects", async () => {
    const { countPendingResponsesStrict } = await import("./offline-storage");
    const error = new Error("count failed");
    vi.mocked(countPendingResponsesStrict).mockRejectedValueOnce(error);
    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );

    const count = await offlineQueue.getPendingCount();

    expect(count).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to count pending responses in IndexedDB",
      expect.objectContaining({ error, surveyId: "s1" })
    );
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

  test("syncPersistedResponses returns failure when reading IndexedDB rejects", async () => {
    const { getPendingResponsesStrict } = await import("./offline-storage");
    const error = new Error("read failed");
    vi.mocked(getPendingResponsesStrict).mockRejectedValueOnce(error);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );

    const result = await offlineQueue.syncPersistedResponses();

    expect(result).toEqual({ success: false, syncedCount: 0 });
    expect(_syncLocks.get("s1")).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to sync persisted responses from IndexedDB",
      expect.objectContaining({ error, surveyId: "s1" })
    );
  });

  test("syncPersistedResponses sends entries and clears queue on success", async () => {
    const { getPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    vi.mocked(getPendingResponsesStrict).mockResolvedValue([
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
    offlineQueue["pendingDbIds"].set(responseUpdate, 10);

    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));

    const result = await offlineQueue.syncPersistedResponses();
    expect(result).toEqual({ success: true, syncedCount: 1 });
    expect(removePendingResponseStrict).toHaveBeenCalledWith(10);
    expect(offlineQueue.queue).toHaveLength(0);
    expect(_syncLocks.get("s1")).toBe(false);
  });

  test("syncPersistedResponses removes synced queue items by IndexedDB id", async () => {
    const { getPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    const inFlightUpdate = { ...responseUpdate, data: { step: "in-flight" } };
    const syncedUpdate = { ...responseUpdate, data: { step: "synced" } };

    vi.mocked(getPendingResponsesStrict).mockResolvedValueOnce([
      {
        id: 10,
        surveyId: "s1",
        responseUpdate: syncedUpdate,
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
    offlineQueue.queue.push(inFlightUpdate, syncedUpdate);
    offlineQueue["pendingDbIds"].set(syncedUpdate, 10);

    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));
    vi.spyOn(offlineQueue, "processQueue").mockResolvedValue({ success: false });

    const result = await offlineQueue.syncPersistedResponses();

    expect(result).toEqual({ success: true, syncedCount: 1 });
    expect(removePendingResponseStrict).toHaveBeenCalledWith(10);
    expect(offlineQueue.queue).toEqual([inFlightUpdate]);
    expect(offlineQueue["pendingDbIds"].has(syncedUpdate)).toBe(false);
  });

  test("syncPersistedResponses returns failure when removing a synced IndexedDB entry rejects", async () => {
    const { getPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    const error = new Error("delete failed");
    vi.mocked(getPendingResponsesStrict).mockResolvedValueOnce([
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
    vi.mocked(removePendingResponseStrict).mockRejectedValueOnce(error);

    const offlineQueue = new ResponseQueue(
      getConfig({ persistOffline: true, surveyId: "s1" }),
      getSurveyState()
    );
    offlineQueue.queue.push(responseUpdate);
    offlineQueue["pendingDbIds"].set(responseUpdate, 10);
    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(ok(true));

    const result = await offlineQueue.syncPersistedResponses();

    expect(result).toEqual({ success: false, syncedCount: 0 });
    expect(offlineQueue.queue).toHaveLength(0);
    expect(_syncLocks.get("s1")).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Formbricks: Failed to remove synced response from IndexedDB",
      expect.objectContaining({ error, surveyId: "s1" })
    );
  });

  test("syncPersistedResponses stops on server error", async () => {
    const { getPendingResponsesStrict } = await import("./offline-storage");
    vi.mocked(getPendingResponsesStrict).mockResolvedValue([
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
    const { getPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    vi.mocked(getPendingResponsesStrict).mockResolvedValue([
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
    expect(removePendingResponseStrict).toHaveBeenCalledWith(10);
    // responseId should have been reset to null for the retry
    expect(offlineState.responseId).toBeNull();
  });

  test("syncPersistedResponses removes terminal 409 entries and continues", async () => {
    const { getPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    vi.mocked(getPendingResponsesStrict).mockResolvedValue([
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
    expect(removePendingResponseStrict).toHaveBeenCalledWith(10);
    expect(removePendingResponseStrict).toHaveBeenCalledWith(11);
  });

  test("syncPersistedResponses keeps recoverable 4xx entries", async () => {
    const { getPendingResponsesStrict, removePendingResponseStrict } = await import("./offline-storage");
    vi.mocked(getPendingResponsesStrict).mockResolvedValueOnce([
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
    offlineQueue.queue.push(responseUpdate);
    offlineQueue["pendingDbIds"].set(responseUpdate, 10);

    vi.spyOn(offlineQueue, "sendResponse").mockResolvedValue(
      err({ code: "unauthorized", message: "unauthorized", status: 401 })
    );

    const result = await offlineQueue.syncPersistedResponses();

    expect(result).toEqual({ success: false, syncedCount: 0 });
    expect(removePendingResponseStrict).not.toHaveBeenCalledWith(10);
    expect(offlineQueue.queue).toEqual([responseUpdate]);
    expect(offlineQueue["pendingDbIds"].get(responseUpdate)).toBe(10);
    expect(_syncLocks.get("s1")).toBe(false);
  });
});
