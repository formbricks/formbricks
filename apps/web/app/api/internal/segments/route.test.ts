import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { MAX_SEGMENT_SURVEYS } from "@formbricks/types/segment";
import { GET as getAttributeValues } from "@/app/api/internal/contact-attribute-keys/[contactAttributeKeyId]/values/route";
import { POST as resetSurveySegment } from "@/app/api/internal/surveys/[surveyId]/segment/resets/route";
import { PUT as attachSurveySegment } from "@/app/api/internal/surveys/[surveyId]/segment/route";
import { GET as listFilterSurveys } from "@/app/api/internal/workspaces/[workspaceId]/segment-filter-surveys/route";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST as copySegment } from "./[segmentId]/copies/route";
import { DELETE, PATCH } from "./[segmentId]/route";
import { POST } from "./route";
import { SEGMENT_DESCRIPTION_MAX_LENGTH, SEGMENT_TITLE_MAX_LENGTH } from "./schemas";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganization: vi.fn(),
  getOrganizationIdFromSegmentId: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromContactAttributeKeyId: vi.fn(),
  getWorkspaceIdFromSegmentId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getSurveyWorkspaceIdMap: vi.fn(),
  getSegment: vi.fn(),
  createSegment: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
  cloneSegment: vi.fn(),
  resetSegmentInSurvey: vi.fn(),
  getSurveyRefsForWorkspace: vi.fn(),
  loadNewSegmentInSurvey: vi.fn(),
  getDistinctAttributeValues: vi.fn(),
  getUserVisibleSurveyWhere: vi.fn(),
  resolveSurveyActorContext: vi.fn(),
  restoreHiddenSegmentSurveyIds: vi.fn(),
  assertSurveysInWorkspace: vi.fn(),
  assertSurveyInteractionSurveyIds: vi.fn(),
  assertSegmentSurveyFiltersVisible: vi.fn(),
  assertAddedSegmentSurveyFiltersVisible: vi.fn(),
  checkForRecursiveSegmentFilter: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSegmentId: mocks.getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromContactAttributeKeyId: mocks.getWorkspaceIdFromContactAttributeKeyId,
  getWorkspaceIdFromSegmentId: mocks.getWorkspaceIdFromSegmentId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  cloneSegment: mocks.cloneSegment,
  createSegment: mocks.createSegment,
  deleteSegment: mocks.deleteSegment,
  getSegment: mocks.getSegment,
  getSurveyRefsForWorkspace: mocks.getSurveyRefsForWorkspace,
  getSurveyWorkspaceIdMap: mocks.getSurveyWorkspaceIdMap,
  resetSegmentInSurvey: mocks.resetSegmentInSurvey,
  updateSegment: mocks.updateSegment,
}));
vi.mock("@/modules/ee/contacts/segments/lib/helper", () => ({
  assertAddedSegmentSurveyFiltersVisible: mocks.assertAddedSegmentSurveyFiltersVisible,
  assertSegmentSurveyFiltersVisible: mocks.assertSegmentSurveyFiltersVisible,
  assertSurveyInteractionSurveyIds: mocks.assertSurveyInteractionSurveyIds,
  assertSurveysInWorkspace: mocks.assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter: mocks.checkForRecursiveSegmentFilter,
  restoreHiddenSegmentSurveyIds: mocks.restoreHiddenSegmentSurveyIds,
}));
vi.mock("@/lib/survey/service", () => ({ loadNewSegmentInSurvey: mocks.loadNewSegmentInSurvey }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  getUserVisibleSurveyWhere: mocks.getUserVisibleSurveyWhere,
  resolveSurveyActorContext: mocks.resolveSurveyActorContext,
}));
vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({
  getDistinctAttributeValues: mocks.getDistinctAttributeValues,
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    targetId: "unknown",
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
const SEGMENT_ID = "clsegment1111111111111111";
const COPY_ID = "clsegment2222222222222222";
const SURVEY_ID = "clsurvey11111111111111111";
const SURVEY_2_ID = "clsurvey22222222222222222";
const KEY_ID = "clkey11111111111111111111";
const DATE = new Date("2026-10-01T10:00:00.000Z");
const HIDDEN_FILTERS_MESSAGE = "Segment filters reference a survey you don't have access to";

const visibleWhere = { OR: [{ visibility: "workspace" }, { ownerId: USER_ID }] };
const memberActor = { enforced: true, isOrganizationAdmin: false, kind: "user", userId: USER_ID };

/** A filter tree the shared schema takes: one attribute filter. */
const FILTERS = [
  {
    id: "clfilter0000000000000001",
    connector: null,
    resource: {
      id: "clresource00000000000001",
      root: { type: "attribute", contactAttributeKey: "plan" },
      qualifier: { operator: "equals" },
      value: "pro",
    },
  },
];

const storedSegment = (overrides: Record<string, unknown> = {}) => ({
  id: SEGMENT_ID,
  createdAt: DATE,
  updatedAt: DATE,
  title: "Power users",
  description: null,
  isPrivate: false,
  filters: FILTERS,
  workspaceId: WORKSPACE_ID,
  surveys: [SURVEY_ID],
  activeSurveys: [{ id: SURVEY_ID, name: "Restricted survey" }],
  inactiveSurveys: [],
  ...overrides,
});

const serialized = (overrides: Record<string, unknown> = {}) => {
  const { activeSurveys: _active, inactiveSurveys: _inactive, ...segment } = storedSegment(overrides);
  return { ...segment, createdAt: DATE.toISOString(), updatedAt: DATE.toISOString() };
};

const json = (method: string, url: string, body?: unknown, headers = SAME_ORIGIN_HEADERS) =>
  new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const BASE = "http://localhost/api/internal";
const segmentProps = (segmentId = SEGMENT_ID) => ({ params: Promise.resolve({ segmentId }) }) as never;
const surveyProps = { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never;

const createBody = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: WORKSPACE_ID,
  title: "Power users",
  description: "",
  isPrivate: false,
  filters: FILTERS,
  ...overrides,
});

const create = (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(json("POST", `${BASE}/segments`, body, headers), {} as never);
const update = (body: unknown) =>
  PATCH(json("PATCH", `${BASE}/segments/${SEGMENT_ID}`, body), segmentProps());
const remove = () => DELETE(json("DELETE", `${BASE}/segments/${SEGMENT_ID}`), segmentProps());
const copy = (body: unknown = { surveyId: SURVEY_ID }) =>
  copySegment(json("POST", `${BASE}/segments/${SEGMENT_ID}/copies`, body), segmentProps());
const attach = (body: unknown = { segmentId: SEGMENT_ID }) =>
  attachSurveySegment(json("PUT", `${BASE}/surveys/${SURVEY_ID}/segment`, body), surveyProps);
const reset = () =>
  resetSurveySegment(json("POST", `${BASE}/surveys/${SURVEY_ID}/segment/resets`), surveyProps);
const attributeValues = () =>
  getAttributeValues(new NextRequest(`${BASE}/contact-attribute-keys/${KEY_ID}/values`), {
    params: Promise.resolve({ contactAttributeKeyId: KEY_ID }),
  } as never);
const filterSurveys = () =>
  listFilterSurveys(new NextRequest(`${BASE}/workspaces/${WORKSPACE_ID}/segment-filter-surveys`), {
    params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
  } as never);

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);
const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);
/** Workspace checks pass; the survey-level one answers `surveyAllowed`. */
const actAs = (surveyAllowed: boolean) =>
  mocks.can.mockImplementation(
    async (_actor, _action, resource: { type: string }) => resource.type !== "survey" || surveyAllowed
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getIsContactsEnabled.mockResolvedValue(true);
  mocks.getOrganization.mockResolvedValue({ id: ORG_ID });
  mocks.getOrganizationIdFromSegmentId.mockResolvedValue(ORG_ID);
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromContactAttributeKeyId.mockResolvedValue(WORKSPACE_ID);
  mocks.getWorkspaceIdFromSegmentId.mockResolvedValue(WORKSPACE_ID);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.getSurveyWorkspaceIdMap.mockResolvedValue(
    new Map([
      [SURVEY_ID, WORKSPACE_ID],
      [SURVEY_2_ID, WORKSPACE_ID],
    ])
  );
  mocks.getUserVisibleSurveyWhere.mockResolvedValue(visibleWhere);
  mocks.resolveSurveyActorContext.mockResolvedValue(memberActor);
  mocks.restoreHiddenSegmentSurveyIds.mockImplementation(async (filters: unknown) => filters);
  mocks.getSegment.mockResolvedValue(storedSegment());
  mocks.createSegment.mockResolvedValue(storedSegment());
  mocks.updateSegment.mockResolvedValue(storedSegment({ title: "Renamed" }));
  mocks.deleteSegment.mockResolvedValue(storedSegment());
  mocks.cloneSegment.mockResolvedValue(storedSegment({ id: COPY_ID, title: "Copy of Power users (1)" }));
  mocks.resetSegmentInSurvey.mockResolvedValue(
    storedSegment({ title: SURVEY_ID, isPrivate: true, filters: [] })
  );
  mocks.loadNewSegmentInSurvey.mockResolvedValue({ id: SURVEY_ID, segment: storedSegment() });
  mocks.getDistinctAttributeValues.mockResolvedValue(["free", "pro"]);
  mocks.getSurveyRefsForWorkspace.mockResolvedValue([
    { id: SURVEY_ID, name: "Onboarding", status: "inProgress" },
  ]);
});

describe("the segment write gate, shared by every write", () => {
  test.each([
    ["POST /segments", () => create(createBody())],
    ["PATCH /segments/{id}", () => update({ title: "Renamed" })],
    ["DELETE /segments/{id}", () => remove()],
    ["POST /segments/{id}/copies", () => copy()],
    ["PUT /surveys/{id}/segment", () => attach()],
    ["POST /surveys/{id}/segment/resets", () => reset()],
  ])("%s authorizes the workspace, then charges its budget, then asks the licence", async (_label, call) => {
    await call();
    expect(checkedActions()[0]).toEqual(["workspace.write", { type: "workspace", id: WORKSPACE_ID }]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
  });

  test("answers the uniform 403 to a caller who can't write the workspace, before the budget and licence", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await create(createBody());

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(operationLimits()).toEqual([]);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.createSegment).not.toHaveBeenCalled();
  });

  test("refuses without advanced targeting, with the reason", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await update({ title: "Renamed" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Advanced targeting is not allowed for this organization");
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for an organization that is gone", async () => {
    mocks.getOrganization.mockResolvedValue(null);

    const response = await remove();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.deleteSegment).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a segment that doesn't exist", async () => {
    mocks.getOrganizationIdFromSegmentId.mockRejectedValue(new ResourceNotFoundError("segment", SEGMENT_ID));

    expect((await update({ title: "Renamed" })).status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("answers 429 when the workspace's write budget is spent", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await create(createBody())).status).toBe(429);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.createSegment).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await create(createBody(), { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.createSegment).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create(createBody())).status).toBe(401);
  });

  // ENG-3282: every survey a mutation targets needs its own write permission.
  test.each([
    ["PUT /surveys/{id}/segment", () => attach(), mocks.loadNewSegmentInSurvey],
    ["POST /segments/{id}/copies", () => copy(), mocks.cloneSegment],
    ["POST /surveys/{id}/segment/resets", () => reset(), mocks.resetSegmentInSurvey],
    ["POST /segments for a survey", () => create(createBody({ surveyId: SURVEY_ID })), mocks.createSegment],
  ] as const)("%s needs survey.write on the survey it targets", async (_label, call, mutation) => {
    actAs(false);
    const refused = await call();
    expect(refused.status).toBe(403);
    expect(checkedActions()).toContainEqual(["survey.write", { type: "survey", id: SURVEY_ID }]);
    expect(mutation).not.toHaveBeenCalled();

    actAs(true);
    expect((await call()).ok).toBe(true);
    expect(mutation).toHaveBeenCalledOnce();
  });
});

describe("POST /api/internal/segments", () => {
  test("creates the segment, audits it and captures it in PostHog", async () => {
    const response = await create(createBody({ surveyId: SURVEY_ID }));

    expect(response.status).toBe(201);
    // The connected surveys' names never reach the browser.
    expect((await response.json()).data).toEqual(serialized());
    expect(mocks.createSegment).toHaveBeenCalledWith({ ...createBody(), surveyId: SURVEY_ID });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "segment",
        targetId: SEGMENT_ID,
        organizationId: ORG_ID,
        status: "success",
        newObject: storedSegment(),
      })
    );
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "segment_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, is_private: false },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("makes a segment private unless told otherwise, and with no survey connects none", async () => {
    const { isPrivate: _isPrivate, ...body } = createBody();
    await create(body);
    expect(mocks.createSegment).toHaveBeenCalledWith({ ...body, isPrivate: true, surveyId: "" });
  });

  test("refuses a survey from another workspace with 422, before anything else is asked", async () => {
    mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(OTHER_WORKSPACE_ID);

    const response = await create(createBody({ surveyId: SURVEY_ID }));

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Survey and segment are not in the same workspace");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.createSegment).not.toHaveBeenCalled();
  });

  test("checks interaction filters against the caller's visibility, and the surveys nested segments read", async () => {
    await create(createBody());

    expect(mocks.assertSurveyInteractionSurveyIds).toHaveBeenCalledWith(FILTERS, WORKSPACE_ID, visibleWhere);
    expect(mocks.resolveSurveyActorContext).toHaveBeenCalledWith({ type: "user", id: USER_ID }, ORG_ID);
    expect(mocks.assertSegmentSurveyFiltersVisible).toHaveBeenCalledWith(FILTERS, WORKSPACE_ID, memberActor);
  });

  // ENG-6870: a caller may only save filters they could evaluate themselves.
  test("answers 422 with the reason for filters that read a survey hidden from the caller", async () => {
    mocks.assertSegmentSurveyFiltersVisible.mockRejectedValue(new InvalidInputError(HIDDEN_FILTERS_MESSAGE));

    const response = await create(createBody());

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(HIDDEN_FILTERS_MESSAGE);
    expect(mocks.createSegment).not.toHaveBeenCalled();
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test.each([
    ["no filters", createBody({ filters: [] })],
    ["filters that aren't a filter tree", createBody({ filters: [{ id: "x" }] })],
    ["a title past the cap", createBody({ title: "a".repeat(SEGMENT_TITLE_MAX_LENGTH + 1) })],
    [
      "a description past the cap",
      createBody({ description: "a".repeat(SEGMENT_DESCRIPTION_MAX_LENGTH + 1) }),
    ],
    ["a workspace that isn't an id", createBody({ workspaceId: "workspace-1" })],
    ["an empty survey id", createBody({ surveyId: "" })],
    ["an unknown key", { ...createBody(), id: SEGMENT_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createSegment).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/internal/segments/{segmentId}", () => {
  test("saves the change and audits it from the segment as it was to the segment as saved", async () => {
    const response = await update({ title: "Renamed", description: null, isPrivate: false });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(serialized({ title: "Renamed" }));
    expect(mocks.updateSegment).toHaveBeenCalledWith(SEGMENT_ID, {
      title: "Renamed",
      description: null,
      isPrivate: false,
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "segment",
        targetId: SEGMENT_ID,
        organizationId: ORG_ID,
        status: "success",
        oldObject: storedSegment(),
        newObject: storedSegment({ title: "Renamed" }),
      })
    );
  });

  test("saves a segment sent without isPrivate as private, as the shared schema has it", async () => {
    await update({ filters: FILTERS });
    expect(mocks.updateSegment).toHaveBeenCalledWith(SEGMENT_ID, { filters: FILTERS, isPrivate: true });
  });

  // ENG-1920: surveys are connected by id alone.
  test.each([
    ["a survey from another workspace", new Map([[SURVEY_2_ID, OTHER_WORKSPACE_ID]])],
    ["a survey id that doesn't resolve (no oracle)", new Map()],
  ])("refuses %s with 422", async (_label, workspaceIdBySurveyId) => {
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(workspaceIdBySurveyId);

    const response = await update({ surveys: [SURVEY_2_ID] });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Survey and segment are not in the same workspace");
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  test("checks every connected survey in one batched, visibility-scoped lookup", async () => {
    mocks.assertSurveysInWorkspace.mockRejectedValueOnce(
      new InvalidInputError(`Survey not found in workspace: ${SURVEY_2_ID}`)
    );

    expect((await update({ surveys: [SURVEY_ID, SURVEY_2_ID] })).status).toBe(422);
    expect(mocks.getSurveyWorkspaceIdMap).toHaveBeenCalledWith([SURVEY_ID, SURVEY_2_ID]);
    expect(mocks.assertSurveysInWorkspace).toHaveBeenCalledOnce();
    expect(mocks.assertSurveysInWorkspace).toHaveBeenCalledWith(
      [SURVEY_ID, SURVEY_2_ID],
      WORKSPACE_ID,
      visibleWhere
    );
    expect(mocks.updateSegment).not.toHaveBeenCalled();

    expect((await update({ surveys: [SURVEY_ID, SURVEY_2_ID] })).status).toBe(200);
    expect(mocks.updateSegment).toHaveBeenCalledOnce();
  });

  test("skips the visibility lookup where the caller sees every survey", async () => {
    mocks.getUserVisibleSurveyWhere.mockResolvedValue({});

    await update({ surveys: [SURVEY_ID], filters: FILTERS });

    expect(mocks.assertSurveysInWorkspace).not.toHaveBeenCalled();
    expect(mocks.restoreHiddenSegmentSurveyIds).not.toHaveBeenCalled();
  });

  test("checks the ids the caller sent and keeps the stored ones they can't see", async () => {
    const stored = [{ id: "clfilter0000000000000009", connector: null, resource: FILTERS }];
    mocks.getSegment.mockResolvedValue(storedSegment({ filters: stored }));
    mocks.restoreHiddenSegmentSurveyIds.mockResolvedValue(stored);

    await update({ filters: FILTERS });

    expect(mocks.assertSurveyInteractionSurveyIds).toHaveBeenCalledWith(FILTERS, WORKSPACE_ID, visibleWhere);
    expect(mocks.restoreHiddenSegmentSurveyIds).toHaveBeenCalledWith(
      FILTERS,
      stored,
      WORKSPACE_ID,
      visibleWhere
    );
    expect(mocks.checkForRecursiveSegmentFilter).toHaveBeenCalledWith(stored, SEGMENT_ID);
    expect(mocks.updateSegment).toHaveBeenCalledWith(SEGMENT_ID, { filters: stored, isPrivate: true });
  });

  test("holds the merged tree to the bounds, so restored ids can't push a filter past them", async () => {
    const surveyIds = Array.from({ length: 101 }, (_, index) => `clsv${String(index).padStart(20, "0")}`);
    mocks.restoreHiddenSegmentSurveyIds.mockResolvedValue([
      {
        id: "clfilter0000000000000001",
        connector: null,
        resource: {
          id: "clresource00000000000001",
          root: { type: "surveyInteraction" },
          qualifier: { operator: "haveCompleted" },
          value: { surveyScope: "specific", surveyIds, within: { amount: 30, unit: "days" } },
        },
      },
    ]);

    const response = await update({ filters: FILTERS });

    expect(response.status).toBe(422);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  test("answers 422 with the reason for a filter that refers to the segment itself", async () => {
    mocks.checkForRecursiveSegmentFilter.mockRejectedValue(
      new InvalidInputError("Recursive segment filter is not allowed")
    );

    const response = await update({ filters: FILTERS });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Recursive segment filter is not allowed");
  });

  // ENG-6870: an edit only answers for the surveys it adds.
  test("checks only what an edit adds, nested segments included", async () => {
    mocks.assertAddedSegmentSurveyFiltersVisible.mockRejectedValue(
      new InvalidInputError(HIDDEN_FILTERS_MESSAGE)
    );

    const response = await update({ filters: FILTERS });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(HIDDEN_FILTERS_MESSAGE);
    expect(mocks.assertAddedSegmentSurveyFiltersVisible).toHaveBeenCalledWith(
      FILTERS,
      FILTERS,
      WORKSPACE_ID,
      memberActor,
      SEGMENT_ID
    );
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  // ENG-6870: connecting a survey to an existing segment targets it with the stored tree.
  test("checks the whole stored tree when it connects a new survey, and not for one already connected", async () => {
    mocks.assertSegmentSurveyFiltersVisible.mockRejectedValueOnce(
      new InvalidInputError(HIDDEN_FILTERS_MESSAGE)
    );

    expect((await update({ surveys: [SURVEY_ID, SURVEY_2_ID] })).status).toBe(422);
    expect(mocks.assertSegmentSurveyFiltersVisible).toHaveBeenCalledWith(
      FILTERS,
      WORKSPACE_ID,
      memberActor,
      SEGMENT_ID
    );
    expect(mocks.updateSegment).not.toHaveBeenCalled();

    mocks.assertSegmentSurveyFiltersVisible.mockClear();
    expect((await update({ surveys: [SURVEY_ID] })).status).toBe(200);
    expect(mocks.assertSegmentSurveyFiltersVisible).not.toHaveBeenCalled();
  });

  test.each([
    ["no filters", { filters: [] }],
    ["more surveys than a segment may have", { surveys: Array(MAX_SEGMENT_SURVEYS + 1).fill(SURVEY_ID) }],
    ["a survey that isn't an id", { surveys: ["survey-1"] }],
    ["a title past the cap", { title: "a".repeat(SEGMENT_TITLE_MAX_LENGTH + 1) }],
    ["an unknown key", { title: "Renamed", workspaceId: WORKSPACE_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await update(body)).status).toBe(400);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/segments/{segmentId}", () => {
  test("deletes the segment and audits it with the segment as it was", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.deleteSegment).toHaveBeenCalledWith(SEGMENT_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "segment",
        targetId: SEGMENT_ID,
        organizationId: ORG_ID,
        status: "success",
        oldObject: storedSegment(),
      })
    );
  });

  test("answers 409 with the reason for a segment a survey still uses", async () => {
    mocks.deleteSegment.mockRejectedValue(
      new OperationNotAllowedError("Cannot delete a segment that is associated with a survey")
    );

    const response = await remove();

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("Cannot delete a segment that is associated with a survey");
  });
});

describe("POST /api/internal/segments/{segmentId}/copies", () => {
  test("copies the segment onto the survey, audited on the segment copied with the copy", async () => {
    const response = await copy();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual(
      serialized({ id: COPY_ID, title: "Copy of Power users (1)" })
    );
    expect(mocks.cloneSegment).toHaveBeenCalledWith(SEGMENT_ID, SURVEY_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "segment",
        targetId: SEGMENT_ID,
        organizationId: ORG_ID,
        status: "success",
        newObject: storedSegment({ id: COPY_ID, title: "Copy of Power users (1)" }),
      })
    );
  });

  test("answers 400 for an unknown key", async () => {
    expect((await copy({ surveyId: SURVEY_ID, title: "x" })).status).toBe(400);
  });
});

describe("PUT /api/internal/surveys/{surveyId}/segment", () => {
  test("attaches the segment and answers it, audited as an update of the survey", async () => {
    const survey = { id: SURVEY_ID, segment: storedSegment() };
    mocks.loadNewSegmentInSurvey.mockResolvedValue(survey);

    const response = await attach();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ surveyId: SURVEY_ID, segment: serialized() });
    expect(mocks.loadNewSegmentInSurvey).toHaveBeenCalledWith(SURVEY_ID, SEGMENT_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        targetId: SURVEY_ID,
        organizationId: ORG_ID,
        status: "success",
        newObject: survey,
      })
    );
  });

  test("answers the uniform 403 for a segment that is gone", async () => {
    mocks.getWorkspaceIdFromSegmentId.mockRejectedValue(new ResourceNotFoundError("segment", SEGMENT_ID));
    expect((await attach()).status).toBe(403);
    expect(mocks.loadNewSegmentInSurvey).not.toHaveBeenCalled();
  });

  test("answers 400 for a segment that isn't an id", async () => {
    expect((await attach({ segmentId: "segment-1" })).status).toBe(400);
  });
});

describe("attaching or copying a segment onto a survey", () => {
  test.each([
    ["PUT /surveys/{id}/segment", () => attach()],
    ["POST /segments/{id}/copies", () => copy()],
  ])("%s refuses a segment from another workspace with 422", async (_label, call) => {
    mocks.getWorkspaceIdFromSegmentId.mockResolvedValue(OTHER_WORKSPACE_ID);

    const response = await call();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Segment and survey are not in the same workspace");
    expect(mocks.can).not.toHaveBeenCalled();
  });

  // ENG-6870: the survey's responses would show who the segment's filters match.
  test.each([
    ["PUT /surveys/{id}/segment", () => attach()],
    ["POST /segments/{id}/copies", () => copy()],
  ])("%s refuses a segment whose filters read a survey hidden from the caller", async (_label, call) => {
    mocks.assertSegmentSurveyFiltersVisible.mockRejectedValue(new InvalidInputError(HIDDEN_FILTERS_MESSAGE));

    const response = await call();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(HIDDEN_FILTERS_MESSAGE);
    expect(mocks.assertSegmentSurveyFiltersVisible).toHaveBeenCalledWith(
      FILTERS,
      WORKSPACE_ID,
      memberActor,
      SEGMENT_ID
    );
    expect(mocks.loadNewSegmentInSurvey).not.toHaveBeenCalled();
    expect(mocks.cloneSegment).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/surveys/{surveyId}/segment/resets", () => {
  test("resets the survey to its private segment, audited as an update of that segment", async () => {
    const response = await reset();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      surveyId: SURVEY_ID,
      segment: serialized({ title: SURVEY_ID, isPrivate: true, filters: [] }),
    });
    expect(mocks.resetSegmentInSurvey).toHaveBeenCalledWith(SURVEY_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "segment",
        targetId: SEGMENT_ID,
        organizationId: ORG_ID,
        status: "success",
      })
    );
  });
});

describe("the segment editor's reads", () => {
  test("GET attribute values asks read access to the key's workspace and the licence, without a write budget", async () => {
    const response = await attributeValues();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(["free", "pro"]);
    expect(checkedActions()).toEqual([["workspace.read", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([]);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getDistinctAttributeValues).toHaveBeenCalledWith(KEY_ID);
  });

  test("GET segment-filter-surveys lists the surveys the caller can see", async () => {
    const response = await filterSurveys();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { id: SURVEY_ID, name: "Onboarding", status: "inProgress" },
    ]);
    expect(checkedActions()).toEqual([["workspace.read", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(mocks.getSurveyRefsForWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, visibleWhere);
  });

  test.each([
    ["attribute values", attributeValues, mocks.getDistinctAttributeValues],
    ["segment-filter-surveys", filterSurveys, mocks.getSurveyRefsForWorkspace],
  ])(
    "GET %s answers the uniform 403 to a caller who can't read the workspace",
    async (_label, call, read) => {
      mocks.can.mockResolvedValue(false);

      expect((await call()).status).toBe(403);
      expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    }
  );

  test("GET attribute values refuses without advanced targeting", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await attributeValues();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Advanced targeting is not allowed for this organization");
  });

  test("GET attribute values answers the uniform 403 for a key that doesn't exist", async () => {
    mocks.getWorkspaceIdFromContactAttributeKeyId.mockRejectedValue(
      new ResourceNotFoundError("ContactAttributeKey", KEY_ID)
    );
    expect((await attributeValues()).status).toBe(403);
  });
});
