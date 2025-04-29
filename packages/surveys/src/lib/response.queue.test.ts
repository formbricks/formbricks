import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { TResponseUpdate } from "@formbricks/types/responses";
import { ResponseQueue, delay } from "./response-queue";
import { SurveyState } from "./survey-state";

vi.mock("./api-client", () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    updateResponse: vi.fn(),
    createResponse: vi.fn(),
  })),
}));

const getSurveyState: () => SurveyState = () => ({
  responseId: null,
  displayId: "display1",
  userId: "user1",
  contactId: "contact1",
  surveyId: "survey1",
  singleUseId: "single1",
  responseAcc: { finished: false, data: {}, ttc: {}, variables: {} },
  updateResponseId: vi.fn(),
  updateDisplayId: vi.fn(),
  updateUserId: vi.fn(),
  updateContactId: vi.fn(),
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
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
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
    vi.spyOn(queue, "processQueue").mockImplementation(() => Promise.resolve());
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
    apiMock.updateResponse.mockResolvedValue(undefined);
    const result = await queue.sendResponse(responseUpdate);
    expect(apiMock.updateResponse).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  test("sendResponse calls createResponse if no responseId, updates responseId", async () => {
    apiMock.createResponse.mockResolvedValue({ ok: true, data: { id: "newid" } });
    const result = await queue.sendResponse(responseUpdate);
    expect(apiMock.createResponse).toHaveBeenCalled();
    expect(surveyState.updateResponseId).toHaveBeenCalledWith("newid");
    expect(config.setSurveyState).toHaveBeenCalledWith(surveyState);
    expect(result.ok).toBe(true);
  });

  test("sendResponse returns err if createResponse fails", async () => {
    apiMock.createResponse.mockResolvedValue({ ok: false, error: { code: "internal_server_error" } });
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
});
