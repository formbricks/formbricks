import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { reserveRateLimitUsage, settleRateLimitUsage } from "@/modules/core/rate-limit/helpers";
import { acquireInFlightSlot, releaseInFlightSlot } from "@/modules/core/rate-limit/in-flight";
import { reserveV3OperationRateLimit, withV3OperationSlot } from "./operation-rate-limit";
import type { TV3Authentication } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn() })) },
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn(),
  reserveRateLimitUsage: vi.fn(),
  settleRateLimitUsage: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/in-flight", () => ({
  acquireInFlightSlot: vi.fn(),
  releaseInFlightSlot: vi.fn(),
}));

const config = { interval: 120, allowedPerInterval: 20, namespace: "api:v3:charts:in-flight" };
const session = { user: { id: "user_1" } } as unknown as TV3Authentication;
const slotContext = {
  authentication: session,
  config,
  requestId: "req_1",
  instance: "/api/v3/charts/preview",
};
const slot = { key: "k", member: "m", released: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(acquireInFlightSlot).mockResolvedValue({ allowed: true, slot });
});

describe("withV3OperationSlot", () => {
  test("runs the operation in the principal's slot and gives it back afterwards", async () => {
    const operation = vi.fn(async () => Response.json({ ok: true }));

    expect((await withV3OperationSlot(slotContext, operation)).status).toBe(200);
    expect(acquireInFlightSlot).toHaveBeenCalledWith(config, "user_1");
    expect(releaseInFlightSlot).toHaveBeenCalledWith(slot);
    expect(vi.mocked(releaseInFlightSlot).mock.invocationCallOrder[0]).toBeGreaterThan(
      operation.mock.invocationCallOrder[0]
    );
  });

  test("gives the slot back when the operation throws, and lets the error through", async () => {
    await expect(
      withV3OperationSlot(slotContext, async () => {
        throw new Error("cube down");
      })
    ).rejects.toThrow("cube down");
    expect(releaseInFlightSlot).toHaveBeenCalledWith(slot);
  });

  test("answers 429 with a one-second Retry-After when every slot is taken, running nothing", async () => {
    vi.mocked(acquireInFlightSlot).mockResolvedValueOnce({ allowed: false });
    const operation = vi.fn();

    const response = await withV3OperationSlot(slotContext, operation);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(((await response.json()) as { detail: string }).detail).toContain("20");
    expect(operation).not.toHaveBeenCalled();
    expect(releaseInFlightSlot).not.toHaveBeenCalled();
  });

  test("runs with nothing to give back when the limit fails open, and needs no slot without a principal", async () => {
    vi.mocked(acquireInFlightSlot).mockResolvedValueOnce({ allowed: true });
    expect((await withV3OperationSlot(slotContext, async () => Response.json({}))).status).toBe(200);
    expect(releaseInFlightSlot).not.toHaveBeenCalled();

    vi.mocked(acquireInFlightSlot).mockClear();
    expect(
      (await withV3OperationSlot({ ...slotContext, authentication: null }, async () => Response.json({})))
        .status
    ).toBe(200);
    expect(acquireInFlightSlot).not.toHaveBeenCalled();
  });
});

describe("reserveV3OperationRateLimit", () => {
  const budget = { interval: 60, allowedPerInterval: 600, namespace: "api:v3:charts:queries" };
  const reservation = { key: "w", requested: 7, settled: false } as never;

  test("reserves the units asked for, and settles to what was used", async () => {
    vi.mocked(reserveRateLimitUsage).mockResolvedValueOnce(reservation);

    const reserved = await reserveV3OperationRateLimit({ ...slotContext, config: budget, requested: 7 });

    expect(reserveRateLimitUsage).toHaveBeenCalledWith(budget, "user_1", 7);
    expect("refused" in reserved).toBe(false);
    if (!("settle" in reserved)) throw new Error("expected a reservation");
    await reserved.settle(3);
    expect(settleRateLimitUsage).toHaveBeenCalledWith(reservation, 3);
  });

  test("answers 429 with the limiter's Retry-After when the budget is spent", async () => {
    vi.mocked(reserveRateLimitUsage).mockRejectedValueOnce(
      new TooManyRequestsError("Rate limit exceeded", 12)
    );

    const reserved = await reserveV3OperationRateLimit({ ...slotContext, config: budget, requested: 7 });

    if (!("refused" in reserved)) throw new Error("expected a refusal");
    expect(reserved.refused.status).toBe(429);
    expect(reserved.refused.headers.get("Retry-After")).toBe("12");
  });

  test("reserves nothing for a caller with no principal, and nothing for zero units", async () => {
    const anonymous = await reserveV3OperationRateLimit({
      ...slotContext,
      authentication: null as never,
      config: budget,
      requested: 3,
    });
    const nothing = await reserveV3OperationRateLimit({ ...slotContext, config: budget, requested: 0 });

    expect(reserveRateLimitUsage).not.toHaveBeenCalled();
    expect("settle" in anonymous && "settle" in nothing).toBe(true);
  });
});
