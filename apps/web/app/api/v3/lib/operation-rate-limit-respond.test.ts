import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { applyRateLimitOrRespond } from "./operation-rate-limit";

const applyRateLimit = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { withContext: vi.fn(() => ({ warn: vi.fn() })) } }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit }));

const CONFIG = { interval: 60, allowedPerInterval: 5, namespace: "action:test" };

describe("applyRateLimitOrRespond", () => {
  beforeEach(() => vi.clearAllMocks());

  test("lets the request through within the limit", async () => {
    applyRateLimit.mockResolvedValue(undefined);

    expect(await applyRateLimitOrRespond(CONFIG, "user_1", { requestId: "req_1" })).toBeNull();
    expect(applyRateLimit).toHaveBeenCalledWith(CONFIG, "user_1");
  });

  test("answers 429 with the limiter's message and Retry-After past it", async () => {
    applyRateLimit.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached.", 42));

    const response = await applyRateLimitOrRespond(CONFIG, "user_1", { requestId: "req_1", instance: "/x" });

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("42");
    expect(await response?.json()).toMatchObject({
      code: "too_many_requests",
      detail: "Maximum number of requests reached.",
      requestId: "req_1",
    });
  });

  test("rethrows anything else, e.g. the limiter's store being down", async () => {
    applyRateLimit.mockRejectedValue(new Error("redis down"));

    await expect(applyRateLimitOrRespond(CONFIG, "user_1", { requestId: "req_1" })).rejects.toThrow(
      "redis down"
    );
  });
});
