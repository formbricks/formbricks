import { ApiKeyPermission } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { deleteV3Survey, listV3Surveys } from "@/app/api/v3/surveys/lib/operations";
import { buildListSurveysSearchParams, registerSurveyTools } from "./surveys";

vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  deleteV3Survey: vi.fn(),
  listV3Surveys: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: {
    accessControl: { read: true, write: true },
  },
  workspacePermissions: [
    {
      workspaceId: "clxx1234567890123456789012",
      workspaceName: "Workspace",
      permission: ApiKeyPermission.write,
    },
  ],
};

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["surveys:read", "surveys:write"],
  extra: {
    formbricksAuthentication: apiKeyAuth,
    requestId: "req_tool",
  },
};

function createToolServer() {
  const tools = new Map<
    string,
    {
      config: Record<string, unknown>;
      handler: (input: any, extra: any) => Promise<any>;
    }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: any) => {
      tools.set(name, { config, handler });
    }),
  };

  registerSurveyTools(server as any);
  return { server, tools };
}

describe("buildListSurveysSearchParams", () => {
  test("maps structured MCP filters to v3 query parameters", () => {
    const params = buildListSurveysSearchParams({
      workspaceId: "clxx1234567890123456789012",
      limit: 50,
      cursor: "cursor_1",
      includeTotalCount: false,
      sortBy: "updatedAt",
      filter: {
        name: { contains: "Onboarding" },
        status: { in: ["draft", "inProgress"] },
        type: { in: ["link"] },
      },
    });

    expect(params.get("workspaceId")).toBe("clxx1234567890123456789012");
    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("includeTotalCount")).toBe("false");
    expect(params.get("sortBy")).toBe("updatedAt");
    expect(params.get("filter[name][contains]")).toBe("Onboarding");
    expect(params.getAll("filter[status][in]")).toEqual(["draft", "inProgress"]);
    expect(params.getAll("filter[type][in]")).toEqual(["link"]);
  });
});

describe("registerSurveyTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test("registers list and delete tools", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(2);
    expect(tools.get("list_surveys")?.config).toMatchObject({
      title: "List surveys",
    });
    expect(tools.get("delete_survey")?.config).toMatchObject({
      title: "Delete survey",
      annotations: {
        destructiveHint: true,
      },
    });
  });

  test("list_surveys calls the shared v3 list operation and returns structured content", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Surveys).mockResolvedValue(
      successListResponse(
        [{ id: "survey_1" }],
        { limit: 20, nextCursor: null, totalCount: 1 },
        { requestId: "req_tool" }
      )
    );

    const result = await tools.get("list_surveys")!.handler(
      {
        workspaceId: "clxx1234567890123456789012",
        limit: 20,
        includeTotalCount: true,
      },
      { authInfo }
    );

    expect(listV3Surveys).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication: apiKeyAuth,
        requestId: "req_tool",
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent).toEqual({
      data: [{ id: "survey_1" }],
      meta: { limit: 20, nextCursor: null, totalCount: 1 },
      requestId: "req_tool",
    });
  });

  test("list_surveys maps v3 problem responses to MCP tool errors", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Surveys).mockResolvedValue(
      problemBadRequest("req_bad", "Invalid query parameters", {
        instance: "/api/mcp",
        invalid_params: [{ name: "limit", reason: "Too big" }],
      })
    );

    const result = await tools.get("list_surveys")!.handler(
      {
        workspaceId: "clxx1234567890123456789012",
        limit: 101,
        includeTotalCount: true,
      },
      { authInfo }
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 400,
      code: "bad_request",
      requestId: "req_bad",
      invalid_params: [{ name: "limit", reason: "Too big" }],
    });
  });

  test("delete_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(deleteV3Survey).mockResolvedValue(
      successResponse({ id: "clxx1234567890123456789012" }, { requestId: "req_tool" })
    );

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { authInfo }
    );

    expect(deleteV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012" },
      requestId: "req_tool",
    });
  });

  test("delete_survey preserves forbidden errors without leaking resource existence", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(deleteV3Survey).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { authInfo }
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: "You are not authorized to access this resource",
      requestId: "req_forbidden",
    });
    expect(auditLog).toMatchObject({
      status: "failure",
      eventId: "req_tool",
    });
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });
});
