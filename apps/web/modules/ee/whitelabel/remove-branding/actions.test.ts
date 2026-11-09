import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { updateWorkspaceBrandingAction } from "./actions";

const mocks = vi.hoisted(() => ({
  assertBrandingChangeAllowed: vi.fn(),
  updateWorkspaceBranding: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })) },
}));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn(async () => "org-1") }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));
vi.mock("@/modules/ee/whitelabel/remove-branding/lib/permission", () => ({
  assertBrandingChangeAllowed: mocks.assertBrandingChangeAllowed,
}));
vi.mock("@/modules/ee/whitelabel/remove-branding/lib/workspace", () => ({
  updateWorkspaceBranding: mocks.updateWorkspaceBranding,
}));
vi.mock("@/modules/survey/editor/lib/workspace", () => ({ getWorkspace: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

// The branding update goes through the one licence gate that create and the settings update share
// (ENG-6840), so swapping it out here turns this red.
describe("updateWorkspaceBrandingAction", () => {
  test("refuses before writing when the licence gate does", async () => {
    mocks.assertBrandingChangeAllowed.mockRejectedValue(
      new OperationNotAllowedError("You are not allowed to remove link survey branding")
    );
    const data = { linkSurveyBranding: false };

    await expect(
      updateWorkspaceBrandingAction({
        ctx: { user: { id: "user-1" }, auditLoggingCtx: {} },
        parsedInput: { workspaceId: "workspace-1", data },
      } as never)
    ).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.assertBrandingChangeAllowed).toHaveBeenCalledWith("org-1", data);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
  });
});
