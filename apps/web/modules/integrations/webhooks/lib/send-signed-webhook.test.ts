import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { createPinnedDispatcher, validateAndResolveWebhookUrl } from "@/lib/utils/validate-webhook-url";
import {
  WebhookDeliveryTimeoutError,
  getWebhookUrlHost,
  sendSignedWebhookRequest,
} from "./send-signed-webhook";

const constantsMock = vi.hoisted(() => ({ dangerouslyAllow: false }));

vi.mock("@/lib/constants", () => ({
  get DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS() {
    return constantsMock.dangerouslyAllow;
  },
  WEBHOOK_DELIVERY_TIMEOUT_MS: 5000,
}));

vi.mock("@/lib/crypto", () => ({
  generateStandardWebhookSignature: vi.fn(() => "v1,signed"),
}));

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateAndResolveWebhookUrl: vi.fn(),
  createPinnedDispatcher: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const URL = "https://hooks.example.com/in/abc?token=capability-token";
const BODY = JSON.stringify({ event: "responseFinished", data: { answer: 42 } });
const MESSAGE_ID = "a".repeat(64);

const createDispatcher = () => ({ destroy: vi.fn(async () => undefined) });

const stubFetch = (impl: (url: string, init: RequestInit) => Promise<unknown>) => {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

/** A fetch that never resolves on its own and rejects with the abort reason when the signal fires. */
const stubHangingFetch = (rejectWith?: (signal: AbortSignal) => Error) =>
  stubFetch(
    (_url, init) =>
      new Promise((_, reject) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () => reject(rejectWith ? rejectWith(signal) : signal.reason));
      })
  );

describe("sendSignedWebhookRequest", () => {
  let dispatcher: ReturnType<typeof createDispatcher>;

  beforeEach(() => {
    vi.resetAllMocks();
    constantsMock.dangerouslyAllow = false;
    dispatcher = createDispatcher();
    vi.mocked(validateAndResolveWebhookUrl).mockResolvedValue({ ip: "93.184.216.34", family: 4 });
    vi.mocked(createPinnedDispatcher).mockReturnValue(dispatcher as never);
    vi.mocked(generateStandardWebhookSignature).mockReturnValue("v1,signed");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("validates, pins, signs and POSTs the exact body with Standard Webhooks headers", async () => {
    const fetchMock = stubFetch(async () => ({ status: 200 }));

    const result = await sendSignedWebhookRequest({
      url: URL,
      body: BODY,
      messageId: MESSAGE_ID,
      secret: "whsec",
    });

    expect(result).toEqual({ statusCode: 200 });
    expect(validateAndResolveWebhookUrl).toHaveBeenCalledWith(URL);
    expect(createPinnedDispatcher).toHaveBeenCalledWith({ ip: "93.184.216.34", family: 4 });
    // The signature covers the exact bytes we send; the timestamp is the unix second of the send.
    expect(generateStandardWebhookSignature).toHaveBeenCalledWith(MESSAGE_ID, 1_788_264_000, BODY, "whsec");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({
        method: "POST",
        body: BODY,
        redirect: "manual",
        dispatcher,
        headers: {
          "content-type": "application/json",
          "webhook-id": MESSAGE_ID,
          "webhook-timestamp": "1788264000",
          "webhook-signature": "v1,signed",
        },
      })
    );
    expect(dispatcher.destroy).toHaveBeenCalledTimes(1);
  });

  test("sends unsigned when the webhook has no secret", async () => {
    const fetchMock = stubFetch(async () => ({ status: 204 }));

    await sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID, secret: null });

    expect(generateStandardWebhookSignature).not.toHaveBeenCalled();
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty("webhook-signature");
    expect(headers["webhook-id"]).toBe(MESSAGE_ID);
  });

  test.each([302, 404, 429, 500])("returns status %s to the caller instead of throwing", async (status) => {
    stubFetch(async () => ({ status }));

    await expect(sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID })).resolves.toEqual({
      statusCode: status,
    });
    expect(dispatcher.destroy).toHaveBeenCalledTimes(1);
  });

  test("never fetches when URL validation rejects, and propagates the InvalidInputError", async () => {
    const rejection = new InvalidInputError("Webhook URL must not point to private or internal IP addresses");
    vi.mocked(validateAndResolveWebhookUrl).mockRejectedValue(rejection);
    const fetchMock = stubFetch(async () => ({ status: 200 }));

    await expect(sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID })).rejects.toBe(
      rejection
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createPinnedDispatcher).not.toHaveBeenCalled();
  });

  test("follows redirects and skips pinning when internal URLs are allowed and validation returns no address", async () => {
    constantsMock.dangerouslyAllow = true;
    vi.mocked(validateAndResolveWebhookUrl).mockResolvedValue(null);
    const fetchMock = stubFetch(async () => ({ status: 200 }));

    await sendSignedWebhookRequest({ url: "http://localhost:4000/hook", body: BODY, messageId: MESSAGE_ID });

    expect(createPinnedDispatcher).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/hook",
      expect.objectContaining({ redirect: "follow", dispatcher: undefined })
    );
  });

  test("destroys the pinned dispatcher and rethrows when fetch fails at the network level", async () => {
    const networkError = new TypeError("fetch failed");
    stubFetch(async () => Promise.reject(networkError));

    await expect(sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID })).rejects.toBe(
      networkError
    );
    expect(dispatcher.destroy).toHaveBeenCalledTimes(1);
  });

  test("aborts after the default timeout with a typed WebhookDeliveryTimeoutError", async () => {
    stubHangingFetch();

    const assertion = expect(
      sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID })
    ).rejects.toBeInstanceOf(WebhookDeliveryTimeoutError);

    await vi.advanceTimersByTimeAsync(4999);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(dispatcher.destroy).toHaveBeenCalledTimes(1);
  });

  test("reports a timeout even when the fetch implementation throws its own AbortError", async () => {
    stubHangingFetch(() => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      return abortError;
    });

    const assertion = expect(
      sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID })
    ).rejects.toMatchObject({ name: "WebhookDeliveryTimeoutError", timeoutMs: 5000 });

    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  test("honors a caller-provided timeout", async () => {
    const fetchMock = stubHangingFetch();

    const promise = sendSignedWebhookRequest({
      url: URL,
      body: BODY,
      messageId: MESSAGE_ID,
      timeoutMs: 1000,
    });
    const assertion = expect(promise).rejects.toMatchObject({ timeoutMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  test("logs dispatcher cleanup failures with the host only and still returns the outcome", async () => {
    dispatcher.destroy.mockRejectedValueOnce(new Error("socket already closed"));
    stubFetch(async () => ({ status: 200 }));

    await expect(sendSignedWebhookRequest({ url: URL, body: BODY, messageId: MESSAGE_ID })).resolves.toEqual({
      statusCode: 200,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrlHost: "hooks.example.com" }),
      "Webhook request dispatcher cleanup failed"
    );
    // The capability token in the query string must never reach a log line.
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("capability-token");
  });
});

describe("getWebhookUrlHost", () => {
  test("returns host including port and drops path, query and credentials", () => {
    expect(getWebhookUrlHost("https://user:pw@hooks.example.com:8443/in/abc?token=x")).toBe(
      "hooks.example.com:8443"
    );
  });

  test("returns undefined for an unparseable URL", () => {
    expect(getWebhookUrlHost("not a url")).toBeUndefined();
  });
});
