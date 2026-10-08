import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { checkRoleManagementPermission } from "./permission";

vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getAccessControlPermission: vi.fn() }));

describe("checkRoleManagementPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when the organization does not exist", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);

    await expect(checkRoleManagementPermission("org-1")).rejects.toThrow(ResourceNotFoundError);
    expect(getAccessControlPermission).not.toHaveBeenCalled();
  });

  test("throws when the license does not include the feature", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org-1" } as Awaited<
      ReturnType<typeof getOrganization>
    >);
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    await expect(checkRoleManagementPermission("org-1")).rejects.toThrow(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
  });

  test("resolves when the organization exists and the feature is licensed", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org-1" } as Awaited<
      ReturnType<typeof getOrganization>
    >);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);

    await expect(checkRoleManagementPermission("org-1")).resolves.toBeUndefined();
    expect(getAccessControlPermission).toHaveBeenCalledWith("org-1");
  });
});
