import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import {
  createV3SurveyResponse,
  deleteV3Survey,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  validateV3Survey,
} from "@/app/api/v3/surveys/lib/operations";
import { buildListSurveysSearchParams, registerSurveyTools } from "./surveys";

vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  createV3SurveyResponse: vi.fn(),
  deleteV3Survey: vi.fn(),
  getV3Survey: vi.fn(),
  listV3Surveys: vi.fn(),
  patchV3SurveyResponse: vi.fn(),
  validateV3Survey: vi.fn(),
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
  test("applies defensive defaults when optional defaults are not materialized", () => {
    const params = buildListSurveysSearchParams({
      workspaceId: "clxx1234567890123456789012",
    } as unknown as Parameters<typeof buildListSurveysSearchParams>[0]);

    expect(params.get("limit")).toBe("20");
    expect(params.has("includeTotalCount")).toBe(false);
  });

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

  test("registers survey tools with planning annotations", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(6);
    expect(tools.get("list_surveys")?.config).toMatchObject({
      title: "List surveys",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    expect(tools.get("get_survey")?.config).toMatchObject({
      title: "Get survey",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    expect(tools.get("create_survey")?.config).toMatchObject({
      title: "Create survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    });
    expect(Object.keys(tools.get("create_survey")?.config.inputSchema as Record<string, unknown>)).toEqual(
      expect.arrayContaining([
        "workspaceId",
        "name",
        "type",
        "status",
        "defaultLanguage",
        "metadata",
        "languages",
        "welcomeCard",
        "blocks",
        "endings",
        "hiddenFields",
        "variables",
      ])
    );
    expect(tools.get("validate_survey")?.config).toMatchObject({
      title: "Validate survey",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    expect(Object.keys(tools.get("validate_survey")?.config.inputSchema as Record<string, unknown>)).toEqual(
      expect.arrayContaining(["operation", "surveyId", "data"])
    );
    expect(tools.get("patch_survey")?.config).toMatchObject({
      title: "Patch survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
    expect(tools.get("delete_survey")?.config).toMatchObject({
      title: "Delete survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
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

  test("get_survey calls the shared v3 get operation", async () => {
    const { tools } = createToolServer();
    vi.mocked(getV3Survey).mockResolvedValue(
      successResponse({ id: "clxx1234567890123456789012" }, { requestId: "req_tool" })
    );

    const result = await tools.get("get_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
        lang: ["en-US"],
      },
      { authInfo }
    );

    expect(getV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      lang: ["en-US"],
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012" },
      requestId: "req_tool",
    });
  });

  test("create_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    const createBody = {
      workspaceId: "clxx1234567890123456789012",
      name: "New survey",
      type: "link",
      status: "draft",
      metadata: {},
      defaultLanguage: "en-US",
      languages: [],
      welcomeCard: { enabled: false },
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "feedback",
              type: "openText",
              headline: { "en-US": "What should we improve?" },
              required: true,
            },
          ],
        },
      ],
      endings: [],
      hiddenFields: { enabled: false, fieldIds: [] },
      variables: [],
    };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(createV3SurveyResponse).mockResolvedValue(
      createdResponse({ id: "clxx1234567890123456789012" }, { requestId: "req_tool", location: "/survey" })
    );

    const result = await tools.get("create_survey")!.handler(createBody, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "survey", "/api/mcp");
    expect(createV3SurveyResponse).toHaveBeenCalledWith({
      body: createBody,
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

  test("validate_survey calls the shared v3 validation operation without audit logging", async () => {
    const { tools } = createToolServer();
    const validationBody = {
      operation: "create" as const,
      data: {
        workspaceId: "clxx1234567890123456789012",
        name: "New survey",
      },
    };
    vi.mocked(validateV3Survey).mockResolvedValue(
      successResponse({ valid: true, operation: "create", invalid_params: [] }, { requestId: "req_tool" })
    );

    const result = await tools.get("validate_survey")!.handler(validationBody, { authInfo });

    expect(validateV3Survey).toHaveBeenCalledWith({
      body: validationBody,
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
    expect(buildV3AuditLog).not.toHaveBeenCalled();
    expect(queueV3AuditLog).not.toHaveBeenCalled();
    expect(result.structuredContent).toEqual({
      data: { valid: true, operation: "create", invalid_params: [] },
      requestId: "req_tool",
    });
  });

  test("patch_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    const patchInput = {
      surveyId: "clxx1234567890123456789012",
      data: {
        name: "Updated survey",
      },
    };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(patchV3SurveyResponse).mockResolvedValue(
      successResponse({ id: "clxx1234567890123456789012", name: "Updated survey" }, { requestId: "req_tool" })
    );

    const result = await tools.get("patch_survey")!.handler(patchInput, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "survey", "/api/mcp");
    expect(patchV3SurveyResponse).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      body: {
        name: "Updated survey",
      },
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012", name: "Updated survey" },
      requestId: "req_tool",
    });
  });

  test("delete_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as any);
    vi.mocked(deleteV3Survey).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

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
