import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { checkWhiteLabelPermission } from "./permission";

vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getWhiteLabelPermission: vi.fn() }));

describe("checkWhiteLabelPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when the organization does not exist", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);

    await expect(checkWhiteLabelPermission("org-1")).rejects.toThrow(ResourceNotFoundError);
    expect(getWhiteLabelPermission).not.toHaveBeenCalled();
  });

  test("throws when the license does not include the feature", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org-1" } as Awaited<
      ReturnType<typeof getOrganization>
    >);
    vi.mocked(getWhiteLabelPermission).mockResolvedValue(false);

    await expect(checkWhiteLabelPermission("org-1")).rejects.toThrow(
      new OperationNotAllowedError("White label is not allowed for this organization")
    );
  });

  test("resolves when the organization exists and the feature is licensed", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org-1" } as Awaited<
      ReturnType<typeof getOrganization>
    >);
    vi.mocked(getWhiteLabelPermission).mockResolvedValue(true);

    await expect(checkWhiteLabelPermission("org-1")).resolves.toBeUndefined();
    expect(getWhiteLabelPermission).toHaveBeenCalledWith("org-1");
  });
});
