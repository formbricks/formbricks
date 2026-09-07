import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

const { CONTACTS_NOT_ENABLED_MESSAGE, ensureContactsEnabled } = await import("./contacts-entitlement");

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
