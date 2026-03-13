import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrganizationBillingWithReadThroughSync: vi.fn(),
}));

vi.mock("./organization-billing", () => ({
  getOrganizationBillingWithReadThroughSync: mocks.getOrganizationBillingWithReadThroughSync,
}));

describe("cloud-billing-display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns billing context with plan from stripe", async () => {
    const billing = { stripe: { plan: "pro" }, usageCycleAnchor: new Date("2026-01-15T00:00:00.000Z") };
    mocks.getOrganizationBillingWithReadThroughSync.mockResolvedValue(billing);

    const { getCloudBillingDisplayContext } = await import("./cloud-billing-display");
    const result = await getCloudBillingDisplayContext("org_1");

    expect(result).toEqual({
      organizationId: "org_1",
      currentCloudPlan: "pro",
      currentSubscriptionStatus: null,
      trialDaysRemaining: null,
      usageCycleStart: new Date("2026-01-15T00:00:00.000Z"),
      usageCycleEnd: new Date("2026-02-15T00:00:00.000Z"),
      billing,
    });
  });

  test("returns unknown when stripe is null", async () => {
    const billing = { stripe: null, usageCycleAnchor: null };
    mocks.getOrganizationBillingWithReadThroughSync.mockResolvedValue(billing);

    const { getCloudBillingDisplayContext } = await import("./cloud-billing-display");
    const result = await getCloudBillingDisplayContext("org_1");

    expect(result.currentCloudPlan).toBe("unknown");
  });

  test("throws ResourceNotFoundError when billing is null", async () => {
    mocks.getOrganizationBillingWithReadThroughSync.mockResolvedValue(null);

    const { getCloudBillingDisplayContext } = await import("./cloud-billing-display");

    await expect(getCloudBillingDisplayContext("org_missing")).rejects.toThrow(
      "OrganizationBilling with ID org_missing not found"
    );
  });
});
