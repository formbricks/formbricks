import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobExecutionContext, TWebhookDeliveryJobData } from "@formbricks/jobs";
import { InvalidInputError } from "@formbricks/types/errors";
import { WebhookDnsResolutionError } from "@/lib/utils/validate-webhook-url";
import {
  WebhookDeliveryTimeoutError,
  sendSignedWebhookRequest,
} from "@/modules/integrations/webhooks/lib/send-signed-webhook";
import { buildWebhookDeliveryBody, processWebhookDeliveryJob } from "./process-webhook-delivery-job";
import { recordWebhookDeliveryOutcome } from "./webhook-delivery-metrics";

const { mockFindUnique, mockLoggerError, mockLoggerInfo, mockLoggerWarn } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { webhook: { findUnique: mockFindUnique } },
}));

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
  workspaceId: "workspace_123",
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

    expect(buildWebhookDeliveryBody(data)).toBe(legacyBody);
  });
});

describe("processWebhookDeliveryJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ ...target, surveyIds: [] });
  });

  test("re-reads url and secret, delivers with the fan-out webhook-id, and records the outcome", async () => {
    mockSend.mockResolvedValue({ statusCode: 200 });

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "webhook_123" },
      select: { url: true, secret: true, workspaceId: true, triggers: true, surveyIds: true },
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
    mockFindUnique.mockResolvedValue({ ...target, secret: null });
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
    mockFindUnique.mockResolvedValue(null);

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
    ["the row belongs to another workspace", { workspaceId: "workspace_other" }],
  ])("completes without a request when %s", async (_label, overrides) => {
    mockFindUnique.mockResolvedValue({ ...target, ...overrides });

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

  test("still delivers when the webhook is scoped to a survey list that includes this survey", async () => {
    mockFindUnique.mockResolvedValue({ ...target, surveyIds: ["survey_999", "survey_123"] });
    mockSend.mockResolvedValue({ statusCode: 200 });

    await expect(processWebhookDeliveryJob(data, createContext())).resolves.toBeUndefined();

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test("rethrows database pool exhaustion so BullMQ retries, with a warning", async () => {
    const poolError = new Error("Timed out fetching a new connection from the connection pool");
    mockFindUnique.mockRejectedValue(poolError);

    await expect(processWebhookDeliveryJob(data, createContext())).rejects.toBe(poolError);

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordOutcome).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ err: poolError, webhookId: "webhook_123" }),
      "Webhook delivery hit database pool exhaustion and will be retried"
    );
  });

  test("rethrows other database errors so BullMQ retries", async () => {
    const dbError = new Error("connection refused");
    mockFindUnique.mockRejectedValue(dbError);

    await expect(processWebhookDeliveryJob(data, createContext())).rejects.toBe(dbError);

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: dbError }),
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
