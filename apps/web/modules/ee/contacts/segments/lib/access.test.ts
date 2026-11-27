import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { assertCanTargetWithSegment } from "./access";

vi.mock("server-only", () => ({}));
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

const workspaceId = "clworkspace00000000000001";
const segmentId = "clsegment000000000000000001";
const restrictedSurveyId = "clrestricted00000000000001";

const member: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "u1",
};

const privateSegment: TSegmentWithSurveyRefs = {
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
};

// The rule itself (shared segments, orphans, administrators) is covered in helper.test.ts; these prove the
// attach and copy gate applies it.
describe("assertCanTargetWithSegment", () => {
  beforeEach(() => {
    mockResolveSurveyActorContext.mockResolvedValue(member);
    vi.mocked(getSegment).mockResolvedValue(privateSegment);
  });

  // ENG-7556: copying or attaching a private segment hands its filters (the survey's targeting) to the
  // caller, so it is refused, as not found, when the survey it belongs to is hidden from them.
  test("refuses a private segment whose survey is hidden from the caller", async () => {
    prisma.survey.findFirst.mockResolvedValue({ id: restrictedSurveyId } as never);

    await expect(assertCanTargetWithSegment("u1", "org1", segmentId)).rejects.toThrow(ResourceNotFoundError);
    expect(prisma.survey.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [restrictedSurveyId] }, workspaceId }),
      })
    );
  });

  test("allows a private segment whose survey the caller sees", async () => {
    prisma.survey.findFirst.mockResolvedValue(null);

    await expect(assertCanTargetWithSegment("u1", "org1", segmentId)).resolves.toBeUndefined();
  });
});
