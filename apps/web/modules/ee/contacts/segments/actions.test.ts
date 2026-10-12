import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getOrganizationIdFromSegmentId: vi.fn(),
  getWorkspaceIdFromSegmentId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getSurveyWorkspaceIdMap: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganization: vi.fn(),
  updateSegment: vi.fn(),
  getSegment: vi.fn(),
  getUserVisibleSurveyWhere: vi.fn(),
  assertSurveysInWorkspace: vi.fn(),
  assertSurveyInteractionSurveyIds: vi.fn(),
  cloneSegment: vi.fn(),
  createSegment: vi.fn(),
  resetSegmentInSurvey: vi.fn(),
  loadNewSegmentInSurvey: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromContactAttributeKeyId: vi.fn(),
  getOrganizationIdFromSegmentId: mocks.getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromContactAttributeKeyId: vi.fn(),
  getWorkspaceIdFromSegmentId: mocks.getWorkspaceIdFromSegmentId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  cloneSegment: mocks.cloneSegment,
  createSegment: mocks.createSegment,
  deleteSegment: vi.fn(),
  getSegment: mocks.getSegment,
  getSurveyWorkspaceIdMap: mocks.getSurveyWorkspaceIdMap,
  resetSegmentInSurvey: mocks.resetSegmentInSurvey,
  updateSegment: mocks.updateSegment,
}));

vi.mock("@/lib/survey/service", () => ({ loadNewSegmentInSurvey: mocks.loadNewSegmentInSurvey }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  getUserVisibleSurveyWhere: mocks.getUserVisibleSurveyWhere,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({ getDistinctAttributeValues: vi.fn() }));
vi.mock("@/modules/ee/contacts/segments/lib/helper", () => ({
  assertSurveyInteractionSurveyIds: mocks.assertSurveyInteractionSurveyIds,
  assertSurveysInWorkspace: mocks.assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter: vi.fn(),
}));

// Import after mocks so the action client / audit wrappers are the passthrough versions.
const {
  cloneSegmentAction,
  createSegmentAction,
  loadNewSegmentAction,
  resetSegmentFiltersAction,
  updateSegmentAction,
} = await import("./actions");

const callUpdate = (data: Record<string, unknown>) =>
  (updateSegmentAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user1" }, auditLoggingCtx: {} },
    parsedInput: { segmentId: "seg1", data },
  });

describe("updateSegmentAction — ENG-1920 cross-workspace survey re-point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromSegmentId.mockResolvedValue("org1");
    mocks.getWorkspaceIdFromSegmentId.mockResolvedValue("ws-segment");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: "org1" });
    // Survey visibility not enforced: no clause, so only the workspace tie is checked.
    mocks.getUserVisibleSurveyWhere.mockResolvedValue({});
  });

  test("rejects a survey that belongs to another workspace", async () => {
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(new Map([["victim-survey", "ws-other"]]));

    await expect(callUpdate({ surveys: ["victim-survey"] })).rejects.toThrow(InvalidInputError);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  test("rejects a survey id that does not resolve to any workspace (uniform rejection, no oracle)", async () => {
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(new Map());

    await expect(callUpdate({ surveys: ["nonexistent-survey"] })).rejects.toThrow(InvalidInputError);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  test("allows surveys in the segment's own workspace", async () => {
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(new Map([["own-survey", "ws-segment"]]));
    mocks.getSegment.mockResolvedValue({ id: "seg1" });
    mocks.updateSegment.mockResolvedValue({ id: "seg1", surveys: [] });

    await callUpdate({ surveys: ["own-survey"] });

    expect(mocks.updateSegment).toHaveBeenCalledWith("seg1", { surveys: ["own-survey"] });
    expect(mocks.getSurveyWorkspaceIdMap).toHaveBeenCalledWith(["own-survey"]);
  });
});

describe("segment mutations authorize every referenced survey (ENG-3282)", () => {
  const ctx = () => ({ user: { id: "user1" }, auditLoggingCtx: {} });
  const run = (action: unknown, parsedInput: Record<string, unknown>) =>
    (action as (args: unknown) => Promise<unknown>)({ ctx: ctx(), parsedInput });
  const visibleWhere = { OR: [{ visibility: "workspace" }, { ownerId: "user1" }] };
  /** Workspace checks pass; the survey-level one answers `surveyAllowed`. */
  const actAs = (surveyAllowed: boolean) =>
    mocks.assertCan.mockImplementation(async (_actor, _action, resource: { type: string }) => {
      if (resource.type === "survey" && !surveyAllowed) throw new Error("Not authorized");
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromSegmentId.mockResolvedValue("org1");
    mocks.getOrganizationIdFromSurveyId.mockResolvedValue("org1");
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getWorkspaceIdFromSegmentId.mockResolvedValue("ws1");
    mocks.getWorkspaceIdFromSurveyId.mockResolvedValue("ws1");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: "org1" });
    mocks.getUserVisibleSurveyWhere.mockResolvedValue(visibleWhere);
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(
      new Map([
        ["s1", "ws1"],
        ["s2", "ws1"],
      ])
    );
    mocks.createSegment.mockResolvedValue({ id: "seg1" });
    mocks.updateSegment.mockResolvedValue({ id: "seg1" });
    mocks.cloneSegment.mockResolvedValue({ id: "seg2" });
    mocks.resetSegmentInSurvey.mockResolvedValue({ id: "seg1" });
    mocks.loadNewSegmentInSurvey.mockResolvedValue({ id: "survey1" });
  });

  test.each([
    [
      "loadNewSegmentAction",
      () => run(loadNewSegmentAction, { surveyId: "s1", segmentId: "seg1" }),
      mocks.loadNewSegmentInSurvey,
    ],
    [
      "cloneSegmentAction",
      () => run(cloneSegmentAction, { surveyId: "s1", segmentId: "seg1" }),
      mocks.cloneSegment,
    ],
    [
      "resetSegmentFiltersAction",
      () => run(resetSegmentFiltersAction, { surveyId: "s1" }),
      mocks.resetSegmentInSurvey,
    ],
    [
      "createSegmentAction",
      () =>
        run(createSegmentAction, {
          workspaceId: "ws1",
          surveyId: "s1",
          title: "Seg",
          filters: [],
          isPrivate: true,
        }),
      mocks.createSegment,
    ],
  ] as const)("%s needs survey.write on the survey it targets", async (_name, call, mutation) => {
    actAs(false);
    await expect(call()).rejects.toThrow("Not authorized");
    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user1" }, "survey.write", {
      type: "survey",
      id: "s1",
    });
    expect(mutation).not.toHaveBeenCalled();

    actAs(true);
    await call();
    expect(mutation).toHaveBeenCalledOnce();
  });

  test("updateSegmentAction checks every re-pointed survey in one batched, visibility-scoped lookup", async () => {
    actAs(true);
    mocks.assertSurveysInWorkspace.mockRejectedValueOnce(
      new InvalidInputError("Survey not found in workspace: s2")
    );

    await expect(
      run(updateSegmentAction, { segmentId: "seg1", data: { surveys: ["s1", "s2"] } })
    ).rejects.toThrow(InvalidInputError);
    expect(mocks.assertSurveysInWorkspace).toHaveBeenCalledOnce();
    expect(mocks.assertSurveysInWorkspace).toHaveBeenCalledWith(["s1", "s2"], "ws1", visibleWhere);
    expect(mocks.updateSegment).not.toHaveBeenCalled();

    await run(updateSegmentAction, { segmentId: "seg1", data: { surveys: ["s1", "s2"] } });
    expect(mocks.updateSegment).toHaveBeenCalledOnce();
  });

  test("interaction filters are checked against the caller's visibility on create and update", async () => {
    actAs(true);

    await run(createSegmentAction, { workspaceId: "ws1", title: "Seg", filters: [], isPrivate: true });
    await run(updateSegmentAction, { segmentId: "seg1", data: { filters: [] } });

    expect(mocks.assertSurveyInteractionSurveyIds).toHaveBeenNthCalledWith(1, [], "ws1", visibleWhere);
    expect(mocks.assertSurveyInteractionSurveyIds).toHaveBeenNthCalledWith(2, [], "ws1", visibleWhere);
  });
});
