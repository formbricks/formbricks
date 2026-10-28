import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { createOrganizationAction } from "./actions";

const mocks = vi.hoisted(() => ({
  inputSchema: undefined as import("zod").ZodType | undefined,
  applyRateLimit: vi.fn(),
  createMembership: vi.fn(),
  createOrganization: vi.fn(),
  createWorkspace: vi.fn(),
  getHasNoOrganizations: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: false }));
vi.mock("@/lib/instance/service", () => ({ getHasNoOrganizations: mocks.getHasNoOrganizations }));
vi.mock("@/lib/membership/service", () => ({ createMembership: mocks.createMembership }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: mocks.createOrganization }));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  getEmailDomain: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn((schema) => {
      mocks.inputSchema = schema;
      return { action: vi.fn((fn) => fn) };
    }),
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
});

describe("setup createOrganizationAction first workspace", () => {
  const ctx = { user: { id: "user-1", email: "owner@acme.com" }, auditLoggingCtx: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHasNoOrganizations.mockResolvedValue(false);
    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
    mocks.createOrganization.mockResolvedValue({ id: "org-1", name: "Acme" });
    mocks.createWorkspace.mockResolvedValue({ id: "workspace-1", name: "Production" });
  });

  test("names the first workspace after the submitted workspace name", async () => {
    await createOrganizationAction({
      ctx,
      parsedInput: { organizationName: "Acme", workspaceName: "Production" },
    } as never);

    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      "org-1",
      { name: "Production" },
      { workspaceLimit: null }
    );
  });

  test("falls back to the default workspace name when none is submitted", async () => {
    await createOrganizationAction({ ctx, parsedInput: { organizationName: "Acme" } } as never);

    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      "org-1",
      { name: "My Workspace" },
      { workspaceLimit: null }
    );
  });
});

describe("setup createOrganizationAction input bounds", () => {
  const parse = (input: unknown) => mocks.inputSchema!.safeParse(input);

  test("trims both names", () => {
    expect(parse({ organizationName: "  Acme  ", workspaceName: "  Main  " }).data).toEqual({
      organizationName: "Acme",
      workspaceName: "Main",
    });
  });

  test("leaves the workspace name optional", () => {
    expect(parse({ organizationName: "Acme" }).success).toBe(true);
  });

  test("rejects an empty or whitespace-only name", () => {
    expect(parse({ organizationName: "   " }).success).toBe(false);
    expect(parse({ organizationName: "Acme", workspaceName: "  " }).success).toBe(false);
  });

  test("rejects a name past 255 characters, accepts exactly 255", () => {
    expect(parse({ organizationName: "a".repeat(255) }).success).toBe(true);
    expect(parse({ organizationName: "a".repeat(256) }).success).toBe(false);
    expect(parse({ organizationName: "Acme", workspaceName: "a".repeat(256) }).success).toBe(false);
  });
});
