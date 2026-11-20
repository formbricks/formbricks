import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { createOrganizationAction } from "./actions";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  createMembership: vi.fn(),
  createOrganization: vi.fn(),
  createWorkspace: vi.fn(),
  getHasNoOrganizations: vi.fn(),
  getIsEligibleFirstOrganizationOwner: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: false }));
vi.mock("@/lib/instance/service", () => ({
  getHasNoOrganizations: mocks.getHasNoOrganizations,
  getIsEligibleFirstOrganizationOwner: mocks.getIsEligibleFirstOrganizationOwner,
}));
vi.mock("@/lib/membership/service", () => ({ createMembership: mocks.createMembership }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: mocks.createOrganization }));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  getEmailDomain: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));
vi.mock("@/lib/workspace/constants", () => ({ DEFAULT_WORKSPACE_NAME: "My Workspace" }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled,
}));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: mocks.createWorkspace }));

describe("setup createOrganizationAction rate limit", () => {
  const ctx = { user: { id: "user-1" }, auditLoggingCtx: {} };
  const parsedInput = { organizationName: "Acme" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHasNoOrganizations.mockResolvedValue(false);
    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
    mocks.getIsEligibleFirstOrganizationOwner.mockResolvedValue(true);
    mocks.createOrganization.mockResolvedValue({ id: "org-1", name: "Acme" });
    mocks.createWorkspace.mockResolvedValue({ id: "workspace-1", name: "My Workspace" });
  });

  test("counts the creation against the requesting user's daily budget", async () => {
    await createOrganizationAction({ ctx, parsedInput } as never);

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.createOrganization, "user-1");
    expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
  });

  test("creates nothing once the user is over budget", async () => {
    mocks.applyRateLimit.mockRejectedValueOnce(
      new TooManyRequestsError("Maximum number of requests reached")
    );

    await expect(createOrganizationAction({ ctx, parsedInput } as never)).rejects.toBeInstanceOf(
      TooManyRequestsError
    );

    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.createMembership).not.toHaveBeenCalled();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  // ENG-7313: with no organization and no multi-org license, being signed in is not enough to become
  // the instance owner.
  describe("first organization on a single-organization instance", () => {
    beforeEach(() => {
      mocks.getHasNoOrganizations.mockResolvedValue(true);
      mocks.getIsMultiOrgEnabled.mockResolvedValue(false);
    });

    test("is refused for a signed-in user who is not the bootstrap administrator or the sole user", async () => {
      mocks.getIsEligibleFirstOrganizationOwner.mockResolvedValue(false);

      await expect(createOrganizationAction({ ctx, parsedInput } as never)).rejects.toBeInstanceOf(
        OperationNotAllowedError
      );

      expect(mocks.getIsEligibleFirstOrganizationOwner).toHaveBeenCalledWith("user-1");
      expect(mocks.createOrganization).not.toHaveBeenCalled();
      expect(mocks.createMembership).not.toHaveBeenCalled();
    });

    test("is allowed for the eligible first owner", async () => {
      mocks.getIsEligibleFirstOrganizationOwner.mockResolvedValue(true);

      await createOrganizationAction({ ctx, parsedInput } as never);

      expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
    });

    test("does not consult eligibility once an organization exists (still refused)", async () => {
      mocks.getHasNoOrganizations.mockResolvedValue(false);

      await expect(createOrganizationAction({ ctx, parsedInput } as never)).rejects.toBeInstanceOf(
        OperationNotAllowedError
      );
      expect(mocks.getIsEligibleFirstOrganizationOwner).not.toHaveBeenCalled();
    });
  });

  test("skips the eligibility check on a multi-organization instance", async () => {
    mocks.getHasNoOrganizations.mockResolvedValue(true);
    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);

    await createOrganizationAction({ ctx, parsedInput } as never);

    expect(mocks.getIsEligibleFirstOrganizationOwner).not.toHaveBeenCalled();
  });
});
