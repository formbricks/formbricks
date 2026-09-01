import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

const { checkContactsEnabledApiV2 } = await import("./contacts-api-guard");

describe("checkContactsEnabledApiV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a forbidden error object when the entitlement is missing", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const error = await checkContactsEnabledApiV2("org1");

    expect(error).toEqual({
      type: "forbidden",
      details: [{ field: "contacts", issue: "Contacts feature is not enabled for this organization" }],
    });
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith("org1");
  });

  test("returns null when the entitlement is present", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(true);

    await expect(checkContactsEnabledApiV2("org1")).resolves.toBeNull();
  });
});
