import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getSurveyWorkspaceIdMap: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganization: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
  getSegmentInWorkspace: vi.fn(),
  getOtherWorkspaceSurveyIds: vi.fn(),
  getSurveyRefsForWorkspace: vi.fn(),
  getDistinctAttributeValues: vi.fn(),
  requireWorkspaceContactDirectory: vi.fn(),
  restoreHiddenSegmentSurveyIds: vi.fn(),
  getUserVisibleSurveyWhere: vi.fn(),
  assertSurveysInWorkspace: vi.fn(),
  assertSurveyInteractionSurveyIds: vi.fn(),
  assertAddedSurveyInteractionSurveyIds: vi.fn(),
  assertSegmentSurveyFiltersVisible: vi.fn(),
  assertAddedSegmentSurveyFiltersVisible: vi.fn(),
  resolveSurveyActorContext: vi.fn(),
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
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  cloneSegment: mocks.cloneSegment,
  createSegment: mocks.createSegment,
  deleteSegment: mocks.deleteSegment,
  getOtherWorkspaceSurveyIds: mocks.getOtherWorkspaceSurveyIds,
  getSegmentInWorkspace: mocks.getSegmentInWorkspace,
  getSurveyRefsForWorkspace: mocks.getSurveyRefsForWorkspace,
  getSurveyWorkspaceIdMap: mocks.getSurveyWorkspaceIdMap,
  resetSegmentInSurvey: mocks.resetSegmentInSurvey,
  updateSegment: mocks.updateSegment,
}));

vi.mock("@/lib/survey/service", () => ({ loadNewSegmentInSurvey: mocks.loadNewSegmentInSurvey }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  getUserVisibleSurveyWhere: mocks.getUserVisibleSurveyWhere,
  resolveSurveyActorContext: mocks.resolveSurveyActorContext,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({
  getDistinctAttributeValues: mocks.getDistinctAttributeValues,
}));
vi.mock("@/modules/ee/contacts/lib/contact-directory", () => ({
  requireWorkspaceContactDirectory: mocks.requireWorkspaceContactDirectory,
}));
vi.mock("@/modules/ee/contacts/segments/lib/helper", () => ({
  assertAddedSegmentSurveyFiltersVisible: mocks.assertAddedSegmentSurveyFiltersVisible,
  assertSegmentSurveyFiltersVisible: mocks.assertSegmentSurveyFiltersVisible,
  assertSurveyInteractionSurveyIds: mocks.assertSurveyInteractionSurveyIds,
  assertAddedSurveyInteractionSurveyIds: mocks.assertAddedSurveyInteractionSurveyIds,
  assertSurveysInWorkspace: mocks.assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter: vi.fn(),
  restoreHiddenSegmentSurveyIds: mocks.restoreHiddenSegmentSurveyIds,
}));

// Import after mocks so the action client / audit wrappers are the passthrough versions.
const {
  cloneSegmentAction,
  createSegmentAction,
  deleteSegmentAction,
  getDistinctAttributeValuesAction,
  getSurveysForSegmentFilterAction,
  loadNewSegmentAction,
  resetSegmentFiltersAction,
  updateSegmentAction,
} = await import("./actions");

const callUpdate = (data: Record<string, unknown>) =>
  (updateSegmentAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user1" }, auditLoggingCtx: {} },
    parsedInput: { segmentId: "seg1", workspaceId: "ws-caller", data },
  });

describe("updateSegmentAction — ENG-1920 cross-workspace survey re-point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", filters: [], surveys: [] });
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

  test("allows surveys in the caller's workspace", async () => {
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(new Map([["own-survey", "ws-caller"]]));
    mocks.updateSegment.mockResolvedValue({ id: "seg1", surveys: [] });

    await callUpdate({ surveys: ["own-survey"] });

    expect(mocks.updateSegment).toHaveBeenCalledWith("seg1", { surveys: ["own-survey"] });
    expect(mocks.getSurveyWorkspaceIdMap).toHaveBeenCalledWith(["own-survey"]);
  });

  // Decision 24: a shared segment is used by surveys of several workspaces of its directory. Re-sending
  // the ones it is already on connects nothing, so only the caller's new ones are checked.
  test("does not re-check surveys of another workspace the segment is already on", async () => {
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", filters: [], surveys: ["their-survey"] });
    mocks.getSurveyWorkspaceIdMap.mockResolvedValue(new Map([["own-survey", "ws-caller"]]));
    mocks.updateSegment.mockResolvedValue({ id: "seg1", surveys: [] });

    await callUpdate({ surveys: ["their-survey", "own-survey"] });

    expect(mocks.getSurveyWorkspaceIdMap).toHaveBeenCalledWith(["own-survey"]);
    expect(mocks.updateSegment).toHaveBeenCalledOnce();
  });
});

// Decision 24: a segment belongs to its directory; the caller acts from the workspace they name, and its
// own `workspaceId` (the workspace it was made in, or none) grants nothing.
describe("segment actions authorize on the caller's workspace and its directory", () => {
  const run = (action: unknown, parsedInput: Record<string, unknown>) =>
    (action as (args: unknown) => Promise<unknown>)({
      ctx: { user: { id: "user1" }, auditLoggingCtx: {} },
      parsedInput,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: "org1" });
    mocks.getUserVisibleSurveyWhere.mockResolvedValue({});
    mocks.getSegmentInWorkspace.mockResolvedValue({
      id: "seg1",
      workspaceId: null,
      filters: [],
      surveys: [],
    });
    mocks.updateSegment.mockResolvedValue({ id: "seg1" });
    mocks.deleteSegment.mockResolvedValue({ id: "seg1" });
  });

  test.each([
    [
      "updateSegmentAction",
      () => run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws-b", data: {} }),
    ],
    ["deleteSegmentAction", () => run(deleteSegmentAction, { segmentId: "seg1", workspaceId: "ws-b" })],
  ] as const)("%s needs workspace.write on the caller's workspace", async (_name, call) => {
    await call();

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user1" }, "workspace.write", {
      type: "workspace",
      id: "ws-b",
    });
    expect(mocks.getSegmentInWorkspace).toHaveBeenCalledWith("seg1", "ws-b");
  });

  test.each([
    [
      "updateSegmentAction",
      () => run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws-b", data: {} }),
    ],
    ["deleteSegmentAction", () => run(deleteSegmentAction, { segmentId: "seg1", workspaceId: "ws-b" })],
  ] as const)("%s refuses a segment of another directory", async (_name, call) => {
    mocks.getSegmentInWorkspace.mockRejectedValue(new ResourceNotFoundError("segment", "seg1"));

    await expect(call()).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
    expect(mocks.deleteSegment).not.toHaveBeenCalled();
  });

  test("a writer refused on their workspace never reaches the segment", async () => {
    mocks.assertCan.mockRejectedValue(new Error("Not authorized"));

    await expect(
      run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws-b", data: {} })
    ).rejects.toThrow("Not authorized");
    expect(mocks.getSegmentInWorkspace).not.toHaveBeenCalled();
  });

  test("an edit checks only the survey ids it adds, against the caller's workspace", async () => {
    const stored = [{ id: "f0", connector: null, resource: [] }];
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", filters: stored, surveys: [] });

    await run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws-b", data: { filters: [] } });

    expect(mocks.assertAddedSurveyInteractionSurveyIds).toHaveBeenCalledWith([], stored, "ws-b", {});
    expect(mocks.assertSurveyInteractionSurveyIds).not.toHaveBeenCalled();
  });

  test("getDistinctAttributeValuesAction reads the key's values in the caller's directory", async () => {
    mocks.requireWorkspaceContactDirectory.mockResolvedValue({ id: "dir-1", matchingKey: "email" });
    mocks.getDistinctAttributeValues.mockResolvedValue(["a"]);

    await expect(
      run(getDistinctAttributeValuesAction, { attributeKeyId: "key-1", workspaceId: "ws-b" })
    ).resolves.toEqual(["a"]);
    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user1" }, "workspace.read", {
      type: "workspace",
      id: "ws-b",
    });
    expect(mocks.getDistinctAttributeValues).toHaveBeenCalledWith("key-1", "dir-1");
  });

  test("getSurveysForSegmentFilterAction names the ids of other workspaces' surveys, never their names", async () => {
    mocks.getSurveyRefsForWorkspace.mockResolvedValue([{ id: "s-own", name: "Own", status: "draft" }]);
    mocks.getOtherWorkspaceSurveyIds.mockResolvedValue(["s-other"]);

    await expect(
      run(getSurveysForSegmentFilterAction, { workspaceId: "ws-b", surveyIds: ["s-other", "s-gone"] })
    ).resolves.toEqual({
      surveys: [{ id: "s-own", name: "Own", status: "draft" }],
      otherWorkspaceSurveyIds: ["s-other"],
    });
    expect(mocks.getOtherWorkspaceSurveyIds).toHaveBeenCalledWith("ws-b", ["s-other", "s-gone"]);
  });
});

describe("segment mutations authorize every referenced survey (ENG-3282)", () => {
  const ctx = () => ({ user: { id: "user1" }, auditLoggingCtx: {} });
  const run = (action: unknown, parsedInput: Record<string, unknown>) =>
    (action as (args: unknown) => Promise<unknown>)({ ctx: ctx(), parsedInput });
  const visibleWhere = { OR: [{ visibility: "workspace" }, { ownerId: "user1" }] };
  const memberActor = { enforced: true, isOrganizationAdmin: false, kind: "user", userId: "user1" };
  /** Workspace checks pass; the survey-level one answers `surveyAllowed`. */
  const actAs = (surveyAllowed: boolean) =>
    mocks.assertCan.mockImplementation(async (_actor, _action, resource: { type: string }) => {
      if (resource.type === "survey" && !surveyAllowed) throw new Error("Not authorized");
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromSurveyId.mockResolvedValue("org1");
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getWorkspaceIdFromSurveyId.mockResolvedValue("ws1");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: "org1" });
    mocks.getUserVisibleSurveyWhere.mockResolvedValue(visibleWhere);
    mocks.resolveSurveyActorContext.mockResolvedValue(memberActor);
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", workspaceId: "ws1", filters: [] });
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
      run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { surveys: ["s1", "s2"] } })
    ).rejects.toThrow(InvalidInputError);
    expect(mocks.assertSurveysInWorkspace).toHaveBeenCalledOnce();
    expect(mocks.assertSurveysInWorkspace).toHaveBeenCalledWith(["s1", "s2"], "ws1", visibleWhere);
    expect(mocks.updateSegment).not.toHaveBeenCalled();

    await run(updateSegmentAction, {
      segmentId: "seg1",
      workspaceId: "ws1",
      data: { surveys: ["s1", "s2"] },
    });
    expect(mocks.updateSegment).toHaveBeenCalledOnce();
  });

  test("interaction filters are checked against the caller's visibility on create and update", async () => {
    actAs(true);
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", filters: [] });
    mocks.restoreHiddenSegmentSurveyIds.mockImplementation(async (filters: unknown) => filters);

    await run(createSegmentAction, { workspaceId: "ws1", title: "Seg", filters: [], isPrivate: true });
    await run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { filters: [] } });

    expect(mocks.assertSurveyInteractionSurveyIds).toHaveBeenCalledWith([], "ws1", visibleWhere);
    expect(mocks.assertAddedSurveyInteractionSurveyIds).toHaveBeenCalledWith([], [], "ws1", visibleWhere);
  });

  test("an update keeps the stored survey ids the caller cannot see", async () => {
    actAs(true);
    const stored = [{ id: "f1", connector: null, resource: [] }];
    const restored = [{ id: "f1", connector: null, resource: [] }];
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", filters: stored });
    mocks.restoreHiddenSegmentSurveyIds.mockResolvedValue(restored);

    await run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { filters: [] } });

    expect(mocks.restoreHiddenSegmentSurveyIds).toHaveBeenCalledWith([], stored, "ws1", visibleWhere);
    expect(mocks.updateSegment).toHaveBeenCalledWith("seg1", { filters: restored });
  });

  test("the merged tree is held to the bounds, so restored ids cannot push a filter past them", async () => {
    actAs(true);
    const surveyIds = Array.from({ length: 101 }, (_, index) => `clsv${String(index).padStart(20, "0")}`);
    const overLimit = [
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
    ];
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", filters: [] });
    mocks.restoreHiddenSegmentSurveyIds.mockResolvedValue(overLimit);

    await expect(
      run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { filters: [] } })
    ).rejects.toThrow(InvalidInputError);
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  // ENG-6870: nested segment filters read surveys too, so a caller may only save filters they could
  // evaluate themselves; an edit only answers for the surveys it adds.
  test("create checks the whole tree and update only what it adds, nested segments included", async () => {
    actAs(true);
    const nested = [
      {
        id: "clfilter0000000000000001",
        connector: null,
        resource: {
          id: "clresource00000000000001",
          root: { type: "segment", segmentId: "clsegment0000000000000001" },
          qualifier: { operator: "userIsIn" },
          value: "clsegment0000000000000001",
        },
      },
    ];
    const stored = [{ id: "f0", connector: null, resource: [] }];
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", workspaceId: "ws1", filters: stored });
    mocks.restoreHiddenSegmentSurveyIds.mockImplementation(async (filters: unknown) => filters);
    const refused = new InvalidInputError("Segment filters reference a survey you don't have access to");
    mocks.assertSegmentSurveyFiltersVisible.mockRejectedValue(refused);
    mocks.assertAddedSegmentSurveyFiltersVisible.mockRejectedValue(refused);

    await expect(
      run(createSegmentAction, { workspaceId: "ws1", title: "Seg", filters: nested, isPrivate: false })
    ).rejects.toBe(refused);
    await expect(
      run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { filters: nested } })
    ).rejects.toBe(refused);

    expect(mocks.resolveSurveyActorContext).toHaveBeenCalledWith({ type: "user", id: "user1" }, "org1");
    expect(mocks.assertSegmentSurveyFiltersVisible).toHaveBeenCalledWith(nested, "ws1", memberActor);
    expect(mocks.assertAddedSegmentSurveyFiltersVisible).toHaveBeenCalledWith(
      nested,
      stored,
      "ws1",
      memberActor,
      "seg1"
    );
    expect(mocks.createSegment).not.toHaveBeenCalled();
    expect(mocks.updateSegment).not.toHaveBeenCalled();
  });

  // ENG-6870: attaching or copying a segment targets the caller's survey with its filters.
  test.each([
    ["loadNewSegmentAction", () => run(loadNewSegmentAction, { surveyId: "s1", segmentId: "seg1" })],
    ["cloneSegmentAction", () => run(cloneSegmentAction, { surveyId: "s1", segmentId: "seg1" })],
  ] as const)("%s refuses a segment whose filters read a survey hidden from the caller", async (_n, call) => {
    actAs(true);
    const filters = [{ id: "f1", connector: null, resource: [] }];
    mocks.getSegmentInWorkspace.mockResolvedValue({ id: "seg1", workspaceId: "ws1", filters });
    const refused = new InvalidInputError("Segment filters reference a survey you don't have access to");
    mocks.assertSegmentSurveyFiltersVisible.mockRejectedValue(refused);

    await expect(call()).rejects.toBe(refused);
    expect(mocks.assertSegmentSurveyFiltersVisible).toHaveBeenCalledWith(filters, "ws1", memberActor, "seg1");
    expect(mocks.loadNewSegmentInSurvey).not.toHaveBeenCalled();
    expect(mocks.cloneSegment).not.toHaveBeenCalled();
  });

  // ENG-6870 review: connecting a survey to an existing segment targets it with the stored tree.
  test("updateSegmentAction checks the whole stored tree when it connects a new survey", async () => {
    actAs(true);
    const stored = [{ id: "f1", connector: null, resource: [] }];
    mocks.getSegmentInWorkspace.mockResolvedValue({
      id: "seg1",
      workspaceId: "ws1",
      filters: stored,
      surveys: ["s1"],
    });
    const refused = new InvalidInputError("Segment filters reference a survey you don't have access to");
    mocks.assertSegmentSurveyFiltersVisible.mockRejectedValueOnce(refused);

    await expect(
      run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { surveys: ["s1", "s2"] } })
    ).rejects.toBe(refused);
    expect(mocks.assertSegmentSurveyFiltersVisible).toHaveBeenCalledWith(stored, "ws1", memberActor, "seg1");
    expect(mocks.updateSegment).not.toHaveBeenCalled();

    // Re-sending the surveys already connected adds no target.
    mocks.assertSegmentSurveyFiltersVisible.mockClear();
    await run(updateSegmentAction, { segmentId: "seg1", workspaceId: "ws1", data: { surveys: ["s1"] } });
    expect(mocks.assertSegmentSurveyFiltersVisible).not.toHaveBeenCalled();
    expect(mocks.updateSegment).toHaveBeenCalledOnce();
  });
});
