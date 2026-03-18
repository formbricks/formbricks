import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { getTranslate } from "@/lingodotdev/server";
import { isDiscordWebhook } from "@/modules/integrations/webhooks/lib/utils";
import { testEndpoint } from "./webhook";

vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  generateStandardWebhookSignature: vi.fn(() => "signed-payload"),
  generateWebhookSecret: vi.fn(() => "generated-secret"),
}));

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateWebhookUrl: vi.fn(async () => undefined),
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(async () => (key: string) => key),
}));

vi.mock("@/modules/integrations/webhooks/lib/utils", () => ({
  isDiscordWebhook: vi.fn(() => false),
}));

vi.mock("uuid", () => ({
  v7: vi.fn(() => "webhook-message-id"),
}));

describe("testEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test.each([
    [500, "environments.integrations.webhooks.endpoint_internal_server_error"],
    [404, "environments.integrations.webhooks.endpoint_not_found_error"],
    [405, "environments.integrations.webhooks.endpoint_method_not_allowed_error"],
    [502, "environments.integrations.webhooks.endpoint_bad_gateway_error"],
    [503, "environments.integrations.webhooks.endpoint_service_unavailable_error"],
    [504, "environments.integrations.webhooks.endpoint_gateway_timeout_error"],
  ])("throws a translated InvalidInputError for blocked status %s", async (statusCode, messageKey) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: statusCode,
      }))
    );

    await expect(testEndpoint("https://example.com/webhook", "secret")).rejects.toThrow(
      new InvalidInputError(messageKey)
    );

    expect(validateWebhookUrl).toHaveBeenCalledWith("https://example.com/webhook");
    expect(generateStandardWebhookSignature).toHaveBeenCalled();
    expect(getTranslate).toHaveBeenCalled();
  });

  test("allows non-blocked non-2xx statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 418,
      }))
    );

    await expect(testEndpoint("https://example.com/webhook")).resolves.toBe(true);
    expect(getTranslate).not.toHaveBeenCalled();
  });

  test("rejects Discord webhooks before sending the request", async () => {
    vi.mocked(isDiscordWebhook).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(testEndpoint("https://discord.com/api/webhooks/123")).rejects.toThrow(
      "Discord webhooks are currently not supported."
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("throws a timeout error when the request is aborted", async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        const signal = init?.signal as AbortSignal;

        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            const abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        });
      })
    );

    const requestPromise = testEndpoint("https://example.com/webhook");
    const assertion = expect(requestPromise).rejects.toThrow("Request timed out after 5 seconds");

    await vi.advanceTimersByTimeAsync(5000);

    await assertion;
  });

  test("wraps unexpected fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("socket hang up")))
    );

    await expect(testEndpoint("https://example.com/webhook")).rejects.toThrow(
      "Error while fetching the URL: socket hang up"
    );
  });
});
