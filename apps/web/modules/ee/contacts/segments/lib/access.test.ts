import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { assertCanTargetWithSegment } from "./access";

const mockSurveyFindFirst = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { survey: { findFirst: (...args: unknown[]) => mockSurveyFindFirst(...args) } },
}));

vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));

const mockResolveSurveyActorContext = vi.fn<() => Promise<TSurveyActorContext>>();
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  resolveSurveyActorContext: () => mockResolveSurveyActorContext(),
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegment: vi.fn(),
  getSegmentsByIds: vi.fn(),
}));

const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");

const workspaceId = "clworkspace00000000000001";
const segmentId = "clsegment000000000000000001";
const restrictedSurveyId = "clrestricted00000000000001";

const member: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "u1",
};
const admin: TSurveyActorContext = { enforced: true, isOrganizationAdmin: true, kind: "user", userId: "u0" };

const segment = (overrides: Partial<TSegmentWithSurveyRefs>): TSegmentWithSurveyRefs => ({
  id: segmentId,
  title: restrictedSurveyId,
  description: null,
  isPrivate: true,
  workspaceId,
  filters: [],
  surveys: [restrictedSurveyId],
  activeSurveys: [],
  inactiveSurveys: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("assertCanTargetWithSegment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSurveyFindFirst.mockResolvedValue(null);
    mockResolveSurveyActorContext.mockResolvedValue(member);
  });

  // ENG-7556: copying or attaching a private segment hands its filters (the survey's targeting) to the
  // caller, so it is refused, as not found, when the survey it belongs to is hidden from them.
  test("refuses a private segment whose survey is hidden from the caller", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment({}));
    mockSurveyFindFirst.mockResolvedValue({ id: restrictedSurveyId });

    await expect(assertCanTargetWithSegment("u1", "org1", segmentId)).rejects.toThrow(ResourceNotFoundError);
    expect(mockSurveyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [restrictedSurveyId] }, workspaceId }),
      })
    );
  });

  test("allows a private segment whose survey the caller sees", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment({}));

    await expect(assertCanTargetWithSegment("u1", "org1", segmentId)).resolves.toBeUndefined();
  });

  test("allows a shared segment without looking up its surveys", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment({ isPrivate: false }));

    await expect(assertCanTargetWithSegment("u1", "org1", segmentId)).resolves.toBeUndefined();
    expect(mockSurveyFindFirst).not.toHaveBeenCalled();
  });

  test("an organization owner or manager sees every survey: nothing to look up", async () => {
    mockResolveSurveyActorContext.mockResolvedValue(admin);
    vi.mocked(getSegment).mockResolvedValue(segment({}));

    await expect(assertCanTargetWithSegment("u0", "org1", segmentId)).resolves.toBeUndefined();
    expect(mockSurveyFindFirst).not.toHaveBeenCalled();
  });
});
