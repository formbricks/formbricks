import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobExecutionContext, TWebhookDeliveryJobData } from "@formbricks/jobs";
import { InvalidInputError } from "@formbricks/types/errors";
import { WebhookDnsResolutionError } from "@/lib/utils/validate-webhook-url";
import {
  WebhookDeliveryTimeoutError,
  sendSignedWebhookRequest,
} from "@/modules/integrations/webhooks/lib/send-signed-webhook";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { buildWebhookDeliveryBody, processWebhookDeliveryJob } from "./process-webhook-delivery-job";
import { recordWebhookDeliveryOutcome } from "./webhook-delivery-metrics";

const {
  mockFindFirst,
  mockSurveyFindUnique,
  mockVisibilityReady,
  mockLoggerError,
  mockLoggerInfo,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSurveyFindUnique: vi.fn(),
  mockVisibilityReady: vi.fn(async () => false),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { survey: { findUnique: mockSurveyFindUnique }, webhook: { findFirst: mockFindFirst } },
}));

vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: mockVisibilityReady }));

vi.mock("@formbricks/jobs", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnrecoverableError";
    }
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), error: mockLoggerError, info: mockLoggerInfo, warn: mockLoggerWarn },
}));

// Keep the real error classes (the handler classifies by instanceof); replace only the network call.
vi.mock(import("@/modules/integrations/webhooks/lib/send-signed-webhook"), async (importOriginal) => ({
  ...(await importOriginal()),
  sendSignedWebhookRequest: vi.fn(),
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value: unknown) => ({ resolved: value })),
}));

vi.mock("./webhook-delivery-metrics", () => ({
  recordWebhookDeliveryOutcome: vi.fn(),
}));

const mockSend = vi.mocked(sendSignedWebhookRequest);
const mockRecordOutcome = vi.mocked(recordWebhookDeliveryOutcome);

const data: TWebhookDeliveryJobData = {
  webhookId: "webhook_123",
  workspaceId: "workspace_123",
  surveyId: "survey_123",
  event: "responseFinished",
  webhookMessageId: "b".repeat(64),
  response: {
    contact: null,
    contactAttributes: null,
    createdAt: new Date("2026-04-08T10:00:00.000Z"),
    data: { answer: "sensitive answer" },
    displayId: null,
    endingId: null,
    finished: true,
    id: "response_123",
    language: null,
    meta: {},
    singleUseId: null,
    surveyId: "survey_123",
    tags: [],
    updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    variables: {},
  },
  survey: {
    name: "Onboarding NPS",
    type: "link",
    status: "inProgress",
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
  },
};

const target = {
  url: "https://hooks.example.com/in/abc?token=capability-token",
  secret: "whsec_test",
  triggers: ["responseFinished", "responseCreated"],
  surveyIds: [] as string[],
};

const createContext = (overrides: Partial<JobExecutionContext> = {}): JobExecutionContext => ({
  attempt: 1,
  jobId: "whd-parent-1-webhook_123",
  jobName: "webhook-delivery.process",
  maxAttempts: 5,
  queueName: "background-jobs",
  ...overrides,
});

const allLogCalls = () =>
  JSON.stringify([...mockLoggerInfo.mock.calls, ...mockLoggerWarn.mock.calls, ...mockLoggerError.mock.calls]);

describe("buildWebhookDeliveryBody", () => {
  test("produces byte-for-byte the pre-fan-out body shape", () => {
    // The legacy pipeline body, written out independently so a drift in either key order or field set
    // fails here rather than at a receiver's signature check.
    const legacyBody = JSON.stringify({
      webhookId: "webhook_123",
      event: "responseFinished",
      data: {
        ...data.response,
        data: { resolved: { answer: "sensitive answer" } },
        survey: {
          title: "Onboarding NPS",
          type: "link",
          status: "inProgress",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-07T00:00:00.000Z"),
        },
      },
    });

    // `outcome` is the one addition (ENG-6780): the fixture predates the column, so the body carries it
    // as null. Everything else is untouched.
    expect(JSON.parse(buildWebhookDeliveryBody(data))).toEqual({
      ...JSON.parse(legacyBody),
      data: { ...JSON.parse(legacyBody).data, outcome: null },
    });
  });

  // Always present inside the response object, next to `data`: a receiver must be able to read it
  // without first checking the key exists, and a job queued before the column existed has no key.
  test("carries the outcome as null when the snapshot has none", () => {
    const body = JSON.parse(buildWebhookDeliveryBody(data));

    expect(Object.keys(body.data)).toContain("outcome");
    expect(body.data.outcome).toBeNull();
  });

  test.each([null, "lowQuality"] as const)("carries the stored outcome %s", (outcome) => {
    const body = JSON.parse(buildWebhookDeliveryBody({ ...data, response: { ...data.response, outcome } }));

    expect(body.data.outcome).toBe(outcome);
  });
});

describe("buildWebhookDeliveryBody dataByQuestionCode", () => {
  const withData = (
    responseData: Record<string, unknown>,
    questionCodes: Record<string, string> | undefined
  ): TWebhookDeliveryJobData => ({
    ...data,
    response: { ...data.response, data: responseData as TWebhookDeliveryJobData["response"]["data"] },
    survey: { ...data.survey, questionCodes },
  });

  // Resolve like the real helper does for a file answer, so the map is proven to read the resolved data.
  const build = (input: TWebhookDeliveryJobData) => {
    vi.mocked(resolveStorageUrlsInObject).mockImplementationOnce((value) => {
      const copy = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
      if (typeof copy.file === "string") copy.file = `https://cdn.example.com/${copy.file}`;
      return copy as never;
    });
    return JSON.parse(buildWebhookDeliveryBody(input));
  };

  // A new response column would otherwise appear in every receiver's payload without anyone choosing it.
  test("pins the literal key list of body.data", () => {
    const body = build(withData({ el1: "a" }, { el1: "age" }));

    expect(Object.keys(body.data).sort()).toEqual(
      [
        "contact",
        "contactAttributes",
        "createdAt",
        "data",
        "dataByQuestionCode",
        "displayId",
        "endingId",
        "finished",
        "id",
        "language",
        "meta",
        "outcome",
        "singleUseId",
        "survey",
        "surveyId",
        "tags",
        "updatedAt",
        "variables",
      ].sort()
    );
  });

  test("keeps data keyed by Question ID and mirrors the same values under the question code", () => {
    const body = build(
      withData({ el1: "34", el2: ["a", "b"], el3: { x: 1 } }, { el1: "age", el2: "tags", el3: "grid" })
    );

    expect(body.data.data).toEqual({ el1: "34", el2: ["a", "b"], el3: { x: 1 } });
    expect(body.data.dataByQuestionCode).toEqual({ age: "34", tags: ["a", "b"], grid: { x: 1 } });
  });

  test("lists every coded question, null when nothing is stored", () => {
    const body = build(withData({ el1: "34" }, { el1: "age", el2: "skipped" }));

    expect(body.data.dataByQuestionCode).toEqual({ age: "34", skipped: null });
  });

  test("leaves out an answer whose question has no code, and hidden fields", () => {
    const body = build(withData({ el1: "34", nocode: "x", utm_source: "mail" }, { el1: "age" }));

    expect(body.data.dataByQuestionCode).toEqual({ age: "34" });
    expect(body.data.data.utm_source).toBe("mail");
  });

  test("a code equal to a hidden field name does not touch the hidden field in data", () => {
    const body = build(withData({ el1: "34", utm_source: "mail" }, { el1: "utm_source" }));

    expect(body.data.data).toEqual({ el1: "34", utm_source: "mail" });
    expect(body.data.dataByQuestionCode).toEqual({ utm_source: "34" });
  });

  test("resolves file URLs the same way as data", () => {
    const body = build(withData({ file: "a.png" }, { file: "upload" }));

    expect(body.data.data.file).toBe("https://cdn.example.com/a.png");
    expect(body.data.dataByQuestionCode.upload).toBe("https://cdn.example.com/a.png");
  });

  test.each(["constructor", "toString", "hasOwnProperty"])("accepts the code %s", (code) => {
    const body = build(withData({ el1: "34" }, { el1: code }));

    expect(Object.hasOwn(body.data.dataByQuestionCode, code)).toBe(true);
    expect(body.data.dataByQuestionCode[code]).toBe("34");
  });

  test("a job queued before question codes existed carries no dataByQuestionCode", () => {
    const body = build(withData({ el1: "34" }, undefined));

    expect("dataByQuestionCode" in body.data).toBe(false);
    expect(body.data.data).toEqual({ el1: "34" });
  });

  test("a survey with no coded question gets an empty object", () => {
    expect(build(withData({ el1: "34" }, {})).data.dataByQuestionCode).toEqual({});
  });
});

describe("processWebhookDeliveryJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSurveyFindUnique.mockResolvedValue({
      visibility: "workspace",
      visibilityVersion: 0,
      visibilityProjectedVersion: 0,
    });
    mockFindFirst.mockResolvedValue({ ...target, surveyIds: [] });
  });

  test("re-reads url and secret, delivers with the fan-out webhook-id, and records the outcome", async () => {
    mockSend.mockResolvedValue({ statusCode: 200 });

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    // Scoped in the query: a foreign workspace cannot return this webhook's URL or secret at all.
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "webhook_123", workspaceId: "workspace_123" },
      select: { url: true, secret: true, triggers: true, surveyIds: true },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      url: target.url,
      secret: "whsec_test",
      body: buildWebhookDeliveryBody(data),
      messageId: "b".repeat(64),
    });
    expect(mockRecordOutcome).toHaveBeenCalledWith({
      outcome: "delivered",
      event: "responseFinished",
      statusCode: 200,
      durationMs: expect.any(Number),
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "delivered",
        statusCode: 200,
        webhookId: "webhook_123",
        responseId: "response_123",
        webhookUrlHost: "hooks.example.com",
        attempt: 1,
        maxAttempts: 5,
      }),
      "Webhook delivered"
    );
  });

  test("uses the same webhook-id on every attempt of the job", async () => {
    mockSend.mockResolvedValue({ statusCode: 200 });

    await processWebhookDeliveryJob(data, createContext({ attempt: 1 }));
    await processWebhookDeliveryJob(data, createContext({ attempt: 3 }));

    const messageIds = mockSend.mock.calls.map(([input]) => input.messageId);
    expect(messageIds).toEqual(["b".repeat(64), "b".repeat(64)]);
  });

  test("sends unsigned when the webhook has no secret", async () => {
    mockFindFirst.mockResolvedValue({ ...target, secret: null });
    mockSend.mockResolvedValue({ statusCode: 200 });

    await processWebhookDeliveryJob(data, createContext());

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ secret: null }));
  });

  test.each([500, 502, 503, 429, 408, 302])(
    "status %s fails the attempt with a retryable error and a warning while attempts remain",
    async (statusCode) => {
      mockSend.mockResolvedValue({ statusCode });

      const promise = processWebhookDeliveryJob(data, createContext({ attempt: 2 }));

      await expect(promise).rejects.toThrow(`status ${statusCode}`);
      await expect(promise).rejects.not.toMatchObject({ name: "UnrecoverableError" });
      expect(mockRecordOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "retryable_failure", statusCode })
      );
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "retryable_failure", statusCode, attempt: 2, maxAttempts: 5 }),
        "Webhook delivery failed; retry scheduled"
      );
      expect(mockLoggerError).not.toHaveBeenCalled();
    }
  );

  test("logs at error level when the last attempt fails retryably", async () => {
    mockSend.mockResolvedValue({ statusCode: 503 });

    await expect(processWebhookDeliveryJob(data, createContext({ attempt: 5 }))).rejects.toThrow(
      "status 503"
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "retryable_failure", attempt: 5, maxAttempts: 5 }),
      "Webhook delivery failed; retries exhausted"
    );
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  test.each([400, 401, 403, 404, 410, 422])(
    "status %s is a permanent failure that BullMQ must not retry",
    async (statusCode) => {
      mockSend.mockResolvedValue({ statusCode });

      await expect(processWebhookDeliveryJob(data, createContext())).rejects.toMatchObject({
        name: "UnrecoverableError",
        message: expect.stringContaining(`status ${statusCode}`),
      });

      expect(mockRecordOutcome).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "permanent_failure", statusCode })
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "permanent_failure", statusCode }),
        "Webhook delivery failed permanently"
      );
    }
  );

  test("an SSRF policy rejection is permanent", async () => {
    mockSend.mockRejectedValue(
      new InvalidInputError("Webhook URL must not point to private or internal IP addresses")
    );

    await expect(processWebhookDeliveryJob(data, createContext())).rejects.toMatchObject({
      name: "UnrecoverableError",
      message: expect.stringContaining("private or internal IP addresses"),
    });
    expect(mockRecordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "permanent_failure", statusCode: undefined })
    );
  });

  test("a DNS resolution failure is retried, even though it is an InvalidInputError", async () => {
    mockSend.mockRejectedValue(new WebhookDnsResolutionError("Could not resolve webhook URL hostname: x"));

    const promise = processWebhookDeliveryJob(data, createContext());

    await expect(promise).rejects.toThrow("Could not resolve webhook URL hostname");
    await expect(promise).rejects.not.toMatchObject({ name: "UnrecoverableError" });
    expect(mockRecordOutcome).toHaveBeenCalledWith(expect.objectContaining({ outcome: "retryable_failure" }));
  });

  test.each([
    ["a timeout", new WebhookDeliveryTimeoutError(5000)],
    ["a network error", new TypeError("fetch failed")],
    ["a non-Error rejection", "socket hang up"],
  ])("%s is retried", async (_label, error) => {
    mockSend.mockRejectedValue(error);

    const promise = processWebhookDeliveryJob(data, createContext());

    await expect(promise).rejects.toThrow("delivery failed");
    await expect(promise).rejects.not.toMatchObject({ name: "UnrecoverableError" });
    expect(mockRecordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "retryable_failure", durationMs: expect.any(Number) })
    );
  });

  test("completes without a request when the webhook was deleted", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordOutcome).toHaveBeenCalledWith({ outcome: "skipped_deleted", event: "responseFinished" });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "skipped_deleted", webhookId: "webhook_123" }),
      "Webhook delivery skipped: webhook deleted"
    );
  });

  test.each([
    ["the event was unsubscribed", { triggers: ["responseCreated"] }],
    ["the webhook was re-scoped to other surveys", { surveyIds: ["survey_999"] }],
  ])("completes without a request when %s", async (_label, overrides) => {
    mockFindFirst.mockResolvedValue({ ...target, ...overrides });

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordOutcome).toHaveBeenCalledWith({
      outcome: "skipped_rescoped",
      event: "responseFinished",
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "skipped_rescoped" }),
      "Webhook delivery skipped: webhook no longer subscribed to this event"
    );
  });

  test("completes without a request when the survey was restricted after fan-out", async () => {
    mockFindFirst.mockResolvedValue(target);
    mockVisibilityReady.mockResolvedValueOnce(true);
    mockSurveyFindUnique.mockResolvedValue({
      visibility: "restricted",
      visibilityProjectedVersion: 1,
      visibilityVersion: 1,
    });

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordOutcome).toHaveBeenCalledWith({
      outcome: "skipped_not_visible",
      event: "responseFinished",
    });
  });

  test("completes without a request when the survey was deleted while the delivery was queued", async () => {
    mockFindFirst.mockResolvedValue(target);
    mockVisibilityReady.mockResolvedValueOnce(true);
    mockSurveyFindUnique.mockResolvedValue(null);

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordOutcome).toHaveBeenCalledWith({
      outcome: "skipped_not_visible",
      event: "responseFinished",
    });
  });

  test("treats a webhook that the workspace-scoped read cannot see as gone", async () => {
    // The scoped `where` returns nothing for another workspace's id, so this lands on the deleted path
    // rather than reaching a subscription check with a foreign row in hand.
    mockFindFirst.mockResolvedValue(null);

    await expect(
      processWebhookDeliveryJob({ ...data, workspaceId: "workspace_other" }, createContext())
    ).resolves.toBeUndefined();

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "webhook_123", workspaceId: "workspace_other" } })
    );
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordOutcome).toHaveBeenCalledWith({ outcome: "skipped_deleted", event: "responseFinished" });
  });

  test("still delivers when the webhook is scoped to a survey list that includes this survey", async () => {
    mockFindFirst.mockResolvedValue({ ...target, surveyIds: ["survey_999", "survey_123"] });
    mockSend.mockResolvedValue({ statusCode: 200 });

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test("rethrows database pool exhaustion so BullMQ retries, with a warning", async () => {
    const poolError = new Error("Timed out fetching a new connection from the connection pool");
    mockFindFirst.mockRejectedValue(poolError);

    await expect(processWebhookDeliveryJob(data, createContext())).rejects.toBe(poolError);

    expect(mockSend).not.toHaveBeenCalled();
    // Counted, so a delivery-failure alert cannot stay green through a database outage.
    expect(mockRecordOutcome).toHaveBeenCalledWith({ outcome: "load_failed", event: "responseFinished" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ err: poolError, webhookId: "webhook_123" }),
      "Webhook delivery hit database pool exhaustion and will be retried"
    );
  });

  test("announces the loss when the last attempt fails to read the webhook", async () => {
    // A load failure on attempt 5 drops the event exactly like an exhausted HTTP retry, so it has to
    // emit the message the Job Runner troubleshooting table tells operators to grep for.
    const poolError = new Error("Timed out fetching a new connection from the connection pool");
    mockFindFirst.mockRejectedValue(poolError);

    await expect(processWebhookDeliveryJob(data, createContext({ attempt: 5 }))).rejects.toBe(poolError);

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "load_failed", attempt: 5, maxAttempts: 5 }),
      "Webhook delivery failed; retries exhausted"
    );
    // and must not still promise a retry it will not get
    const logged = JSON.stringify([...mockLoggerWarn.mock.calls, ...mockLoggerError.mock.calls]);
    expect(logged).not.toContain("will be retried");
  });

  test("rethrows other database errors so BullMQ retries", async () => {
    const dbError = new Error("connection refused");
    mockFindFirst.mockRejectedValue(dbError);

    await expect(processWebhookDeliveryJob(data, createContext())).rejects.toBe(dbError);

    expect(mockRecordOutcome).toHaveBeenCalledWith({ outcome: "load_failed", event: "responseFinished" });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: dbError, outcome: "load_failed" }),
      "Webhook delivery could not load the webhook and will be retried"
    );
  });

  test("never logs the response payload, the secret, or the URL's capability token", async () => {
    mockSend.mockResolvedValue({ statusCode: 500 });

    await expect(processWebhookDeliveryJob(data, createContext({ attempt: 5 }))).rejects.toThrow();
    mockSend.mockResolvedValue({ statusCode: 200 });
    await processWebhookDeliveryJob(data, createContext());

    const logged = allLogCalls();
    expect(logged).not.toContain("sensitive answer");
    expect(logged).not.toContain("whsec_test");
    expect(logged).not.toContain("capability-token");
    expect(logged).toContain("hooks.example.com");
  });
});
