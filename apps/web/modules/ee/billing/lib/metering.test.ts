import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isCloud: true,
  meterEventsCreate: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get IS_FORMBRICKS_CLOUD() {
      return mocks.isCloud;
    },
  };
});

vi.mock("./stripe-client", () => ({
  stripeClient: {
    billing: {
      meterEvents: { create: mocks.meterEventsCreate },
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

describe("metering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCloud = true;
  });

  test("records meter event with Date createdAt", async () => {
    const { recordResponseCreatedMeterEvent } = await import("./metering");

    await recordResponseCreatedMeterEvent({
      stripeCustomerId: "cus_1",
      responseId: "resp_1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(mocks.meterEventsCreate).toHaveBeenCalledWith({
      event_name: "response_created",
      identifier: "response_created:resp_1",
      timestamp: Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000),
      payload: { stripe_customer_id: "cus_1", value: "1" },
    });
  });

  test("records meter event with string createdAt", async () => {
    const { recordResponseCreatedMeterEvent } = await import("./metering");

    await recordResponseCreatedMeterEvent({
      stripeCustomerId: "cus_1",
      responseId: "resp_2",
      createdAt: "2026-01-01T00:00:00Z",
    });

    expect(mocks.meterEventsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: expect.any(Number) })
    );
  });

  test("records meter event without timestamp when createdAt is null", async () => {
    const { recordResponseCreatedMeterEvent } = await import("./metering");

    await recordResponseCreatedMeterEvent({
      stripeCustomerId: "cus_1",
      responseId: "resp_3",
      createdAt: null,
    });

    expect(mocks.meterEventsCreate).toHaveBeenCalledWith({
      event_name: "response_created",
      identifier: "response_created:resp_3",
      payload: { stripe_customer_id: "cus_1", value: "1" },
    });
  });

  test("skips when stripeCustomerId is null", async () => {
    const { recordResponseCreatedMeterEvent } = await import("./metering");

    await recordResponseCreatedMeterEvent({
      stripeCustomerId: null,
      responseId: "resp_4",
    });

    expect(mocks.meterEventsCreate).not.toHaveBeenCalled();
  });

  test("skips when not cloud", async () => {
    mocks.isCloud = false;
    const { recordResponseCreatedMeterEvent } = await import("./metering");

    await recordResponseCreatedMeterEvent({
      stripeCustomerId: "cus_1",
      responseId: "resp_5",
    });

    expect(mocks.meterEventsCreate).not.toHaveBeenCalled();
  });

  test("logs warning on error", async () => {
    mocks.meterEventsCreate.mockRejectedValue(new Error("stripe error"));
    const { recordResponseCreatedMeterEvent } = await import("./metering");

    await recordResponseCreatedMeterEvent({
      stripeCustomerId: "cus_1",
      responseId: "resp_6",
    });

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error: expect.any(Error), stripeCustomerId: "cus_1", responseId: "resp_6" },
      "Failed to record Stripe meter event for response_created"
    );
  });
});
