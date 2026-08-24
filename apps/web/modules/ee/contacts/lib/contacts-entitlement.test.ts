import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

const { CONTACTS_NOT_ENABLED_MESSAGE, checkContactsEnabledApiV2, ensureContactsEnabled } =
  await import("./contacts-entitlement");

describe("ensureContactsEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws OperationNotAllowedError when the entitlement is missing", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    await expect(ensureContactsEnabled("org1")).rejects.toThrow(OperationNotAllowedError);
    await expect(ensureContactsEnabled("org1")).rejects.toThrow(CONTACTS_NOT_ENABLED_MESSAGE);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith("org1");
  });

  test("resolves when the entitlement is present", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(true);

    await expect(ensureContactsEnabled("org1")).resolves.toBeUndefined();
  });
});

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
  });

  test("returns null when the entitlement is present", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(true);

    await expect(checkContactsEnabledApiV2("org1")).resolves.toBeNull();
  });
});
