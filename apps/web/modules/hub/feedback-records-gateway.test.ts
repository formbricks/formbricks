import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getFeedbackDirectoryAuthContext } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TGatewayAuthenticatedPrincipal } from "@/modules/gateway-auth/lib/request";
import { feedbackRecordsGatewayAuthorizer } from "./feedback-records-gateway";
import { getFeedbackRecordTenant } from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@formbricks/database/prisma", () => ({
  ApiKeyPermission: { read: "read", write: "write", manage: "manage" },
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

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
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

const accessArg = () => vi.mocked(checkAuthorizationUpdated).mock.calls.at(-1)?.[0];

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
    vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
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
        expect(accessArg()).toEqual({
          userId: "user-1",
          organizationId,
          access: [{ type: "organization", roles: ["owner", "manager"] }],
        });
      }
    );

    test("denies a delete when the caller is not an organization owner or manager", async () => {
      vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new AuthorizationError("Not authorized"));

      const decision = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

      expect(decision.status).toBe("deny");
      expect(decision.status === "deny" && decision.response.status).toBe(403);
    });

    test("keeps reads open to workspace members of any workspace sharing the directory", async () => {
      const decision = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, userPrincipal);

      expect(decision.status).toBe("allow");
      expect(accessArg()).toEqual({
        userId: "user-1",
        organizationId,
        access: [
          { type: "organization", roles: ["owner", "manager"] },
          { type: "workspaceTeam", workspaceId: workspaceA, minPermission: "read" },
          { type: "workspaceTeam", workspaceId: workspaceB, minPermission: "read" },
        ],
      });
    });

    test("keeps creating records open to workspace readWrite members", async () => {
      const decision = await authorize("POST", "/api/v3/feedbackRecords", userPrincipal, {
        tenant_id: directoryId,
      });

      expect(decision.status).toBe("allow");
      expect(accessArg()?.access).toEqual([
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId: workspaceA, minPermission: "readWrite" },
        { type: "workspaceTeam", workspaceId: workspaceB, minPermission: "readWrite" },
      ]);
    });
  });

  describe("api key principal", () => {
    const workspaceWriteKey = apiKey({
      workspacePermissions: [{ workspaceId: workspaceB, workspaceName: "B", permission: "write" }],
    });
    const orgWriteKey = apiKey({ organizationAccess: { accessControl: { read: true, write: true } } });

    test("denies a delete for a workspace-scoped write key", async () => {
      const decision = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, workspaceWriteKey);

      expect(decision.status).toBe("deny");
      expect(decision.status === "deny" && decision.response.status).toBe(403);
    });

    test("denies an update for a workspace-scoped write key", async () => {
      const decision = await authorize("PATCH", `/api/v3/feedbackRecords/${recordId}`, workspaceWriteKey);

      expect(decision.status).toBe("deny");
    });

    test("allows a delete for an organization-wide write key", async () => {
      const decision = await authorize("DELETE", `/api/v3/feedbackRecords/${recordId}`, orgWriteKey);

      expect(decision.status).toBe("allow");
    });

    test("still allows a workspace-scoped write key to create and read records", async () => {
      const created = await authorize("POST", "/api/v3/feedbackRecords", workspaceWriteKey, {
        tenant_id: directoryId,
      });
      const read = await authorize("GET", `/api/v3/feedbackRecords/${recordId}`, workspaceWriteKey);

      expect(created.status).toBe("allow");
      expect(read.status).toBe("allow");
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
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });
});
