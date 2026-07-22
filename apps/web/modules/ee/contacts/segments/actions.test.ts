import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  getOrganizationIdFromSegmentId: vi.fn(),
  getWorkspaceIdFromSegmentId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getSurveyWorkspaceIdMap: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganization: vi.fn(),
  updateSegment: vi.fn(),
  getSegment: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromContactAttributeKeyId: vi.fn(),
  getOrganizationIdFromSegmentId: mocks.getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromContactAttributeKeyId: vi.fn(),
  getWorkspaceIdFromSegmentId: mocks.getWorkspaceIdFromSegmentId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  cloneSegment: vi.fn(),
  createSegment: vi.fn(),
  deleteSegment: vi.fn(),
  getSegment: mocks.getSegment,
  getSurveyWorkspaceIdMap: mocks.getSurveyWorkspaceIdMap,
  resetSegmentInSurvey: vi.fn(),
  updateSegment: mocks.updateSegment,
}));

vi.mock("@/lib/survey/service", () => ({ loadNewSegmentInSurvey: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({ getDistinctAttributeValues: vi.fn() }));
vi.mock("@/modules/ee/contacts/segments/lib/helper", () => ({ checkForRecursiveSegmentFilter: vi.fn() }));

// Import after mocks so the action client / audit wrappers are the passthrough versions.
const { updateSegmentAction } = await import("./actions");

const callUpdate = (data: Record<string, unknown>) =>
  (updateSegmentAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user1" }, auditLoggingCtx: {} },
    parsedInput: { segmentId: "seg1", data },
  });

describe("updateSegmentAction — ENG-1920 cross-workspace survey re-point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromSegmentId.mockResolvedValue("org1");
    mocks.getWorkspaceIdFromSegmentId.mockResolvedValue("ws-segment");
    mocks.getIsContactsEnabled.mockResolvedValue(true);
    mocks.getOrganization.mockResolvedValue({ id: "org1" });
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
