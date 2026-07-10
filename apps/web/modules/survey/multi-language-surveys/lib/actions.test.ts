import { beforeEach, describe, expect, test, vi } from "vitest";
import { updateWorkspaceDefaultLanguageAction } from "./actions";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  setWorkspaceDefaultLanguage: vi.fn(),
  getWorkspace: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));

vi.mock("@/lib/language/service", () => ({
  createLanguage: vi.fn(),
  deleteLanguage: vi.fn(),
  getLanguage: vi.fn(),
  getSurveysUsingGivenLanguage: vi.fn(),
  setWorkspaceDefaultLanguage: mocks.setWorkspaceDefaultLanguage,
  updateLanguage: vi.fn(),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromLanguageId: vi.fn(),
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromLanguageId: vi.fn(),
}));

const workspaceId = "clt2h1ant000f08l36qmx2dy2";
const organizationId = "cm9gptbhg0000192zceq9ayuc";

describe("updateWorkspaceDefaultLanguageAction", () => {
  beforeEach(() => {
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(organizationId);
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.setWorkspaceDefaultLanguage.mockResolvedValue("de-DE");
    mocks.getWorkspace.mockResolvedValue({ id: workspaceId, defaultLanguageCode: null });
  });

  test("authorizes, sets the default language, and records audit + analytics", async () => {
    const ctx = { user: { id: "user_1" }, auditLoggingCtx: {} };
    const parsedInput = { workspaceId, languageCode: "de-DE" };

    await updateWorkspaceDefaultLanguageAction({ ctx, parsedInput } as any);

    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId, minPermission: "manage" },
      ],
    });
    expect(mocks.setWorkspaceDefaultLanguage).toHaveBeenCalledWith(workspaceId, "de-DE");
    expect(ctx.auditLoggingCtx).toMatchObject({
      organizationId,
      workspaceId,
      oldObject: { id: workspaceId, defaultLanguageCode: null },
      newObject: { id: workspaceId, defaultLanguageCode: "de-DE" },
    });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "workspace_default_language_set",
      expect.objectContaining({
        organization_id: organizationId,
        workspace_id: workspaceId,
        language_code: "de-DE",
      }),
      { organizationId, workspaceId }
    );
  });

  test("passes a null languageCode through to clear the default", async () => {
    const ctx = { user: { id: "user_1" }, auditLoggingCtx: {} };
    const parsedInput = { workspaceId, languageCode: null };

    await updateWorkspaceDefaultLanguageAction({ ctx, parsedInput } as any);

    expect(mocks.setWorkspaceDefaultLanguage).toHaveBeenCalledWith(workspaceId, null);
  });
});
