import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { hasApiKeyOrganizationAccess } from "@/modules/organization/settings/api-keys/lib/utils";
import { hasOrganizationIdAndAccess } from "./utils";

// Delegation target; the ladder is covered by lib/authorization/legacy-api-key-access.test.ts.
vi.mock("@/modules/organization/settings/api-keys/lib/utils", () => ({
  hasApiKeyOrganizationAccess: vi.fn(),
}));

describe("hasOrganizationIdAndAccess", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("should return false and log error if authentication has no organizationId", async () => {
    const spyError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const authentication = {
      organizationAccess: { accessControl: { read: true } },
    } as any;

    const result = await hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(false);
    expect(spyError).toHaveBeenCalledWith(
      "Organization ID from params does not match the authenticated organization ID"
    );
  });

  test("should return false and log error if param organizationId does not match authentication organizationId", async () => {
    const spyError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const authentication = {
      organizationId: "org2",
      organizationAccess: { accessControl: { read: true } },
    } as any;

    const result = await hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(false);
    expect(spyError).toHaveBeenCalledWith(
      "Organization ID from params does not match the authenticated organization ID"
    );
  });

  test("should return false if access type is missing in organizationAccess", async () => {
    vi.mocked(hasApiKeyOrganizationAccess).mockResolvedValue(false);
    const authentication = {
      organizationId: "org1",
      organizationAccess: { accessControl: {} },
    } as any;

    const result = await hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(false);
  });

  test("should return true if organizationId and access type are valid", async () => {
    vi.mocked(hasApiKeyOrganizationAccess).mockResolvedValue(true);
    const authentication = {
      organizationId: "org1",
      organizationAccess: { accessControl: { read: true } },
    } as any;

    const result = await hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(true);
  });
});
