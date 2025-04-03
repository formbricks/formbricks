import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { hasOrganizationIdAndAccess } from "./utils";

describe("hasOrganizationIdAndAccess", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return false and log error if authentication has no organizationId", () => {
    const spyError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const authentication = {
      organizationAccess: { accessControl: { read: true } },
    } as any;

    const result = hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(false);
    expect(spyError).toHaveBeenCalledWith("Organization ID is missing from the authentication object");
  });

  it("should return false and log error if param organizationId does not match authentication organizationId", () => {
    const spyError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const authentication = {
      organizationId: "org2",
      organizationAccess: { accessControl: { read: true } },
    } as any;

    const result = hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(false);
    expect(spyError).toHaveBeenCalledWith(
      "Organization ID from params does not match the authenticated organization ID"
    );
  });

  it("should return false if access type is missing in organizationAccess", () => {
    const authentication = {
      organizationId: "org1",
      organizationAccess: { accessControl: {} },
    } as any;

    const result = hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(false);
  });

  it("should return true if organizationId and access type are valid", () => {
    const authentication = {
      organizationId: "org1",
      organizationAccess: { accessControl: { read: true } },
    } as any;

    const result = hasOrganizationIdAndAccess("org1", authentication, "read" as OrganizationAccessType);
    expect(result).toBe(true);
  });
});
