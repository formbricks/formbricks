import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { assertBrandingChangeAllowed } from "./permission";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getRemoveBrandingPermission: vi.fn() }));

const organizationId = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganization).mockResolvedValue({ id: organizationId } as never);
  vi.mocked(getRemoveBrandingPermission).mockResolvedValue(false);
});

describe("assertBrandingChangeAllowed", () => {
  test("asks nothing when no branding field is set", async () => {
    await expect(assertBrandingChangeAllowed(organizationId, {})).resolves.toBeUndefined();
    expect(getRemoveBrandingPermission).not.toHaveBeenCalled();
  });

  test.each([
    ["in-app", { inAppSurveyBranding: false }, "You are not allowed to remove in-app branding"],
    ["link survey", { linkSurveyBranding: false }, "You are not allowed to remove link survey branding"],
    // Setting a field at all needs the licence, as it always has on update.
    ["in-app, even to true", { inAppSurveyBranding: true }, "You are not allowed to remove in-app branding"],
  ])("refuses %s branding without the licence", async (_kind, data, message) => {
    await expect(assertBrandingChangeAllowed(organizationId, data)).rejects.toThrow(
      new OperationNotAllowedError(message)
    );
  });

  test("allows both with the licence", async () => {
    vi.mocked(getRemoveBrandingPermission).mockResolvedValue(true);

    await expect(
      assertBrandingChangeAllowed(organizationId, { inAppSurveyBranding: false, linkSurveyBranding: false })
    ).resolves.toBeUndefined();
    expect(getRemoveBrandingPermission).toHaveBeenCalledWith(organizationId);
  });

  test("reports a missing organization", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);

    await expect(assertBrandingChangeAllowed(organizationId, { linkSurveyBranding: false })).rejects.toThrow(
      ResourceNotFoundError
    );
  });
});
