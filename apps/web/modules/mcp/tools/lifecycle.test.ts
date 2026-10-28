import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { listV3ActionClasses } from "@/app/api/v3/action-classes/lib/operations";
import { listV3ContactAttributeKeys } from "@/app/api/v3/contact-attribute-keys/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, successListResponse, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { generateV3Survey } from "@/app/api/v3/surveys/generate/operations";
import { archiveV3Survey, restoreV3Survey } from "@/app/api/v3/surveys/lib/operations";
import { changeV3SurveyVisibility, getV3SurveyVisibility } from "@/app/api/v3/surveys/visibility/operations";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { registerLifecycleTools } from "./lifecycle";
import {
  ZMcpGenerateSurveyInput,
  ZMcpListActionClassesInput,
  ZMcpSetSurveyVisibilityInput,
} from "./lifecycle-schemas";

vi.mock("@/app/api/v3/action-classes/lib/operations", () => ({ listV3ActionClasses: vi.fn() }));
vi.mock("@/app/api/v3/contact-attribute-keys/lib/operations", () => ({
  listV3ContactAttributeKeys: vi.fn(),
}));
vi.mock("@/app/api/v3/surveys/generate/operations", () => ({ generateV3Survey: vi.fn() }));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  archiveV3Survey: vi.fn(),
  restoreV3Survey: vi.fn(),
}));
vi.mock("@/app/api/v3/surveys/visibility/operations", () => ({
  changeV3SurveyVisibility: vi.fn(),
  getV3SurveyVisibility: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const session = {
  user: { id: "user_1", email: "person@example.com", name: "Person" },
  expires: "2026-07-01T00:00:00.000Z",
};

const authInfoFor = (scopes: string[]) => ({
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes,
  extra: { formbricksAuthentication: session, requestId: "req_tool", authMethod: "oauth" },
});

const readAuthInfo = authInfoFor(["surveys:read"]);
const writeAuthInfo = authInfoFor(["surveys:write"]);

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const surveyId = "kj4a98xxat96iws9zmbrgj3a";

type TToolResult = { isError?: boolean; structuredContent: { data?: unknown; error?: unknown } };
type TToolHandler = (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerLifecycleTools(server as unknown as Parameters<typeof registerLifecycleTools>[0]);
  return { tools };
}

const READ_TOOLS = {
  list_action_classes: { workspaceId, limit: 50 },
  list_contact_attribute_keys: { workspaceId, limit: 50 },
  get_survey_visibility: { surveyId },
} as const;

const WRITE_TOOLS = {
  archive_survey: { input: { surveyId }, action: "archived" },
  restore_survey: { input: { surveyId }, action: "restored" },
  set_survey_visibility: { input: { surveyId, visibility: "workspace" }, action: "visibilityChanged" },
  generate_survey: {
    input: { workspaceId, prompt: "Find out why new users stop during onboarding" },
    action: undefined,
  },
} as const;

const operations = {
  list_action_classes: listV3ActionClasses,
  list_contact_attribute_keys: listV3ContactAttributeKeys,
  get_survey_visibility: getV3SurveyVisibility,
  archive_survey: archiveV3Survey,
  restore_survey: restoreV3Survey,
  set_survey_visibility: changeV3SurveyVisibility,
  generate_survey: generateV3Survey,
} as const;

describe("registerLifecycleTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(queueV3AuditLog).mockResolvedValue(undefined);
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
  });

  test("registers exactly the seven lifecycle tools", () => {
    const { tools } = createToolServer();
    expect([...tools.keys()].toSorted()).toEqual(
      [...Object.keys(READ_TOOLS), ...Object.keys(WRITE_TOOLS)].toSorted()
    );
  });

  test("marks the reads read-only and only archiving as destructive", () => {
    const { tools } = createToolServer();
    for (const name of Object.keys(READ_TOOLS)) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
      });
    }
    expect(tools.get("archive_survey")!.config.annotations).toMatchObject({ destructiveHint: true });
    for (const name of ["restore_survey", "set_survey_visibility", "generate_survey"]) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
      });
    }
  });

  test("every tool with a resource schema declares an output schema", () => {
    const { tools } = createToolServer();
    for (const name of [
      "list_action_classes",
      "list_contact_attribute_keys",
      "archive_survey",
      "restore_survey",
    ]) {
      expect(tools.get(name)!.config.outputSchema, name).toBeDefined();
    }
  });

  test.each(Object.entries(READ_TOOLS))(
    "%s needs surveys:read and never reaches the operation without it",
    async (name, input) => {
      const { tools } = createToolServer();

      const result = await tools.get(name)!.handler(input, { http: { authInfo: writeAuthInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 403 });
      expect(operations[name as keyof typeof operations]).not.toHaveBeenCalled();
    }
  );

  test.each(Object.entries(WRITE_TOOLS))(
    "%s needs surveys:write and never reaches the operation or the rate limit without it",
    async (name, { input }) => {
      const { tools } = createToolServer();

      const result = await tools.get(name)!.handler(input, { http: { authInfo: readAuthInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 403 });
      expect(operations[name as keyof typeof operations]).not.toHaveBeenCalled();
      expect(applyRateLimit).not.toHaveBeenCalled();
    }
  );

  test.each(
    Object.entries(WRITE_TOOLS).flatMap(([name, { action }]) => (action ? [[name, action] as const] : []))
  )("a refused %s is audited as a failed %s attempt on a survey", async (name, action) => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" } as { status: string; targetId?: string };
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as unknown as TV3AuditLog);

    await tools
      .get(name)!
      .handler(WRITE_TOOLS[name as keyof typeof WRITE_TOOLS].input, { http: { authInfo: readAuthInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(session, action, "survey", expect.any(String));
    expect(auditLog.targetId).toBe(surveyId);
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.any(Object));
  });

  test("generate_survey is not audited: it stores nothing", () => {
    const { tools } = createToolServer();
    expect(tools.get("generate_survey")!.config).not.toHaveProperty("audit");
  });

  describe("reference lists", () => {
    test.each([
      ["list_action_classes", listV3ActionClasses],
      ["list_contact_attribute_keys", listV3ContactAttributeKeys],
    ] as const)(
      "%s passes the page, the cursor and the caller's authentication on",
      async (name, operation) => {
        const { tools } = createToolServer();
        vi.mocked(operation).mockResolvedValue(
          successListResponse([{ id: "x" }], { limit: 10, nextCursor: null }, { requestId: "req_tool" })
        );

        const result = await tools
          .get(name)!
          .handler({ workspaceId, limit: 10, cursor: "c1" }, { http: { authInfo: readAuthInfo } });

        expect(operation).toHaveBeenCalledWith({
          workspaceId,
          limit: 10,
          cursor: "c1",
          authentication: session,
          requestId: "req_tool",
          instance: "/api/mcp",
        });
        expect(result.structuredContent).toEqual({
          data: [{ id: "x" }],
          meta: { limit: 10, nextCursor: null },
          requestId: "req_tool",
        });
      }
    );
  });

  describe("survey lifecycle", () => {
    test.each([
      ["archive_survey", archiveV3Survey, "archived"],
      ["restore_survey", restoreV3Survey, "restored"],
    ] as const)(
      "%s calls its operation with the survey id and audits a success",
      async (name, operation, action) => {
        const { tools } = createToolServer();
        const auditLog = { status: "failure" };
        vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as unknown as TV3AuditLog);
        const ack = { id: surveyId, status: "paused", archivedAt: null };
        vi.mocked(operation).mockResolvedValue(successResponse(ack, { requestId: "req_tool" }));

        const result = await tools.get(name)!.handler({ surveyId }, { http: { authInfo: writeAuthInfo } });

        expect(buildV3AuditLog).toHaveBeenCalledWith(session, action, "survey", expect.any(String));
        expect(operation).toHaveBeenCalledWith({
          surveyId,
          authentication: session,
          requestId: "req_tool",
          instance: "/api/mcp",
          auditLog,
        });
        expect(auditLog.status).toBe("success");
        expect(result.structuredContent.data).toEqual(ack);
      }
    );

    test("relays an operation refusal unchanged and audits it as a failure", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" } as { status: string; eventId?: string };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as unknown as TV3AuditLog);
      vi.mocked(archiveV3Survey).mockResolvedValue(problemForbidden("req_tool", "You are not authorized"));

      const result = await tools
        .get("archive_survey")!
        .handler({ surveyId }, { http: { authInfo: writeAuthInfo } });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 403 });
      expect(auditLog.status).toBe("failure");
      expect(auditLog.eventId).toBe("req_tool");
    });
  });

  describe("visibility", () => {
    test("get_survey_visibility reads through the operation with the caller's authentication", async () => {
      const { tools } = createToolServer();
      vi.mocked(getV3SurveyVisibility).mockResolvedValue(
        successResponse({ id: surveyId, visibility: "workspace" }, { requestId: "req_tool" })
      );

      const result = await tools
        .get("get_survey_visibility")!
        .handler({ surveyId }, { http: { authInfo: readAuthInfo } });

      expect(getV3SurveyVisibility).toHaveBeenCalledWith({
        surveyId,
        authentication: session,
        requestId: "req_tool",
        instance: "/api/mcp",
      });
      expect(result.structuredContent.data).toEqual({ id: surveyId, visibility: "workspace" });
    });

    test("set_survey_visibility applies the route's rate limit, then sends the body to the operation", async () => {
      const { tools } = createToolServer();
      const auditLog = { status: "failure" };
      vi.mocked(buildV3AuditLog).mockReturnValue(auditLog as unknown as TV3AuditLog);
      vi.mocked(changeV3SurveyVisibility).mockResolvedValue(
        successResponse({ id: surveyId, visibility: "restricted" }, { requestId: "req_tool" })
      );

      await tools
        .get("set_survey_visibility")!
        .handler({ surveyId, visibility: "restricted" }, { http: { authInfo: writeAuthInfo } });

      expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3SurveyVisibility, "user_1");
      expect(buildV3AuditLog).toHaveBeenCalledWith(
        session,
        "visibilityChanged",
        "survey",
        expect.any(String)
      );
      expect(changeV3SurveyVisibility).toHaveBeenCalledWith({
        surveyId,
        body: { visibility: "restricted" },
        authentication: session,
        requestId: "req_tool",
        instance: "/api/mcp",
        auditLog,
      });
    });

    test("set_survey_visibility answers 429 over the limit without changing anything", async () => {
      const { tools } = createToolServer();
      vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Rate limit exceeded", 30));

      const result = await tools
        .get("set_survey_visibility")!
        .handler({ surveyId, visibility: "restricted" }, { http: { authInfo: writeAuthInfo } });

      expect(changeV3SurveyVisibility).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 429 });
    });
  });

  describe("generate_survey", () => {
    const input = { workspaceId, prompt: "Find out why new users stop during onboarding", type: "link" };

    test("applies the generate rate limit, then passes the request to the operation", async () => {
      const { tools } = createToolServer();
      const generated = { language: "en-US", payload: { name: "Onboarding" }, validation: { valid: true } };
      vi.mocked(generateV3Survey).mockResolvedValue(successResponse(generated, { requestId: "req_tool" }));

      const result = await tools
        .get("generate_survey")!
        .handler(input, { http: { authInfo: writeAuthInfo } });

      expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3SurveyGenerate, "user_1");
      expect(generateV3Survey).toHaveBeenCalledWith({
        authentication: session,
        body: input,
        requestId: "req_tool",
        instance: "/api/mcp",
      });
      expect(result.structuredContent.data).toEqual(generated);
    });

    test("answers 429 over the limit without spending any AI quota", async () => {
      const { tools } = createToolServer();
      vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Rate limit exceeded", 30));

      const result = await tools
        .get("generate_survey")!
        .handler(input, { http: { authInfo: writeAuthInfo } });

      expect(generateV3Survey).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 429 });
    });
  });
});

describe("lifecycle input schemas", () => {
  test("reject an undeclared key instead of dropping it", () => {
    expect(ZMcpListActionClassesInput.safeParse({ workspaceId, extra: 1 }).success).toBe(false);
    expect(
      ZMcpSetSurveyVisibilityInput.safeParse({ surveyId, visibility: "workspace", extra: 1 }).success
    ).toBe(false);
    expect(
      ZMcpGenerateSurveyInput.safeParse({ workspaceId, prompt: "A survey about onboarding", extra: 1 })
        .success
    ).toBe(false);
  });

  test("a list page is bounded and defaults to the API's page size", () => {
    expect(ZMcpListActionClassesInput.parse({ workspaceId }).limit).toBe(50);
    expect(ZMcpListActionClassesInput.safeParse({ workspaceId, limit: 251 }).success).toBe(false);
  });

  test("visibility only takes the two values the API knows", () => {
    expect(ZMcpSetSurveyVisibilityInput.safeParse({ surveyId, visibility: "public" }).success).toBe(false);
  });

  test("a generate language is normalized by the v3 body's own rules, an unsupported one refused", () => {
    const ok = ZMcpGenerateSurveyInput.safeParse({
      workspaceId,
      prompt: "A survey about onboarding",
      surveyLanguage: "ko-KR",
    });
    expect(ok.success).toBe(true);
    expect(
      ZMcpGenerateSurveyInput.safeParse({
        workspaceId,
        prompt: "A survey about onboarding",
        surveyLanguage: "xx-XX",
      }).success
    ).toBe(false);
  });
});
