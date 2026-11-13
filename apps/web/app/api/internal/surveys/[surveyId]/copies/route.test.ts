import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  queueAuditEvent: vi.fn(),
  applyRateLimit: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  copySurveyToOtherWorkspace: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/helper", () => ({
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/modules/survey/list/lib/survey", () => ({
  copySurveyToOtherWorkspace: mocks.copySurveyToOtherWorkspace,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const SOURCE_WORKSPACE_ID = "clsource111111111111111111";
const TARGET_WORKSPACE_ID = "cltarget111111111111111111";
const COPY_ID = "clcopy1111111111111111111";
const actor = { type: "user", id: USER_ID };

const storedCopy = (overrides: Record<string, unknown> = {}) => ({
  id: COPY_ID,
  workspaceId: TARGET_WORKSPACE_ID,
  segment: null,
  triggers: [],
  languages: [],
  embeddedFields: [],
  ...overrides,
});

const copy = (
  body: unknown = { targetWorkspaceId: TARGET_WORKSPACE_ID },
  { headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/copies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(SOURCE_WORKSPACE_ID);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.copySurveyToOtherWorkspace.mockResolvedValue(storedCopy());
});

describe("POST /api/internal/surveys/{surveyId}/copies", () => {
  test("copies the survey for a writer of both workspaces who can read it, and audits it", async () => {
    const response = await copy();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ id: COPY_ID, workspaceId: TARGET_WORKSPACE_ID });
    expect(checkedActions()).toEqual([
      ["workspace.write", { type: "workspace", id: SOURCE_WORKSPACE_ID }],
      ["workspace.write", { type: "workspace", id: TARGET_WORKSPACE_ID }],
      ["survey.read", { type: "survey", id: SURVEY_ID }],
    ]);
    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.read", { type: "survey", id: SURVEY_ID });
    expect(operationLimits()).toEqual([
      [rateLimitConfigs.actions.stateMutation.namespace, TARGET_WORKSPACE_ID],
    ]);
    expect(mocks.copySurveyToOtherWorkspace).toHaveBeenCalledWith(
      SOURCE_WORKSPACE_ID,
      SURVEY_ID,
      TARGET_WORKSPACE_ID,
      USER_ID
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "copiedToOtherWorkspace",
        targetType: "survey",
        status: "success",
        organizationId: ORG_ID,
        targetId: SURVEY_ID,
        newObject: storedCopy(),
      })
    );
  });

  test("passes on why the copy has no custom CSS", async () => {
    mocks.copySurveyToOtherWorkspace.mockResolvedValue(storedCopy({ customCssNotice: "plan_required" }));

    const { data } = await (await copy()).json();
    expect(data).toEqual({ id: COPY_ID, workspaceId: TARGET_WORKSPACE_ID, customCssNotice: "plan_required" });
  });

  // ENG-3282: workspace write does not reach a restricted survey.
  test("refuses a workspace writer who cannot read the source survey, copying nothing", async () => {
    mocks.can.mockImplementation(async (_actor, action: string) => action !== "survey.read");

    const response = await copy();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
    expect(mocks.applyRateLimit).not.toHaveBeenCalledWith(
      rateLimitConfigs.actions.stateMutation,
      expect.anything()
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "copiedToOtherWorkspace", status: "failure" })
    );
  });

  test.each([
    ["source", SOURCE_WORKSPACE_ID],
    ["target", TARGET_WORKSPACE_ID],
  ])("refuses a caller who can't write the %s workspace", async (_label, workspaceId) => {
    mocks.can.mockImplementation(
      async (_actor, action: string, resource: { id: string }) =>
        !(action === "workspace.write" && resource.id === workspaceId)
    );

    expect((await copy()).status).toBe(403);
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a target workspace in another organization, before any check", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockImplementation(async (workspaceId: string) =>
      workspaceId === TARGET_WORKSPACE_ID ? "clotherorg1111111111111111" : ORG_ID
    );

    const response = await copy();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test.each([
    [
      "survey",
      () =>
        mocks.getWorkspaceIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID)),
    ],
    [
      "target workspace",
      () =>
        mocks.getOrganizationIdFromWorkspaceId.mockImplementation(async (workspaceId: string) => {
          if (workspaceId === TARGET_WORKSPACE_ID) throw new ResourceNotFoundError("Workspace", workspaceId);
          return ORG_ID;
        }),
    ],
  ])("answers the uniform 403 for a %s that doesn't exist", async (_label, arrange) => {
    arrange();

    const response = await copy();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test("answers 429 once the target workspace's state-mutation budget is spent, copying nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await copy()).status).toBe(429);
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test("answers 403 with the reason when the target workspace is at its survey limit", async () => {
    mocks.copySurveyToOtherWorkspace.mockRejectedValue(
      new OperationNotAllowedError("The target workspace has reached its survey limit")
    );

    const response = await copy();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("The target workspace has reached its survey limit");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: SURVEY_ID })
    );
  });

  test("answers 422 with the reason for a survey the copy can't take", async () => {
    mocks.copySurveyToOtherWorkspace.mockRejectedValue(new InvalidInputError("Invalid image URL in block"));

    const response = await copy();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Invalid image URL in block");
  });

  test.each([
    ["no target workspace", {}],
    ["a target that isn't an id", { targetWorkspaceId: "not-an-id" }],
    ["an unknown key", { targetWorkspaceId: TARGET_WORKSPACE_ID, name: "Copy" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await copy(body)).status).toBe(400);
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request", async () => {
    expect((await copy(undefined, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.copySurveyToOtherWorkspace).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await copy()).status).toBe(401);
  });
});
