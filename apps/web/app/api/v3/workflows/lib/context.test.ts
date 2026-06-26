import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { buildWorkflowApiContext } from "./context";

const { surveyFindUnique } = vi.hoisted(() => ({ surveyFindUnique: vi.fn() }));
vi.mock("@formbricks/database", () => ({
  prisma: { workflow: {}, survey: { findUnique: surveyFindUnique } },
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));

const baseAuditLog = (): TV3AuditLog => ({
  action: "updated",
  targetType: "workflow",
  userId: "unknown",
  targetId: "unknown",
  organizationId: "unknown",
  status: "failure",
  oldObject: undefined,
  newObject: undefined,
  userType: "api",
  apiUrl: "https://app.formbricks.com/api/v3/workflows/wf_1",
});

const sessionAuth = {
  user: { id: "cm9zr52kh000508l8e3q7bw9j" },
  expires: "2026-12-01",
} as unknown as TV3Authentication;
const apiKeyAuth = {
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TAuthenticationApiKey;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildWorkflowApiContext", () => {
  test("derives userId from a session", () => {
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "https://app.formbricks.com");
    expect(ctx.userId).toBe("cm9zr52kh000508l8e3q7bw9j");
  });

  test("leaves userId null for API-key authentication", () => {
    expect(buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").userId).toBeNull();
  });

  test("leaves userId null for unauthenticated requests", () => {
    expect(buildWorkflowApiContext(null, "req_1", "inst").userId).toBeNull();
  });

  test("authorize delegates to requireV3WorkspaceAccess and returns its result", async () => {
    const resolved = { workspaceId: "ws_1", organizationId: "org_1" };
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(resolved);

    const ctx = buildWorkflowApiContext(apiKeyAuth, "req_1", "https://app.formbricks.com");
    const result = await ctx.authorize("ws_1", "readWrite");

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      apiKeyAuth,
      "ws_1",
      "readWrite",
      "req_1",
      "https://app.formbricks.com"
    );
    expect(result).toEqual(resolved);
  });
});

describe("verifyTriggerSurvey (validates a workflow trigger's referenced survey)", () => {
  const verify = (input: { workspaceId: string; surveyId: string; endingCardIds: string[] }) =>
    buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").verifyTriggerSurvey(input);

  // The adapter parses `survey.endings` with `ZSurveyEndings`, so mocked endings must be valid
  // ending cards (cuid2 id + type), matching how the survey is stored.
  const endingId1 = "cm9zr4q7i000108l84goze001";
  const endingId2 = "cm9zr4q7i000108l84goze002";
  const endScreen = (id: string) => ({ id, type: "endScreen" as const });

  test("rejects a workflow trigger whose survey no longer exists in the workspace", async () => {
    surveyFindUnique.mockResolvedValue(null);

    const result = await verify({ workspaceId: "ws_1", surveyId: "s_1", endingCardIds: [endingId1] });

    expect(result).toEqual({ surveyExists: false, missingEndingCardIds: [] });
    expect(surveyFindUnique).toHaveBeenCalledWith({
      where: { id_workspaceId: { id: "s_1", workspaceId: "ws_1" } },
      select: { endings: true },
    });
  });

  test("flags the trigger's ending-card ids that are missing from the survey", async () => {
    surveyFindUnique.mockResolvedValue({ endings: [endScreen(endingId1), endScreen(endingId2)] });

    const result = await verify({
      workspaceId: "ws_1",
      surveyId: "s_1",
      endingCardIds: [endingId1, "ending_missing"],
    });

    expect(result).toEqual({ surveyExists: true, missingEndingCardIds: ["ending_missing"] });
  });

  test("accepts a workflow trigger whose survey and ending cards all exist", async () => {
    surveyFindUnique.mockResolvedValue({ endings: [endScreen(endingId1)] });

    const result = await verify({ workspaceId: "ws_1", surveyId: "s_1", endingCardIds: [endingId1] });

    expect(result).toEqual({ surveyExists: true, missingEndingCardIds: [] });
  });
});

describe("recordAudit (binds the audit sink to the request's audit log)", () => {
  test("is not exposed when no audit log is threaded in (read-only routes)", () => {
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "inst");
    expect(ctx.recordAudit).toBeUndefined();
  });

  test("writes targetId + before/after snapshots onto the audit log", async () => {
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_resolved");
    const auditLog = baseAuditLog();
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "inst", auditLog);

    await ctx.recordAudit?.({
      targetId: "wf_1",
      workspaceId: "ws_1",
      oldObject: { status: "draft" },
      newObject: { status: "enabled" },
    });

    expect(auditLog.targetId).toBe("wf_1");
    expect(auditLog.oldObject).toEqual({ status: "draft" });
    expect(auditLog.newObject).toEqual({ status: "enabled" });
  });

  test("resolves the workflow's organization from detail.workspaceId for session auth", async () => {
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_resolved");
    const auditLog = baseAuditLog();
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "inst", auditLog);

    await ctx.recordAudit?.({ targetId: "wf_1", workspaceId: "ws_1", newObject: { status: "draft" } });

    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("ws_1");
    expect(auditLog.organizationId).toBe("org_resolved");
  });

  test("resolves org from detail.workspaceId on the delete path (oldObject only, no newObject)", async () => {
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_resolved");
    const auditLog = baseAuditLog();
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "inst", auditLog);

    // Delete-style: a pre-mutation snapshot only, no newObject — org must still resolve from the
    // explicit workspaceId (never inferred from a snapshot that the delete path may not carry).
    await ctx.recordAudit?.({ targetId: "wf_1", workspaceId: "ws_1", oldObject: { status: "draft" } });

    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("ws_1");
    expect(auditLog.organizationId).toBe("org_resolved");
    expect(auditLog.oldObject).toEqual({ status: "draft" });
    expect(auditLog.newObject).toBeUndefined();
  });

  test("keeps the API-key path's organization and does not re-resolve from the workspace", async () => {
    const auditLog = { ...baseAuditLog(), organizationId: "org_from_key" };
    const ctx = buildWorkflowApiContext(apiKeyAuth as TV3Authentication, "req_1", "inst", auditLog);

    await ctx.recordAudit?.({ targetId: "wf_1", workspaceId: "ws_1", newObject: { status: "draft" } });

    expect(getOrganizationIdFromWorkspaceId).not.toHaveBeenCalled();
    expect(auditLog.organizationId).toBe("org_from_key");
  });

  test("never throws when organization resolution fails; snapshots are still recorded", async () => {
    vi.mocked(getOrganizationIdFromWorkspaceId).mockRejectedValue(new Error("workspace lookup failed"));
    const auditLog = baseAuditLog();
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "inst", auditLog);

    await expect(
      ctx.recordAudit?.({ targetId: "wf_1", workspaceId: "ws_1", newObject: { status: "draft" } })
    ).resolves.toBeUndefined();

    expect(auditLog.targetId).toBe("wf_1");
    // Resolution failed, so the session org stays at its default rather than corrupting the event.
    expect(auditLog.organizationId).toBe("unknown");
  });
});
