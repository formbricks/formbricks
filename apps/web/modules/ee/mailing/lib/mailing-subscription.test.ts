import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { subscribeToMailingList, subscribeUserToMailingList } from "./mailing-subscription";

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

globalThis.fetch = vi.fn();

describe("subscribeToMailingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should successfully subscribe to security mailing list", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await subscribeToMailingList({
      email: "test@example.com",
      listId: "security",
    });

    expect(result).toEqual({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ee.formbricks.com/api/v1/public/mailing/security/subscriptions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      { listId: "security" },
      "Successfully subscribed to security mailing list"
    );
  });

  test("should successfully subscribe to product-updates mailing list", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await subscribeToMailingList({
      email: "test@example.com",
      listId: "product-updates",
    });

    expect(result).toEqual({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ee.formbricks.com/api/v1/public/mailing/product-updates/subscriptions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      })
    );
  });

  test("should return error when API returns non-ok response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );

    const result = await subscribeToMailingList({
      email: "test@example.com",
      listId: "security",
    });

    expect(result).toEqual({ success: false, error: "Failed to subscribe: 400" });
    expect(logger.error).toHaveBeenCalledWith(
      { status: 400, error: "Bad Request" },
      "Failed to subscribe to security mailing list"
    );
  });

  test("should return error when fetch throws an error", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await subscribeToMailingList({
      email: "test@example.com",
      listId: "security",
    });

    expect(result).toEqual({ success: false, error: "Failed to subscribe to mailing list" });
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      "Error subscribing to security mailing list"
    );
  });

  test("should return timeout error when request times out", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(abortError);

    const result = await subscribeToMailingList({
      email: "test@example.com",
      listId: "security",
    });

    expect(result).toEqual({ success: false, error: "Request timed out" });
    expect(logger.error).toHaveBeenCalledWith(
      { listId: "security" },
      "Mailing subscription request timed out"
    );
  });
});

describe("subscribeUserToMailingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should subscribe to product-updates when isFormbricksCloud is true and subscribeToProductUpdates is true", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await subscribeUserToMailingList({
      email: "test@example.com",
      isFormbricksCloud: true,
      subscribeToProductUpdates: true,
      subscribeToSecurityUpdates: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ee.formbricks.com/api/v1/public/mailing/product-updates/subscriptions",
      expect.any(Object)
    );
  });

  test("should not subscribe when isFormbricksCloud is true but subscribeToProductUpdates is false", async () => {
    await subscribeUserToMailingList({
      email: "test@example.com",
      isFormbricksCloud: true,
      subscribeToProductUpdates: false,
      subscribeToSecurityUpdates: true,
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("should subscribe to security when isFormbricksCloud is false and subscribeToSecurityUpdates is true", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await subscribeUserToMailingList({
      email: "test@example.com",
      isFormbricksCloud: false,
      subscribeToSecurityUpdates: true,
      subscribeToProductUpdates: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ee.formbricks.com/api/v1/public/mailing/security/subscriptions",
      expect.any(Object)
    );
  });

  test("should not subscribe when isFormbricksCloud is false but subscribeToSecurityUpdates is false", async () => {
    await subscribeUserToMailingList({
      email: "test@example.com",
      isFormbricksCloud: false,
      subscribeToSecurityUpdates: false,
      subscribeToProductUpdates: true,
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("should not subscribe when both subscription flags are undefined", async () => {
    await subscribeUserToMailingList({
      email: "test@example.com",
      isFormbricksCloud: true,
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("should prioritize product-updates for cloud users even if security is also true", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    await subscribeUserToMailingList({
      email: "test@example.com",
      isFormbricksCloud: true,
      subscribeToProductUpdates: true,
      subscribeToSecurityUpdates: true,
    });

    // Should only call product-updates endpoint for cloud users
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ee.formbricks.com/api/v1/public/mailing/product-updates/subscriptions",
      expect.any(Object)
    );
  });
});
