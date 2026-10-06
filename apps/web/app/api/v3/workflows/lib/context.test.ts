import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspaceMemberEmails } from "@/lib/workspace/service";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { buildWorkflowApiContext } from "./context";

const { surveyFindMany, surveyFindUnique } = vi.hoisted(() => ({
  surveyFindMany: vi.fn(),
  surveyFindUnique: vi.fn(),
}));
vi.mock("@formbricks/database", () => ({
  prisma: { workflow: {}, survey: { findMany: surveyFindMany, findUnique: surveyFindUnique } },
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => ({
  getV3AuthorizationActor: (await importOriginal<typeof import("@/app/api/v3/lib/auth")>())
    .getV3AuthorizationActor,
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
const visibility = vi.hoisted(() => ({ ready: false }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: async () => visibility.ready }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceMemberEmails: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsWorkflowsEnabled: vi.fn() }));

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
  // Entitled by default so authorization-focused tests exercise the workspace-access behavior.
  vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
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

  test("authorize delegates to requireV3WorkspaceAccess and returns its result when entitled", async () => {
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
    // The entitlement is checked against the organization resolved by workspace access.
    expect(getIsWorkflowsEnabled).toHaveBeenCalledWith("org_1");
    expect(result).toEqual(resolved);
  });

  test("authorize returns a 403 problem when the organization lacks the workflows entitlement", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId: "ws_1", organizationId: "org_1" });
    vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(false);

    const ctx = buildWorkflowApiContext(apiKeyAuth, "req_1", "https://app.formbricks.com");
    const result = await ctx.authorize("ws_1", "read");

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      detail: "Workflows are not enabled for this organization",
    });
  });

  test("authorize short-circuits on a workspace-access failure without checking the entitlement", async () => {
    const denied = new Response(null, { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const ctx = buildWorkflowApiContext(apiKeyAuth, "req_1", "inst");
    const result = await ctx.authorize("ws_1", "read");

    expect(result).toBe(denied);
    expect(getIsWorkflowsEnabled).not.toHaveBeenCalled();
  });
});

describe("recordAnalytics (product-analytics sink, ENG-2851)", () => {
  const detail = {
    operation: "created" as const,
    workflowId: "wf_1",
    workspaceId: "ws_1",
    status: "draft" as const,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    definition: { triggerType: null, actionTypes: [], actionCount: 0, nodeCount: 0 },
    options: {
      endingScope: null,
      emailRecipientKind: null,
      attachResponseData: null,
      includeVariables: null,
      includeHiddenFields: null,
    },
  };

  test("is always bound, even without an audit log, and captures under the acting user", async () => {
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "https://app.formbricks.com/api/v3/workflows");

    expect(ctx.recordAudit).toBeUndefined();
    await ctx.recordAnalytics?.(detail);

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "cm9zr52kh000508l8e3q7bw9j",
      "workflow_created",
      expect.objectContaining({ via: "ui", workflow_id: "wf_1", organization_id: "org_1" }),
      { organizationId: "org_1", workspaceId: "ws_1" }
    );
  });

  test("tells the MCP surface apart from a plain API call made with the same key", async () => {
    await buildWorkflowApiContext(apiKeyAuth, "req_1", "/api/mcp").recordAnalytics?.(detail);

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "org_1",
      "workflow_created",
      expect.objectContaining({ via: "mcp" }),
      expect.anything()
    );
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
      select: { endings: true, visibility: true, visibilityProjectedVersion: true, visibilityVersion: true },
    });
  });

  test("flags the trigger's ending-card ids that are missing from the survey", async () => {
    surveyFindUnique.mockResolvedValue({ endings: [endScreen(endingId1), endScreen(endingId2)] });

    const result = await verify({
      workspaceId: "ws_1",
      surveyId: "s_1",
      endingCardIds: [endingId1, "ending_missing"],
    });

    expect(result).toEqual({
      surveyExists: true,
      missingEndingCardIds: ["ending_missing"],
      surveyNotWorkspaceVisible: false,
    });
  });

  test("accepts a workflow trigger whose survey and ending cards all exist", async () => {
    surveyFindUnique.mockResolvedValue({ endings: [endScreen(endingId1)] });

    const result = await verify({ workspaceId: "ws_1", surveyId: "s_1", endingCardIds: [endingId1] });

    expect(result).toEqual({
      surveyExists: true,
      missingEndingCardIds: [],
      surveyNotWorkspaceVisible: false,
    });
  });

  test("flags a restricted trigger survey once survey visibility is enforced (ENG-3283)", async () => {
    visibility.ready = true;
    surveyFindUnique.mockResolvedValue({
      endings: [endScreen(endingId1)],
      visibility: "restricted",
      visibilityProjectedVersion: 1,
      visibilityVersion: 1,
    });

    const result = await verify({ workspaceId: "ws_1", surveyId: "s_1", endingCardIds: [endingId1] });
    visibility.ready = false;

    expect(result).toEqual({ surveyExists: true, missingEndingCardIds: [], surveyNotWorkspaceVisible: true });
  });
});

describe("listUnreadableSurveyIds (run history follows its trigger survey, ENG-3282)", () => {
  const member = { enforced: true, isOrganizationAdmin: false, kind: "user", userId: "u_1" } as const;

  test("hides nothing, with no query, while visibility is not enforced", async () => {
    vi.mocked(resolveSurveyActorContext).mockResolvedValue({ ...member, enforced: false });

    const ids = await buildWorkflowApiContext(sessionAuth, "req_1", "inst").listUnreadableSurveyIds({
      workspaceId: "ws_1",
      organizationId: "org_1",
    });

    expect(ids).toEqual([]);
    expect(surveyFindMany).not.toHaveBeenCalled();
  });

  test("hides nothing, with no query, for an organization administrator", async () => {
    vi.mocked(resolveSurveyActorContext).mockResolvedValue({ ...member, isOrganizationAdmin: true });

    const ids = await buildWorkflowApiContext(sessionAuth, "req_1", "inst").listUnreadableSurveyIds({
      workspaceId: "ws_1",
      organizationId: "org_1",
    });

    expect(ids).toEqual([]);
    expect(surveyFindMany).not.toHaveBeenCalled();
  });

  test("returns the workspace's surveys a member may not read, in one query scoped to the workspace", async () => {
    vi.mocked(resolveSurveyActorContext).mockResolvedValue(member);
    surveyFindMany.mockResolvedValue([{ id: "s_restricted" }]);

    const ids = await buildWorkflowApiContext(sessionAuth, "req_1", "inst").listUnreadableSurveyIds({
      workspaceId: "ws_1",
      organizationId: "org_1",
      surveyIds: ["s_restricted", "s_open"],
    });

    expect(ids).toEqual(["s_restricted"]);
    expect(resolveSurveyActorContext).toHaveBeenCalledWith(
      { type: "user", id: "cm9zr52kh000508l8e3q7bw9j" },
      "org_1"
    );
    expect(surveyFindMany).toHaveBeenCalledTimes(1);
    const { where } = surveyFindMany.mock.calls[0][0];
    expect(where).toMatchObject({ workspaceId: "ws_1", id: { in: ["s_restricted", "s_open"] } });
    // The member's own surveys stay readable: the hidden clause excludes them, nulls included.
    expect(JSON.stringify(where.AND)).toContain('{"ownerId":{"not":"u_1"}}');
  });

  test("resolves an API key as its own actor", async () => {
    vi.mocked(resolveSurveyActorContext).mockResolvedValue({ enforced: true, kind: "apiKey" });
    surveyFindMany.mockResolvedValue([]);

    await buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").listUnreadableSurveyIds({
      workspaceId: "ws_1",
      organizationId: "org_1",
    });

    expect(resolveSurveyActorContext).toHaveBeenCalledWith({ type: "apiKey", id: "key_1" }, "org_1");
    expect(surveyFindMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws_1" });
  });

  test("fails closed without an authenticated actor", async () => {
    await expect(
      buildWorkflowApiContext(null, "req_1", "inst").listUnreadableSurveyIds({
        workspaceId: "ws_1",
        organizationId: "org_1",
      })
    ).rejects.toThrow();
  });
});

describe("verifyRecipientsAllowed (recipient allowlist for send_email, ENG-2029 + ENG-2186)", () => {
  const verifyRecipients = (emails: string[]) =>
    buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").verifyRecipientsAllowed({
      workspaceId: "ws_1",
      emails,
    });

  test("returns the literal recipients that cannot access the workspace (case-insensitive)", async () => {
    vi.mocked(getWorkspaceMemberEmails).mockResolvedValue(new Set(["member@corp.example"]));

    const result = await verifyRecipients(["Member@corp.example", "attacker@external-evil.example"]);

    expect(result).toEqual({ disallowedEmails: ["attacker@external-evil.example"] });
  });

  test("allows all recipients when each can access the workspace", async () => {
    vi.mocked(getWorkspaceMemberEmails).mockResolvedValue(new Set(["a@corp.example", "b@corp.example"]));

    const result = await verifyRecipients(["a@corp.example", "b@corp.example"]);

    expect(result).toEqual({ disallowedEmails: [] });
  });

  test("scopes the allowlist to the workspace, not to its organization (ENG-2186)", async () => {
    // The gate must ask who can access *this workspace*: an org member whose team lost access to it
    // is rejected here, matching what the authoring picker offers and what the runner will send.
    vi.mocked(getWorkspaceMemberEmails).mockResolvedValue(new Set(["still-has-access@corp.example"]));

    const result = await verifyRecipients(["revoked-member@corp.example"]);

    expect(getWorkspaceMemberEmails).toHaveBeenCalledWith("ws_1");
    expect(getOrganizationIdFromWorkspaceId).not.toHaveBeenCalled();
    expect(result).toEqual({ disallowedEmails: ["revoked-member@corp.example"] });
  });

  test("rejects every literal recipient when the workspace resolves to nobody (fails closed)", async () => {
    vi.mocked(getWorkspaceMemberEmails).mockResolvedValue(new Set());

    await expect(verifyRecipients(["member@corp.example"])).resolves.toEqual({
      disallowedEmails: ["member@corp.example"],
    });
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
