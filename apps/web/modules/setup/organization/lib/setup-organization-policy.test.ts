import { beforeEach, describe, expect, test, vi } from "vitest";
import { getHasNoOrganizations, getIsEligibleFirstOrganizationOwner } from "@/lib/instance/service";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { resolveSetupOrganizationCreation } from "./setup-organization-policy";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/instance/service", () => ({
  getHasNoOrganizations: vi.fn(),
  getIsEligibleFirstOrganizationOwner: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getHasNoOrganizations).mockResolvedValue(true);
  vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
  vi.mocked(getIsEligibleFirstOrganizationOwner).mockResolvedValue(true);
});

describe("resolveSetupOrganizationCreation (ENG-7313)", () => {
  test("lets the eligible user create the instance's first organization", async () => {
    await expect(resolveSetupOrganizationCreation("admin")).resolves.toEqual({
      allowed: true,
      isFirstOrganization: true,
      claimsInstance: true,
    });
    expect(getIsEligibleFirstOrganizationOwner).toHaveBeenCalledWith("admin");
  });

  test("refuses any other signed-in user while no organization exists", async () => {
    vi.mocked(getIsEligibleFirstOrganizationOwner).mockResolvedValue(false);

    await expect(resolveSetupOrganizationCreation("other")).resolves.toEqual({
      allowed: false,
      reason: "not_eligible",
    });
  });

  test("refuses everyone once an organization exists, without asking who they are", async () => {
    vi.mocked(getHasNoOrganizations).mockResolvedValue(false);

    await expect(resolveSetupOrganizationCreation("admin")).resolves.toEqual({
      allowed: false,
      reason: "not_fresh",
    });
    expect(getIsEligibleFirstOrganizationOwner).not.toHaveBeenCalled();
  });

  test.each([
    [true, true],
    [false, false],
  ])(
    "lets anyone create one under multi-org (no organization yet: %s → first: %s)",
    async (hasNoOrganizations, isFirstOrganization) => {
      vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
      vi.mocked(getHasNoOrganizations).mockResolvedValue(hasNoOrganizations);
      vi.mocked(getIsEligibleFirstOrganizationOwner).mockResolvedValue(false);

      await expect(resolveSetupOrganizationCreation("anyone")).resolves.toEqual({
        allowed: true,
        isFirstOrganization,
        claimsInstance: false,
      });
      expect(getIsEligibleFirstOrganizationOwner).not.toHaveBeenCalled();
    }
  );
});
