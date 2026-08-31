import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getFeedbackDirectoryAuthContext } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TGatewayAuthenticatedPrincipal } from "@/modules/gateway-auth/lib/request";
import { feedbackRecordsGatewayAuthorizer } from "./feedback-records-gateway";
import { getFeedbackRecordTenant } from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Stubbed so the test does not pull prisma/session code in through the gateway-auth module; the two
// helpers used here are trivial response builders.
vi.mock("@/modules/gateway-auth/lib/request", () => ({
  allowGatewayRequest: () => ({ status: "allow" }),
  buildGatewayStatusResponse: (status: number, message: string) => new Response(message, { status }),
}));

vi.mock("@/lib/jwt", () => ({ verifyFeedbackRecordsGatewayToken: vi.fn() }));
vi.mock("@/modules/api/lib/api-key-auth", () => ({ getBearerTokenFromHeaders: vi.fn() }));
vi.mock("@/app/lib/api/request-body", () => ({
  readRequestBodyWithLimit: vi.fn(async (request: Request) => await request.text()),
  RequestBodyTooLargeError: class RequestBodyTooLargeError extends Error {},
}));

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/context", () => ({
  withAuthorizationSurface: vi.fn((_surface, callback) => callback()),
}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoryAuthContext: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: vi.fn(),
}));

vi.mock("./service", () => ({ getFeedbackRecordTenant: vi.fn() }));

const directoryId = "clfd1234567890123456789012";
const workspaceA = "clwa1234567890123456789012";
const workspaceB = "clwb1234567890123456789012";
const recordId = "0197f5c8-9d3a-7b2e-8f41-2c6ad0e4b915";
const organizationId = "org_1";

const userPrincipal: TGatewayAuthenticatedPrincipal = { type: "user", userId: "user-1", source: "session" };

const apiKey = (overrides: Partial<TAuthenticationApiKey>): TGatewayAuthenticatedPrincipal => ({
  type: "apiKey",
  authentication: {
    type: "apiKey",
    apiKeyId: "key-1",
    organizationId,
    organizationAccess: { accessControl: { read: false, write: false } },
    workspacePermissions: [],
    ...overrides,
  } as TAuthenticationApiKey,
});

const authorize = async (
  method: string,
  path: string,
  principal: TGatewayAuthenticatedPrincipal,
  body?: unknown
) => {
  const url = new URL(`https://app.test${path}`);
  const request = new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });

  return feedbackRecordsGatewayAuthorizer.authorize({
    request,
    originalRequest: { method, url },
    principal,
    requestId: "req_1",
  });
};

describe("feedbackRecordsGatewayAuthorizer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getFeedbackDirectoryAuthContext).mockResolvedValue({
      organizationId,
      // The directory is shared: workspace A ingests records, workspace B also has access.
      workspaceIds: [workspaceA, workspaceB],
      isArchived: false,
    });
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(getFeedbackRecordTenant).mockResolvedValue({ data: { tenantId: directoryId }, error: null });
    vi.mocked(can).mockResolvedValue(true);
  });

  // ENG-1770: records in a shared directory carry no workspace, so a workspace permission cannot
  // authorize changing or deleting them — only the organization role can.
  describe("session principal", () => {
    test.each([
      ["delete", "DELETE", `/api/v3/feedbackRecords/${recordId}`],
      ["update", "PATCH", `/api/v3/feedbackRecords/${recordId}`],
      ["bulkDelete", "DELETE", `/api/v3/feedbackRecords?tenant_id=${directoryId}`],
    ])(
      "%s requires an organization owner or manager, with no workspace fallback",
      async (_op, method, path) => {
        const decision = await authorize(method, path, userPrincipal);

        expect(decision.status).toBe("allow");
        expect(can).toHaveBeenLastCalledWith({ type: "user", id: "user-1" }, "organization.manage", {
          type: "organization",
          id: organizationId,
        });
      }
    );

    test("denies a delete when the caller is not an organization owner or manager", async () => {
      vi.mocked(can).mockResolvedValue(false);

      const decision = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

      expect(decision.status).toBe("deny");
      expect(decision.status === "deny" && decision.response.status).toBe(403);
    });

    test("keeps reads open to workspace members of any workspace sharing the directory", async () => {
      const decision = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

      expect(decision.status).toBe("allow");
      expect(can).toHaveBeenLastCalledWith({ type: "user", id: "user-1" }, "feedbackDirectory.read", {
        type: "feedbackDirectory",
        id: directoryId,
      });
    });

    test("keeps creating records open to workspace readWrite members", async () => {
      const decision = await authorize("POST", "/api/v3/feedbackRecords", userPrincipal, {
        tenant_id: directoryId,
      });

      expect(decision.status).toBe("allow");
      expect(can).toHaveBeenLastCalledWith({ type: "user", id: "user-1" }, "feedbackDirectory.write", {
        type: "feedbackDirectory",
        id: directoryId,
      });
    });
  });

  // An API key has no organization role, so the owners/managers rule above cannot apply to it. It gets
  // the equivalent instead: it may mutate only a directory that is not shared, where its workspace
  // permission unambiguously covers every record present (ENG-2189). Deletes additionally require
  // `manage`, matching DELETE everywhere else in the API (ENG-2083).
  describe("api key principal", () => {
    const workspaceWriteKey = apiKey({
      workspacePermissions: [{ workspaceId: workspaceB, workspaceName: "B", permission: "write" }],
    });
    const workspaceManageKey = apiKey({
      workspacePermissions: [{ workspaceId: workspaceB, workspaceName: "B", permission: "manage" }],
    });
    const otherOrgWriteKey = apiKey({
      organizationId: "clorg987654321098765432109",
      workspacePermissions: [{ workspaceId: workspaceB, workspaceName: "B", permission: "write" }],
    });

    // The directory from `beforeEach` is shared between workspace A and workspace B, so a key scoped to
    // B cannot be shown to own the records A's surveys ingested.
    test.each([
      ["delete", "DELETE", `/api/v3/feedbackRecords/${recordId}`],
      ["update", "PATCH", `/api/v3/feedbackRecords/${recordId}`],
      ["bulkDelete", "DELETE", `/api/v3/feedbackRecords?tenant_id=${directoryId}`],
    ])(
      "refuses %s for a workspace-scoped key in a shared directory (ENG-2189)",
      async (_op, method, path) => {
        const decision = await authorize(method, path, workspaceManageKey);

        expect(decision.status).toBe("deny");
        expect(decision.status === "deny" && decision.response.status).toBe(403);
      }
    );

    test("allows the same key to mutate once the directory belongs to one workspace only", async () => {
      vi.mocked(getFeedbackDirectoryAuthContext).mockResolvedValue({
        organizationId,
        workspaceIds: [workspaceB],
        isArchived: false,
      });

      const deleted = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, workspaceManageKey);
      const updated = await authorize("PATCH", `/api/v3/feedbackRecords/${recordId}`, workspaceManageKey);

      expect(deleted.status).toBe("allow");
      expect(updated.status).toBe("allow");
    });

    // ENG-2083: DELETE is reserved for `manage` everywhere else in the API, and record deletion is
    // unrecoverable. `write` is enough to update, but not to delete.
    test("refuses a delete at write even in a sole-workspace directory (ENG-2083)", async () => {
      vi.mocked(getFeedbackDirectoryAuthContext).mockResolvedValue({
        organizationId,
        workspaceIds: [workspaceB],
        isArchived: false,
      });

      const deleted = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, workspaceWriteKey);
      const bulkDeleted = await authorize(
        "DELETE",
        `/api/v3/feedbackRecords?tenant_id=${directoryId}`,
        workspaceWriteKey
      );
      const updated = await authorize("PATCH", `/api/v3/feedbackRecords/${recordId}`, workspaceWriteKey);

      expect(deleted.status).toBe("deny");
      // bulkDelete moved write -> manage alongside the single delete, so it must move with it.
      expect(bulkDeleted.status).toBe("deny");
      expect(updated.status).toBe("allow");
    });

    // Runs against the shared directory from `beforeEach`, so it also pins that ENG-2189 did not
    // over-reach into reads and creates.
    test("allows a workspace write key to create and read records", async () => {
      const created = await authorize("POST", "/api/v3/feedbackRecords", workspaceWriteKey, {
        tenant_id: directoryId,
      });
      const read = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, workspaceWriteKey);

      expect(created.status).toBe("allow");
      expect(read.status).toBe("allow");
    });

    // The cross-organization guard has to hold on reads as well as mutations, so it cannot be dropped
    // on one path without a failure here.
    test("refuses a key from another organization, on a mutation and on a read alike", async () => {
      const deleted = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, otherOrgWriteKey);
      const read = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, otherOrgWriteKey);

      expect(deleted.status).toBe("deny");
      expect(deleted.status === "deny" && deleted.response.status).toBe(403);
      expect(read.status).toBe("deny");
    });
  });

  test("denies everything for an archived directory", async () => {
    vi.mocked(getFeedbackDirectoryAuthContext).mockResolvedValue({
      organizationId,
      workspaceIds: [workspaceA, workspaceB],
      isArchived: true,
    });

    const decision = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

    expect(decision.status).toBe("deny");
    expect(can).not.toHaveBeenCalled();
  });

  // The directory-not-found half of the combined guard (!feedbackDirectory ||
  // feedbackDirectory.isArchived) — only the isArchived half is exercised above.
  test("denies everything when the directory cannot be resolved", async () => {
    vi.mocked(getFeedbackDirectoryAuthContext).mockResolvedValue(null);

    const decision = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

    expect(decision.status).toBe("deny");
    expect(decision.status === "deny" && decision.response.status).toBe(403);
  });

  test("assigns authenticated gateway checks to the feedback gateway rollout surface", async () => {
    await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

    expect(withAuthorizationSurface).toHaveBeenCalledWith("feedback_gateway", expect.any(Function));
  });

  test("does not put directory or record identifiers in authorization logs", async () => {
    await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(directoryId);
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(recordId);
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(directoryId);
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(recordId);
  });

  test("propagates central evaluator failures instead of converting them to denial", async () => {
    vi.mocked(can).mockRejectedValue(new Error("evaluator unavailable"));

    await expect(authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal)).rejects.toThrow(
      "evaluator unavailable"
    );
  });
});
