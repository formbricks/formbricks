import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import {
  createdResponse,
  noContentResponse,
  problemBadRequest,
  problemConfirmationRequired,
  problemConflict,
  problemForbidden,
  problemSurveyHasLinkedCreatives,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { generateV3Survey } from "@/app/api/v3/surveys/generate/operations";
import {
  archiveV3Survey,
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  editV3SurveyBlocksResponse,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  restoreV3Survey,
  setV3SurveyBlockOrderResponse,
  validateV3SurveyFromRawInput,
} from "@/app/api/v3/surveys/lib/operations";
import { ZMcpSurveyLifecycleOutput } from "./survey-output-schemas";
import { buildListSurveysSearchParams, registerSurveyTools } from "./surveys";
import {
  FULL_MCP_GRANT,
  type TToolHandler,
  type ToolCallEra,
  callToolOverHttp,
  elicitingOAuthContext,
  errorText,
} from "./test-utils";

// Asserted as a shape, not by calling getMcpResourceUrl() here: comparing production's value with
// itself would still pass if it regressed to the bare path "/api/mcp" — the ENG-2173 bug. The
// invariant that matters is that the audit apiUrl is absolute, because the audit schema validates it
// with z.url() and drops the whole event otherwise.
const ABSOLUTE_MCP_AUDIT_URL = expect.stringMatching(/^https?:\/\/[^/]+\/api\/mcp$/);

// vitestSetup stubs createHash, which the sealed confirmation state depends on.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  archiveV3Survey: vi.fn(),
  createV3SurveyResponseFromRawInput: vi.fn(),
  deleteV3Survey: vi.fn(),
  getV3Survey: vi.fn(),
  listV3Surveys: vi.fn(),
  patchV3SurveyResponse: vi.fn(),
  restoreV3Survey: vi.fn(),
  editV3SurveyBlocksResponse: vi.fn(),
  setV3SurveyBlockOrderResponse: vi.fn(),
  // Real behaviour, not a vi.fn: the handler mints insert ids through this before building the
  // `applied` list, so stubbing it out would hide whether the id reaches the caller. The real
  // implementation is covered in app/api/v3/surveys/lib/operations.test.ts.
  withGeneratedInsertIds: (ops: { op: string; block?: Record<string, unknown> }[]) =>
    ops.map((op) =>
      op.op === "insert" && op.block?.id === undefined
        ? { ...op, block: { ...op.block, id: "generated_block_id" } }
        : op
    ),
  validateV3SurveyFromRawInput: vi.fn(),
}));

vi.mock("@/app/api/v3/surveys/generate/operations", () => ({ generateV3Survey: vi.fn() }));

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

const readOnlyOAuthAuthInfo = {
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes: ["surveys:read"],
  extra: {
    formbricksAuthentication: {
      user: {
        id: "user_1",
        email: "person@example.com",
        name: "Person",
      },
      expires: "2026-07-01T00:00:00.000Z",
    },
    requestId: "req_tool",
    authMethod: "oauth",
    grant: FULL_MCP_GRANT,
  },
};

const writeOnlyOAuthAuthInfo = {
  ...readOnlyOAuthAuthInfo,
  scopes: ["surveys:write"],
};

function createToolServer() {
  const tools = new Map<
    string,
    {
      config: Record<string, unknown>;
      handler: TToolHandler;
    }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };

  registerSurveyTools(server as unknown as Parameters<typeof registerSurveyTools>[0]);
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
        status: { in: ["draft", "inProgress", "archived"] },
        type: { in: ["link"] },
      },
    });

    expect(params.get("workspaceId")).toBe("clxx1234567890123456789012");
    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("includeTotalCount")).toBe("false");
    expect(params.get("sortBy")).toBe("updatedAt");
    expect(params.get("filter[name][contains]")).toBe("Onboarding");
    expect(params.getAll("filter[status][in]")).toEqual(["draft", "inProgress", "archived"]);
    expect(params.getAll("filter[type][in]")).toEqual(["link"]);
  });

  test("accepts the archived pseudo-status the v3 list supports", () => {
    const { tools } = createToolServer();
    const schema = tools.get("list_surveys")!.config.inputSchema as z.ZodType;

    expect(
      schema.safeParse({
        workspaceId: "clxx1234567890123456789012",
        filter: { status: { in: ["archived"] } },
      }).success
    ).toBe(true);
  });
});

describe("registerSurveyTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
  });

  test("registers survey tools with planning annotations", () => {
    const { server, tools } = createToolServer();

    expect(server.registerTool).toHaveBeenCalledTimes(11);
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
    expect(tools.get("edit_survey_blocks")?.config).toMatchObject({
      title: "Edit survey blocks",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
    // Idempotent unlike every other survey write: the same order yields the same survey, and an
    // order that already matches performs no write at all.
    expect(tools.get("set_survey_block_order")?.config).toMatchObject({
      title: "Set survey block order",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
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
    expect(
      Object.keys((tools.get("create_survey")!.config.inputSchema as z.ZodObject<z.ZodRawShape>).shape)
    ).toEqual(
      expect.arrayContaining([
        "workspaceId",
        "name",
        "type",
        "status",
        "defaultLanguage",
        "metadata",
        "languages",
        "showLanguageSwitch",
        "autoSelectLanguage",
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
    expect(
      Object.keys((tools.get("validate_survey")!.config.inputSchema as z.ZodObject<z.ZodRawShape>).shape)
    ).toEqual(expect.arrayContaining(["operation", "surveyId", "data"]));
    expect(tools.get("patch_survey")?.config).toMatchObject({
      title: "Patch survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
    expect(tools.get("delete_survey")?.config).toMatchObject({
      title: "Delete survey (deprecated)",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    });
    // Deprecated in 6.3, removed in 7.0 (ENG-6575): agents are pointed at the reversible archive.
    expect(String(tools.get("delete_survey")?.config.description)).toMatch(
      /^Deprecated: removed in Formbricks 7\.0\. Use archive_survey instead/
    );
    expect(tools.get("archive_survey")?.config).toMatchObject({
      title: "Archive survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    });
    expect(tools.get("restore_survey")?.config).toMatchObject({
      title: "Restore survey",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    });
    // Both advertise the v3 lifecycle ack, and the schema is the one parsed below in the handler tests:
    // deleting the registration's outputSchema or weakening the shared schema fails here.
    expect(tools.get("archive_survey")?.config.outputSchema).toBe(ZMcpSurveyLifecycleOutput);
    expect(tools.get("restore_survey")?.config.outputSchema).toBe(ZMcpSurveyLifecycleOutput);
    // A complete ack: ids are cuid2, so a non-cuid2 id is rejected even when every other field is right.
    const ack = { status: "paused" as const, archivedAt: null };
    expect(
      ZMcpSurveyLifecycleOutput.safeParse({ data: { id: "tz4a98xxat96iws9zmbrgj3a", ...ack } }).success
    ).toBe(true);
    expect(ZMcpSurveyLifecycleOutput.safeParse({ data: { id: "survey_1", ...ack } }).success).toBe(false);
  });

  /**
   * Generation persists nothing, so it is read-only to a client, but it is never idempotent: each call
   * is a fresh model run that spends from the caller's AI budget.
   */
  test("generate_survey is a non-idempotent read that takes the v3 generate body", () => {
    const { tools } = createToolServer();

    expect(tools.get("generate_survey")?.config).toMatchObject({
      title: "Generate survey draft",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    });
    const inputSchema = tools.get("generate_survey")?.config.inputSchema as
      | z.ZodObject<z.ZodRawShape>
      | undefined;
    expect(Object.keys(inputSchema?.shape ?? {}).sort()).toEqual([
      "language",
      "prompt",
      "surveyLanguage",
      "type",
      "workspaceId",
    ]);
    expect(tools.get("generate_survey")?.config.outputSchema).toBeDefined();
  });

  test("generate_survey calls the shared generate operation and returns the draft", async () => {
    const { tools } = createToolServer();
    const draft = {
      language: "en-US",
      payload: { workspaceId: "clxx1234567890123456789012", name: "Onboarding" },
      validation: { valid: true, invalid_params: [], languages: [] },
    };
    vi.mocked(generateV3Survey).mockResolvedValue(successResponse(draft, { requestId: "req_tool" }));
    const input = {
      workspaceId: "clxx1234567890123456789012",
      prompt: "Ask new users what slowed them down during onboarding",
      type: "link",
    };

    const result = await tools.get("generate_survey")!.handler(input, {
      http: { authInfo: writeOnlyOAuthAuthInfo },
    });

    expect(generateV3Survey).toHaveBeenCalledWith({
      body: input,
      authentication: writeOnlyOAuthAuthInfo.extra.formbricksAuthentication,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: draft, requestId: "req_tool" });
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
      { http: { authInfo } }
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
      { http: { authInfo } }
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 400,
      code: "bad_request",
      requestId: "req_bad",
      invalid_params: [{ name: "limit", reason: "Too big" }],
    });
  });

  // Targeting filters carry literal contact attribute values, which list_segments gates on Segments and
  // Contact attributes: Read. A survey tool leaves them out for a caller without both, over MCP only.
  describe("an app survey's targeting", () => {
    const survey = {
      id: "clxx1234567890123456789012",
      type: "app",
      targeting: { filters: [{ attributeKey: "email", value: "ceo@example.com" }] },
    };
    const withoutTargeting = { id: survey.id, type: "app" };
    const oauthWith = (scopes: string[], permissions: Record<string, string>) => ({
      ...readOnlyOAuthAuthInfo,
      scopes,
      extra: { ...readOnlyOAuthAuthInfo.extra, grant: { access: "all", permissions } },
    });
    const getWith = async (callerAuthInfo: unknown) => {
      const { tools } = createToolServer();
      vi.mocked(getV3Survey).mockResolvedValue(successResponse(survey, { requestId: "req_tool" }));
      return tools
        .get("get_survey")!
        .handler({ surveyId: survey.id }, { http: { authInfo: callerAuthInfo } });
    };

    test.each([
      ["Surveys: Read alone", oauthWith(["surveys:read", "audience:read"], { surveys: "read" })],
      [
        "Segments but not Contact attributes",
        oauthWith(["surveys:read", "audience:read"], { surveys: "read", segments: "read" }),
      ],
      [
        "a grant with both, on a token without audience:read",
        oauthWith(["surveys:read"], FULL_MCP_GRANT.permissions),
      ],
      ["an API key without audience:read", authInfo],
    ])("is left out for %s, in the text too", async (_case, callerAuthInfo) => {
      const result = await getWith(callerAuthInfo);

      expect(result.structuredContent).toEqual({ data: withoutTargeting, requestId: "req_tool" });
      expect(JSON.parse(result.content[0].text)).toEqual({ data: withoutTargeting, requestId: "req_tool" });
    });

    test.each([
      [
        "Segments and Contact attributes: Read",
        oauthWith(["surveys:read", "audience:read"], {
          surveys: "read",
          segments: "read",
          contactAttributes: "read",
        }),
      ],
      ["an API key with audience:read", { ...authInfo, scopes: ["surveys:read", "audience:read"] }],
    ])("is returned for %s", async (_case, callerAuthInfo) => {
      const result = await getWith(callerAuthInfo);

      expect(result.structuredContent).toEqual({ data: survey, requestId: "req_tool" });
    });

    test("is left out of every listed survey", async () => {
      const { tools } = createToolServer();
      vi.mocked(listV3Surveys).mockResolvedValue(
        successListResponse(
          [survey, { id: "link", type: "link" }],
          { limit: 20, nextCursor: null },
          {
            requestId: "req_tool",
          }
        )
      );

      const result = await tools
        .get("list_surveys")!
        .handler({ workspaceId: "clws1234567890123456789012" }, { http: { authInfo } });

      expect(result.structuredContent.data).toEqual([withoutTargeting, { id: "link", type: "link" }]);
    });

    test("is left out of a patched survey", async () => {
      const { tools } = createToolServer();
      vi.mocked(patchV3SurveyResponse).mockResolvedValue(successResponse(survey, { requestId: "req_tool" }));

      const result = await tools
        .get("patch_survey")!
        .handler({ surveyId: survey.id, data: { name: "Renamed" } }, { http: { authInfo } });

      expect(result.structuredContent.data).toEqual(withoutTargeting);
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
      { http: { authInfo } }
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
    const auditLog = { status: "failure" as const };
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
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(createV3SurveyResponseFromRawInput).mockResolvedValue(
      createdResponse({ id: "clxx1234567890123456789012" }, { requestId: "req_tool", location: "/survey" })
    );

    const result = await tools.get("create_survey")!.handler(createBody, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "survey", ABSOLUTE_MCP_AUDIT_URL);
    expect(createV3SurveyResponseFromRawInput).toHaveBeenCalledWith({
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
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValue(
      successResponse({ valid: true, operation: "create", invalid_params: [] }, { requestId: "req_tool" })
    );

    const result = await tools.get("validate_survey")!.handler(validationBody, { http: { authInfo } });

    expect(validateV3SurveyFromRawInput).toHaveBeenCalledWith({
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

  test("validate_survey runs the custom CSS variant read-only, even for a read-scoped OAuth token", async () => {
    const { tools } = createToolServer();
    const validationBody = {
      operation: "customCss" as const,
      workspaceId: "clxx1234567890123456789012",
      scope: "survey" as const,
      surveyId: "clsv1234567890123456789012",
      data: { customCss: { light: "a{}", dark: null } },
    };
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValue(
      successResponse(
        {
          valid: true,
          operation: "customCss",
          invalid_params: [],
          customCss: { light: "x", dark: null },
          warnings: [],
        },
        { requestId: "req_tool" }
      )
    );

    const result = await tools
      .get("validate_survey")!
      .handler(validationBody, { http: { authInfo: readOnlyOAuthAuthInfo } });

    expect(validateV3SurveyFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({ body: validationBody })
    );
    expect(buildV3AuditLog).not.toHaveBeenCalled();
    expect(result.structuredContent.data).toMatchObject({ valid: true, operation: "customCss" });
  });

  test("create_survey accepts custom CSS source and rejects compiled output at the tool boundary", () => {
    const { tools } = createToolServer();
    const schema = tools.get("create_survey")!.config.inputSchema as z.ZodType;
    const base = {
      workspaceId: "clxx1234567890123456789012",
      name: "Styled",
      blocks: [{ name: "Block", elements: [] }],
    };

    expect(schema.safeParse({ ...base, customCss: { light: "a{}", dark: null } }).success).toBe(true);
    expect(schema.safeParse({ ...base, customCss: null }).success).toBe(true);
    expect(
      schema.safeParse({ ...base, customCss: { light: "a{}", dark: null, compiled: "x" } }).success
    ).toBe(false);
  });

  test("create_survey takes typed embeddedFields (ENG-6930)", () => {
    const { tools } = createToolServer();
    const schema = tools.get("create_survey")!.config.inputSchema as z.ZodType;
    const base = {
      workspaceId: "clxx1234567890123456789012",
      name: "Typed",
      blocks: [{ name: "Block", elements: [] }],
    };

    expect(
      schema.safeParse({
        ...base,
        embeddedFields: [{ key: "plan_tier" }, { name: "score", source: "computed", dataType: "number" }],
      }).success
    ).toBe(true);
  });

  describe("confirmation on surveys with responses (ENG-6930)", () => {
    const surveyId = "clxx1234567890123456789012";
    const cases: [string, Record<string, unknown>, unknown, Record<string, unknown>][] = [
      [
        "patch_survey",
        { surveyId, data: { name: "Renamed" } },
        patchV3SurveyResponse,
        { body: { name: "Renamed" } },
      ],
      [
        "edit_survey_blocks",
        { surveyId, ops: [{ op: "remove", id: "blk_a" }] },
        editV3SurveyBlocksResponse,
        { body: { ops: [{ op: "remove", id: "blk_a" }] } },
      ],
      [
        "set_survey_block_order",
        { surveyId, order: ["blk_a"] },
        setV3SurveyBlockOrderResponse,
        { body: { order: ["blk_a"] } },
      ],
    ];

    test("every tool that changes a survey takes `confirm` and hands it to the operation, not the body", async () => {
      const { tools } = createToolServer();
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });

      for (const [name, input, operation, expected] of cases) {
        vi.mocked(operation as typeof patchV3SurveyResponse).mockResolvedValue(
          successResponse({ id: surveyId }, { requestId: "req_tool" })
        );
        const schema = tools.get(name)!.config.inputSchema as z.ZodType;
        expect(schema.safeParse({ ...input, confirm: true }).success, name).toBe(true);
        expect(String(tools.get(name)!.config.description), name).toMatch(/confirm: true/);

        await tools.get(name)!.handler({ ...input, confirm: true }, { http: { authInfo } });

        expect(operation, name).toHaveBeenCalledWith(
          expect.objectContaining({ ...expected, surveyId, writeConfirmation: { confirmed: true } })
        );
      }
    });

    test("relays the refusal as an error carrying the caution text", async () => {
      const { tools } = createToolServer();
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
      vi.mocked(patchV3SurveyResponse).mockResolvedValue(
        problemConfirmationRequired(
          "req_tool",
          "This survey has responses. Pass confirm: true after the user agrees."
        )
      );

      const result = await tools
        .get("patch_survey")!
        .handler({ surveyId, data: { name: "Renamed" } }, { http: { authInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({
        status: 428,
        detail: "This survey has responses. Pass confirm: true after the user agrees.",
      });
    });
  });

  test("patch_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" as const };
    const patchInput = {
      surveyId: "clxx1234567890123456789012",
      data: {
        name: "Updated survey",
      },
    };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(patchV3SurveyResponse).mockResolvedValue(
      successResponse({ id: "clxx1234567890123456789012", name: "Updated survey" }, { requestId: "req_tool" })
    );

    const result = await tools.get("patch_survey")!.handler(patchInput, { http: { authInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "survey", ABSOLUTE_MCP_AUDIT_URL);
    expect(patchV3SurveyResponse).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      body: {
        name: "Updated survey",
      },
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
      writeConfirmation: { confirmed: false },
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      data: { id: "clxx1234567890123456789012", name: "Updated survey" },
      requestId: "req_tool",
    });
  });

  // Finding 07: deleting a survey removes its responses for good, so a client that can show a prompt is
  // asked first and the model's own `confirm: true` does not skip it.
  test("delete_survey asks a client that can show a prompt before deleting, whatever the model passes", async () => {
    const { tools } = createToolServer();

    for (const input of [
      { surveyId: "clxx1234567890123456789012" },
      { surveyId: "clxx1234567890123456789012", confirm: true },
    ]) {
      const result = (await tools
        .get("delete_survey")!
        .handler(input, elicitingOAuthContext(authInfo))) as Record<string, unknown>;
      expect(result.resultType).toBe("input_required");
    }
    expect(deleteV3Survey).not.toHaveBeenCalled();
  });

  test("delete_survey passes the user's agreement to the operation", async () => {
    const { tools } = createToolServer();
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
    vi.mocked(deleteV3Survey).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

    await tools
      .get("delete_survey")!
      .handler({ surveyId: "clxx1234567890123456789012", confirm: true }, { http: { authInfo } });

    expect(deleteV3Survey).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId: "clxx1234567890123456789012",
        writeConfirmation: { confirmed: true },
      })
    );
  });

  test("delete_survey queues a successful audit log", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" as const };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(deleteV3Survey).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
        confirm: true,
      },
      { http: { authInfo } }
    );

    expect(deleteV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
      writeConfirmation: { confirmed: true },
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({
      requestId: "req_tool",
    });
  });

  test("archive_survey queues a successful audit log and returns the lifecycle ack", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" as const };
    const ack = {
      id: "clxx1234567890123456789012",
      status: "paused",
      archivedAt: "2026-11-23T10:00:00.000Z",
    };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(archiveV3Survey).mockResolvedValue(successResponse(ack, { requestId: "req_tool" }));

    const result = await tools.get("archive_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { http: { authInfo } }
    );

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "archived", "survey", ABSOLUTE_MCP_AUDIT_URL);
    expect(archiveV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({ data: ack, requestId: "req_tool" });
    expect(ZMcpSurveyLifecycleOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  test("restore_survey queues a successful audit log and returns the lifecycle ack", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" as const };
    const ack = { id: "clxx1234567890123456789012", status: "paused", archivedAt: null };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(restoreV3Survey).mockResolvedValue(successResponse(ack, { requestId: "req_tool" }));

    const result = await tools.get("restore_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { http: { authInfo } }
    );

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "restored", "survey", ABSOLUTE_MCP_AUDIT_URL);
    expect(restoreV3Survey).toHaveBeenCalledWith({
      surveyId: "clxx1234567890123456789012",
      authentication: apiKeyAuth,
      requestId: "req_tool",
      instance: "/api/mcp",
      auditLog,
    });
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(result.structuredContent).toEqual({ data: ack, requestId: "req_tool" });
    expect(ZMcpSurveyLifecycleOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  test("archive_survey and restore_survey take only a valid survey id", () => {
    const { tools } = createToolServer();
    const surveyId = "clxx1234567890123456789012";

    for (const name of ["archive_survey", "restore_survey"]) {
      const schema = tools.get(name)!.config.inputSchema as z.ZodType;
      expect(schema.safeParse({ surveyId }).success, name).toBe(true);
      expect(schema.safeParse({}).success, name).toBe(false);
      expect(schema.safeParse({ surveyId: "not-a-cuid" }).success, name).toBe(false);
      // No confirmation argument: archive and restore are reversible, and an unknown key is refused.
      expect(schema.safeParse({ surveyId, confirm: true }).success, name).toBe(false);
      expect(String(tools.get(name)!.config.description), name).not.toMatch(/confirm/i);
    }
  });

  test("a refused archive is audited as a failed archived event", async () => {
    const { tools } = createToolServer();
    const surveyId = "clxx1234567890123456789012";
    const auditLog = { status: "failure" as const };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);

    const result = await tools
      .get("archive_survey")!
      .handler({ surveyId }, { http: { authInfo: readOnlyOAuthAuthInfo } });

    expect(result.isError).toBe(true);
    expect(buildV3AuditLog).toHaveBeenCalledWith(
      expect.anything(),
      "archived",
      "survey",
      ABSOLUTE_MCP_AUDIT_URL
    );
    expect(auditLog).toMatchObject({ eventId: "req_tool", targetId: surveyId });
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
    expect(archiveV3Survey).not.toHaveBeenCalled();
  });

  test("delete_survey preserves forbidden errors without leaking resource existence", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" as const };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(deleteV3Survey).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools.get("delete_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
        confirm: true,
      },
      { http: { authInfo } }
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

  test("archive_survey preserves forbidden errors without leaking resource existence", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" as const };
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
    vi.mocked(archiveV3Survey).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools.get("archive_survey")!.handler(
      {
        surveyId: "clxx1234567890123456789012",
      },
      { http: { authInfo } }
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

  test("delete_survey relays the 409 naming the creatives that still open the survey", async () => {
    const { tools } = createToolServer();
    vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
    const creatives = [{ id: "clcr1234567890123456789012", name: "Feedback tab" }];
    vi.mocked(deleteV3Survey).mockResolvedValue(
      problemSurveyHasLinkedCreatives("req_conflict", creatives, "/api/mcp")
    );

    const result = await tools
      .get("delete_survey")!
      .handler({ surveyId: "clxx1234567890123456789012", confirm: true }, { http: { authInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 409,
      code: "survey_has_linked_creatives",
      details: { creatives },
    });
  });

  test("write tools return MCP errors for read-only OAuth scopes", async () => {
    const { tools } = createToolServer();
    const surveyId = "clxx1234567890123456789012";
    // Every write tool covered by this file, so a new one registered under `surveys:read` by mistake
    // fails here. For an OAuth user who holds the write role, this scope is the only barrier.
    const cases: [string, Record<string, unknown>, unknown][] = [
      ["delete_survey", { surveyId, confirm: true }, deleteV3Survey],
      ["archive_survey", { surveyId }, archiveV3Survey],
      ["restore_survey", { surveyId }, restoreV3Survey],
      ["edit_survey_blocks", { surveyId, ops: [{ op: "remove", id: "blk_a" }] }, editV3SurveyBlocksResponse],
      ["set_survey_block_order", { surveyId, order: ["blk_a"] }, setV3SurveyBlockOrderResponse],
      // Writes nothing, but spends AI budget on the caller's behalf: Surveys: Write, like the REST route.
      ["generate_survey", { workspaceId: surveyId, prompt: "A survey about onboarding" }, generateV3Survey],
    ];

    for (const [name, input, operation] of cases) {
      const result = await tools.get(name)!.handler(input, { http: { authInfo: readOnlyOAuthAuthInfo } });

      expect(operation, name).not.toHaveBeenCalled();
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({
        status: 403,
        code: "forbidden",
        detail: expect.stringContaining("its OAuth token lacks the scope surveys:write."),
        requestId: "req_tool",
      });
    }
  });

  // Covers the MCP scope gate only — validateV3SurveyFromRawInput is mocked here, so this passed
  // even while the real v3 operation demanded readWrite and 403'd every read-scoped caller
  // (ENG-2179). The v3 gate itself is asserted in app/api/v3/surveys/lib/operations.test.ts.
  test("validate_survey allows patch validations for read-only OAuth scopes", async () => {
    const { tools } = createToolServer();
    vi.mocked(validateV3SurveyFromRawInput).mockResolvedValue(
      successResponse({ valid: true, operation: "patch", invalid_params: [] }, { requestId: "req_tool" })
    );

    const result = await tools.get("validate_survey")!.handler(
      {
        operation: "patch",
        surveyId: "clxx1234567890123456789012",
        data: {
          name: "Updated survey",
        },
      },
      { http: { authInfo: readOnlyOAuthAuthInfo } }
    );

    expect(validateV3SurveyFromRawInput).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      data: { valid: true, operation: "patch", invalid_params: [] },
      requestId: "req_tool",
    });
  });

  test("read tools return MCP errors for OAuth tokens without read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("list_surveys")!.handler(
      {
        workspaceId: "clxx1234567890123456789012",
      },
      { http: { authInfo: writeOnlyOAuthAuthInfo } }
    );

    expect(listV3Surveys).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      code: "forbidden",
      detail: expect.stringContaining("its OAuth token lacks the scope surveys:read."),
      requestId: "req_tool",
    });
  });
});

/**
 * ENG-2256, pinned against the real SDK. Every other test in this file calls the registered handler
 * directly, which skips the SDK's `validateToolInput` — the exact reason a dropped argument was
 * invisible from our side of the boundary for as long as it was. This goes through a real `McpServer`
 * and a real `tools/call`.
 *
 * `list_surveys` rather than the ticket's `count_feedback_records`: that schema extends an
 * already-`.strict()` v3 filter schema and Zod 4's `.extend()` carries strictness over, so it would pass
 * with or without the `.strict()` this change adds. The survey schemas are plain `z.object`s, so here
 * the strictness is genuinely load-bearing and removing it fails this test.
 */
describe("tool arguments are validated by the SDK (ENG-2256)", () => {
  const callTool = (name: string, args: Record<string, unknown>, era?: ToolCallEra) =>
    callToolOverHttp({ registerTools: registerSurveyTools, authInfo, name, args, era });

  test.each(["modern", "legacy"] as const)(
    "rejects an undeclared argument instead of silently dropping it (%s era)",
    async (era) => {
      const outcome = await callTool(
        "list_surveys",
        { workspaceId: "clxx1234567890123456789012", statuses: ["draft"] },
        era
      );

      expect(outcome.result?.isError).toBe(true);
      expect(errorText(outcome)).toContain("statuses");
      // The point of the fix: the operation is never reached, so a filter the caller believed was
      // applied cannot come back as a wider result set reported as success.
      expect(listV3Surveys).not.toHaveBeenCalled();
    }
  );

  /**
   * The same failure one level down, which the first version of this change missed: `.strict()` on the
   * outer object says nothing about `filter` or its sub-objects. A misspelled nested key was dropped and
   * left `filter.status` as `{}` — an empty filter — so `list_surveys` returned every survey and reported
   * success, which is ENG-2256's exact failure mode reopened inside the object it claims to have fixed.
   * Raised in review on #8859.
   */
  test.each([
    ["filter.status.include", { filter: { status: { include: ["draft"] } } }, "include"],
    ["an unknown key on filter itself", { filter: { bogus: 1 } }, "bogus"],
  ])("rejects a misspelled nested filter key: %s", async (_label, extra, expected) => {
    const outcome = await callTool("list_surveys", {
      workspaceId: "clxx1234567890123456789012",
      ...extra,
    });

    expect(outcome.result?.isError).toBe(true);
    expect(errorText(outcome)).toContain(expected);
    expect(listV3Surveys).not.toHaveBeenCalled();
  });

  test.each(["archive_survey", "restore_survey"] as const)(
    "%s rejects an undeclared argument instead of silently dropping it",
    async (name) => {
      const outcome = await callTool(name, {
        surveyId: "clxx1234567890123456789012",
        confirm: true,
      });

      expect(outcome.result?.isError).toBe(true);
      expect(errorText(outcome)).toContain("confirm");
      expect(archiveV3Survey).not.toHaveBeenCalled();
      expect(restoreV3Survey).not.toHaveBeenCalled();
    }
  );

  test("accepts the declared spelling and reaches the operation", async () => {
    vi.mocked(listV3Surveys).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const outcome = await callTool("list_surveys", {
      workspaceId: "clxx1234567890123456789012",
      filter: { status: { in: ["draft"] } },
    });

    expect(outcome.result?.isError).toBeUndefined();
    expect(listV3Surveys).toHaveBeenCalled();
  });

  describe("block editing tools (ENG-3069)", () => {
    const surveyId = "clxx1234567890123456789012";
    const fullResource = {
      id: surveyId,
      name: "Survey",
      updatedAt: "2026-04-21T10:00:00.000Z",
      blocks: [{ id: "blk_a" }, { id: "blk_b" }],
    };

    test("edit_survey_blocks forwards the ops body and queues a successful audit log", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" as const };
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue(auditLog);
      vi.mocked(editV3SurveyBlocksResponse).mockResolvedValue(
        successResponse(fullResource, { requestId: "req_tool" })
      );

      const result = await tools.get("edit_survey_blocks")!.handler(
        {
          surveyId,
          ops: [{ op: "remove", id: "blk_b" }],
          expectedUpdatedAt: "2026-04-21T10:00:00.000Z",
        },
        { http: { authInfo } }
      );

      expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "survey", ABSOLUTE_MCP_AUDIT_URL);
      expect(editV3SurveyBlocksResponse).toHaveBeenCalledWith({
        surveyId,
        body: { ops: [{ op: "remove", id: "blk_b" }], expectedUpdatedAt: "2026-04-21T10:00:00.000Z" },
        authentication: apiKeyAuth,
        requestId: "req_tool",
        instance: "/api/mcp",
        auditLog,
        writeConfirmation: { confirmed: false },
      });
      expect(auditLog).toMatchObject({ status: "success" });
      expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
      expect(result.structuredContent).toEqual({
        data: {
          id: surveyId,
          updatedAt: "2026-04-21T10:00:00.000Z",
          blockCount: 2,
          applied: [{ op: "remove", id: "blk_b" }],
        },
        requestId: "req_tool",
      });
    });

    test("reports the generated id of an inserted block, so the agent can reference it", async () => {
      const { tools } = createToolServer();
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
      vi.mocked(editV3SurveyBlocksResponse).mockResolvedValue(
        successResponse(fullResource, { requestId: "req_tool" })
      );

      const result = await tools
        .get("edit_survey_blocks")!
        .handler(
          { surveyId, ops: [{ op: "insert", block: { name: "No id" }, position: { type: "end" } }] },
          { http: { authInfo } }
        );

      expect(result.structuredContent.data).toHaveProperty("applied", [
        { op: "insert", id: "generated_block_id" },
      ]);
      // and the operation receives the same minted id, not a second one
      expect(vi.mocked(editV3SurveyBlocksResponse).mock.calls[0][0].body).toMatchObject({
        ops: [{ block: { id: "generated_block_id" } }],
      });
    });

    test("edit_survey_blocks returns the full resource when asked for detail", async () => {
      const { tools } = createToolServer();
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
      vi.mocked(editV3SurveyBlocksResponse).mockResolvedValue(
        successResponse(fullResource, { requestId: "req_tool" })
      );

      const result = await tools
        .get("edit_survey_blocks")!
        .handler(
          { surveyId, ops: [{ op: "remove", id: "blk_b" }], response_format: "detailed" },
          { http: { authInfo } }
        );

      expect(result.structuredContent).toEqual({ data: fullResource, requestId: "req_tool" });
    });

    test("a 409 reaches the agent with both timestamps intact", async () => {
      const { tools } = createToolServer();
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
      vi.mocked(editV3SurveyBlocksResponse).mockResolvedValue(
        problemConflict("req_conflict", "stale", "/api/mcp", {
          details: {
            expectedUpdatedAt: "2026-04-21T10:00:00.000Z",
            currentUpdatedAt: "2026-04-21T11:30:00.000Z",
          },
        })
      );

      const result = await tools
        .get("edit_survey_blocks")!
        .handler({ surveyId, ops: [{ op: "remove", id: "blk_b" }] }, { http: { authInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({
        status: 409,
        details: {
          expectedUpdatedAt: "2026-04-21T10:00:00.000Z",
          currentUpdatedAt: "2026-04-21T11:30:00.000Z",
        },
      });
    });

    test("set_survey_block_order forwards the order and echoes it back concisely", async () => {
      const { tools } = createToolServer();
      vi.mocked(buildV3AuditLog, { partial: true }).mockReturnValue({ status: "failure" });
      vi.mocked(setV3SurveyBlockOrderResponse).mockResolvedValue(
        successResponse(fullResource, { requestId: "req_tool" })
      );

      const result = await tools
        .get("set_survey_block_order")!
        .handler({ surveyId, order: ["blk_b", "blk_a"] }, { http: { authInfo } });

      expect(setV3SurveyBlockOrderResponse).toHaveBeenCalledWith(
        expect.objectContaining({ surveyId, body: { order: ["blk_b", "blk_a"] } })
      );
      expect(result.structuredContent).toEqual({
        data: {
          id: surveyId,
          updatedAt: "2026-04-21T10:00:00.000Z",
          blockCount: 2,
          order: ["blk_b", "blk_a"],
        },
        requestId: "req_tool",
      });
    });

    test.each(["edit_survey_blocks", "set_survey_block_order"])(
      "%s is denied to a read-only OAuth token",
      async (toolName) => {
        const { tools } = createToolServer();
        const input =
          toolName === "edit_survey_blocks"
            ? { surveyId, ops: [{ op: "remove", id: "blk_b" }] }
            : { surveyId, order: ["blk_a"] };

        const result = await tools
          .get(toolName)!
          .handler(input, { http: { authInfo: readOnlyOAuthAuthInfo } });

        expect(result.isError).toBe(true);
        expect(editV3SurveyBlocksResponse).not.toHaveBeenCalled();
        expect(setV3SurveyBlockOrderResponse).not.toHaveBeenCalled();
      }
    );
  });
});
