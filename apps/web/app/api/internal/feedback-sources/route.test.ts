import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE } from "@/lib/survey/visibility/outbound";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST as IMPORT } from "./[feedbackSourceId]/imports/route";
import { DELETE, PATCH } from "./[feedbackSourceId]/route";
import { POST as CREATE } from "./route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  findDataset: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getFeedbackSourceScope: vi.fn(),
  getFeedbackSourceWithMappingsById: vi.fn(),
  createFeedbackSourceWithMappings: vi.fn(),
  updateFeedbackSourceWithMappings: vi.fn(),
  deleteFeedbackSource: vi.fn(),
  resolveFormbricksMappingsInput: vi.fn(),
  importHistoricalResponses: vi.fn(),
  getSurvey: vi.fn(),
  assertVisible: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@formbricks/database", () => ({ prisma: { feedbackDirectory: { findUnique: mocks.findDataset } } }));
vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourceScope: mocks.getFeedbackSourceScope,
  getFeedbackSourceWithMappingsById: mocks.getFeedbackSourceWithMappingsById,
  createFeedbackSourceWithMappings: mocks.createFeedbackSourceWithMappings,
  updateFeedbackSourceWithMappings: mocks.updateFeedbackSourceWithMappings,
  deleteFeedbackSource: mocks.deleteFeedbackSource,
}));
vi.mock("@/lib/feedback-source/mappings", () => ({
  resolveFormbricksMappingsInput: mocks.resolveFormbricksMappingsInput,
}));
vi.mock("@/lib/feedback-source/import", () => ({
  importHistoricalResponses: mocks.importHistoricalResponses,
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/survey/visibility/outbound", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/survey/visibility/outbound")>()),
  assertNewlyAttachedSurveysWorkspaceVisible: mocks.assertVisible,
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
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const DATASET_ID = "cldata1111111111111111111";
const SOURCE_ID = "clsrc11111111111111111111";
const SURVEY_ID = "clsurv1111111111111111111";

const actor = { type: "user", id: USER_ID };
const scope = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: WORKSPACE_ID,
  feedbackDirectoryId: DATASET_ID,
  type: "formbricks_survey",
  formbricksMappings: [{ surveyId: SURVEY_ID }],
  ...overrides,
});
const MAPPINGS = { type: "formbricks", mappings: [] };

type TOptions = { headers?: Record<string, string> };
const send = (method: string, url: string, body?: unknown, { headers }: TOptions = {}) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      // A test that names its own headers sends only those, so it can drop the same-origin one.
      ...(headers ?? SAME_ORIGIN_HEADERS),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const base = "http://localhost/api/internal/feedback-sources";
const sourceProps = (id = SOURCE_ID) => ({ params: Promise.resolve({ feedbackSourceId: id }) }) as never;

const formbricksSource = {
  source: { name: "Onboarding", type: "formbricks_survey", feedbackDirectoryId: DATASET_ID },
  formbricksMappings: [{ surveyId: SURVEY_ID, elementIds: ["q1"] }],
};
const create = (body: unknown = formbricksSource, options?: TOptions) =>
  CREATE(send("POST", `${base}?workspaceId=${WORKSPACE_ID}`, body, options), {
    params: Promise.resolve({}),
  } as never);
const update = (body: unknown, id = SOURCE_ID) =>
  PATCH(send("PATCH", `${base}/${id}`, body), sourceProps(id));
const remove = (id = SOURCE_ID, options?: TOptions) =>
  DELETE(send("DELETE", `${base}/${id}`, undefined, options), sourceProps(id));
const runImport = (surveyId = SURVEY_ID) =>
  IMPORT(send("POST", `${base}/${SOURCE_ID}/imports`, { surveyId }), sourceProps());

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const withoutRequestId = async (response: Response) => {
  const { requestId: _requestId, ...rest } = await response.json();
  return rest;
};
/** Refuse exactly one authorization action. */
const refuse = (refused: string) =>
  mocks.assertCan.mockImplementation(async (_actor: unknown, action: string) => {
    if (action === refused) throw new AuthorizationError("Not authorized");
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.findDataset.mockResolvedValue({
    organizationId: ORG_ID,
    workspaces: [{ workspaceId: WORKSPACE_ID }],
  });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getFeedbackSourceScope.mockResolvedValue(scope());
  mocks.getFeedbackSourceWithMappingsById.mockResolvedValue({ id: SOURCE_ID, type: "formbricks_survey" });
  mocks.createFeedbackSourceWithMappings.mockResolvedValue({ id: SOURCE_ID, name: "Onboarding" });
  mocks.updateFeedbackSourceWithMappings.mockResolvedValue({ id: SOURCE_ID, name: "Renamed" });
  mocks.deleteFeedbackSource.mockResolvedValue({ id: SOURCE_ID, name: "Onboarding" });
  mocks.resolveFormbricksMappingsInput.mockResolvedValue(MAPPINGS);
  mocks.importHistoricalResponses.mockResolvedValue({ successes: 3, failures: 0, skipped: 1 });
  mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: WORKSPACE_ID });
  mocks.assertVisible.mockResolvedValue(undefined);
});

describe("POST /api/internal/feedback-sources", () => {
  test("adds a Formbricks source, credited to the caller, and answers 201 with its id", async () => {
    const response = await create();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ id: SOURCE_ID });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "feedbackDirectoryAssignment.write", {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(mocks.resolveFormbricksMappingsInput).toHaveBeenCalledWith(
      formbricksSource.formbricksMappings,
      WORKSPACE_ID
    );
    expect(mocks.createFeedbackSourceWithMappings).toHaveBeenCalledWith(
      WORKSPACE_ID,
      { ...formbricksSource.source, createdBy: USER_ID },
      MAPPINGS
    );
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.feedbackSourceMutation,
      USER_ID
    );
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "feedbackSource",
      status: "success",
      organizationId: ORG_ID,
      targetId: SOURCE_ID,
    });
  });

  test("refuses a CSV mapping that leaves a required field unmapped with 422", async () => {
    const response = await create({
      source: { name: "Import", type: "csv", feedbackDirectoryId: DATASET_ID },
      fieldMappings: [{ sourceFieldId: "comment", targetFieldId: "value_text" }],
    });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toMatch(/CSV mapping is incomplete/);
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });

  test("answers another organization's dataset with the same 403 as a dataset that does not exist", async () => {
    mocks.findDataset.mockResolvedValue({ organizationId: "clorg22222222222222222222", workspaces: [] });
    const foreign = await create();
    mocks.findDataset.mockResolvedValue(null);
    const missing = await create();

    expect(foreign.status).toBe(403);
    expect(await withoutRequestId(foreign)).toEqual(await withoutRequestId(missing));
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });

  test("refuses a dataset not assigned to the workspace with 422 and the code the page translates", async () => {
    mocks.findDataset.mockResolvedValue({ organizationId: ORG_ID, workspaces: [] });
    const response = await create();

    expect(response.status).toBe(422);
    expect((await response.json()).details).toEqual({
      reason: "FEEDBACK_SOURCE_DIRECTORY_NOT_ASSIGNED_TO_WORKSPACE",
    });
  });

  test("refuses a caller without access to the dataset in this workspace", async () => {
    refuse("feedbackDirectoryAssignment.write");
    expect((await create()).status).toBe(403);
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });

  test("refuses a caller without write access to the workspace, before reading the dataset", async () => {
    refuse("workspace.write");
    expect((await create()).status).toBe(403);
    expect(mocks.findDataset).not.toHaveBeenCalled();
  });

  test("answers a taken name with 409", async () => {
    mocks.createFeedbackSourceWithMappings.mockRejectedValue(
      new InvalidInputError("FEEDBACK_SOURCE_NAME_DUPLICATE")
    );
    const response = await create();

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "FEEDBACK_SOURCE_NAME_DUPLICATE" });
  });

  test("refuses a survey restricted to some members with 403 survey_not_workspace_visible", async () => {
    mocks.resolveFormbricksMappingsInput.mockRejectedValue(
      new OperationNotAllowedError(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE)
    );
    const response = await create();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("survey_not_workspace_visible");
    expect(body.detail).toBe(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE);
  });

  test.each([
    ["a Formbricks source without survey mappings", { source: formbricksSource.source }],
    ["a CSV source without field mappings", { source: { ...formbricksSource.source, type: "csv" } }],
    [
      "a creator in the body",
      { ...formbricksSource, source: { ...formbricksSource.source, createdBy: USER_ID } },
    ],
    [
      "a mapping with no questions",
      { ...formbricksSource, formbricksMappings: [{ surveyId: SURVEY_ID, elementIds: [] }] },
    ],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await create(formbricksSource, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(
      403
    );
    expect(mocks.createFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/internal/feedback-sources/{feedbackSourceId}", () => {
  test("authorizes against the workspace the source lives in, and keeps the surveys it already maps", async () => {
    mocks.getFeedbackSourceScope.mockResolvedValue(scope({ workspaceId: OTHER_WORKSPACE_ID }));
    const response = await update({
      source: { name: "Renamed" },
      formbricksMappings: [{ surveyId: SURVEY_ID, elementIds: ["q1", "q2"] }],
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ id: SOURCE_ID });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
      type: "workspace",
      id: OTHER_WORKSPACE_ID,
    });
    expect(mocks.resolveFormbricksMappingsInput).toHaveBeenCalledWith(
      [{ surveyId: SURVEY_ID, elementIds: ["q1", "q2"] }],
      OTHER_WORKSPACE_ID,
      [SURVEY_ID]
    );
    expect(mocks.updateFeedbackSourceWithMappings).toHaveBeenCalledWith(
      SOURCE_ID,
      OTHER_WORKSPACE_ID,
      { name: "Renamed" },
      MAPPINGS
    );
    expect(lastAudit()).toMatchObject({
      status: "success",
      targetId: SOURCE_ID,
      oldObject: scope({ workspaceId: OTHER_WORKSPACE_ID }),
    });
  });

  test("pauses a source", async () => {
    expect((await update({ source: { status: "paused" } })).status).toBe(200);
    expect(mocks.updateFeedbackSourceWithMappings).toHaveBeenCalledWith(
      SOURCE_ID,
      WORKSPACE_ID,
      { status: "paused" },
      undefined
    );
  });

  test("answers a missing source with the same 403 as one in a workspace the caller can't write", async () => {
    mocks.getFeedbackSourceScope.mockResolvedValue(null);
    const missing = await update({ source: { name: "x" } });
    mocks.getFeedbackSourceScope.mockResolvedValue(scope({ workspaceId: OTHER_WORKSPACE_ID }));
    refuse("workspace.write");
    const unreachable = await update({ source: { name: "x" } });

    expect(missing.status).toBe(403);
    expect(await withoutRequestId(missing)).toEqual(await withoutRequestId(unreachable));
    expect(mocks.updateFeedbackSourceWithMappings).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ status: "failure", targetId: SOURCE_ID });
  });

  test("answers 400 for a sync timestamp, which is the sync's to write", async () => {
    expect((await update({ source: { lastSyncAt: null } })).status).toBe(400);
    expect(mocks.updateFeedbackSourceWithMappings).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/feedback-sources/{feedbackSourceId}", () => {
  test("removes the source with a 204 and audits what was removed", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.deleteFeedbackSource).toHaveBeenCalledWith(SOURCE_ID, WORKSPACE_ID);
    expect(lastAudit()).toMatchObject({ action: "deleted", status: "success", oldObject: { id: SOURCE_ID } });
  });

  test("refuses a caller without access to the source's dataset, and deletes nothing", async () => {
    refuse("feedbackDirectoryAssignment.write");
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteFeedbackSource).not.toHaveBeenCalled();
  });

  test("refuses a request with neither Sec-Fetch-Site nor Origin (CSRF, fail-safe)", async () => {
    expect((await remove(SOURCE_ID, { headers: {} })).status).toBe(403);
    expect(mocks.deleteFeedbackSource).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/feedback-sources/{feedbackSourceId}/imports", () => {
  test("replays the survey's responses and answers with the totals, on the import budget", async () => {
    const response = await runImport();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ successes: 3, failures: 0, skipped: 1 });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.historicalResponseImport,
      USER_ID
    );
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "survey.response_read", {
      type: "survey",
      id: SURVEY_ID,
    });
    expect(mocks.assertVisible).toHaveBeenCalledWith([SURVEY_ID]);
    expect(lastAudit()).toMatchObject({
      status: "success",
      newObject: { successes: 3, failures: 0, skipped: 1 },
    });
  });

  test("refuses a survey from another workspace, so nobody can copy its responses into their dataset", async () => {
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: OTHER_WORKSPACE_ID });
    expect((await runImport()).status).toBe(403);
    expect(mocks.importHistoricalResponses).not.toHaveBeenCalled();
  });

  test("refuses a survey whose responses the caller can't read", async () => {
    refuse("survey.response_read");
    expect((await runImport()).status).toBe(403);
    expect(mocks.importHistoricalResponses).not.toHaveBeenCalled();
  });

  test("refuses a survey restricted to some members (ENG-3283)", async () => {
    mocks.assertVisible.mockRejectedValue(new OperationNotAllowedError(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE));
    const response = await runImport();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("survey_not_workspace_visible");
    expect(mocks.importHistoricalResponses).not.toHaveBeenCalled();
  });

  test("answers 422 for a source that can't import, such as a CSV one", async () => {
    mocks.importHistoricalResponses.mockRejectedValue(
      new InvalidInputError("Historical import is only supported for Formbricks feedbackSources")
    );
    expect((await runImport()).status).toBe(422);
  });
});

describe("every source write", () => {
  test.each([
    ["create", () => create()],
    ["update", () => update({ source: { name: "Renamed" } })],
    ["delete", () => remove()],
  ])("%s spends the per-user source budget and records the source and organization", async (_name, send) => {
    expect((await send()).ok).toBe(true);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.feedbackSourceMutation,
      USER_ID
    );
    expect(lastAudit()).toMatchObject({ status: "success", organizationId: ORG_ID, targetId: SOURCE_ID });
  });
});
