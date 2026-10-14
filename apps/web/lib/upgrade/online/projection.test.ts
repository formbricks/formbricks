import { beforeEach, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getAuthzedOutboxStatus } from "@/lib/authzed/outbox-repository";
import { diffSurveyRelationships, reconcileSurveyRelationships } from "@/lib/authzed/survey";
import { backfillOnlineSurveys, verifyOnlineProjection } from "./projection";

vi.mock("@formbricks/database", () => ({
  prisma: {
    onlineUpgradeState: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    survey: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: () => ({}) }));
vi.mock("@/lib/authzed/relationship-reads", () => ({
  readAllRelationships: async () => ({ relationships: [] }),
}));
vi.mock("@/lib/authzed/survey", () => ({
  reconcileSurveyRelationships: vi.fn(),
  expectedSurveyRelationships: () => [],
  diffSurveyRelationships: vi.fn(),
}));
vi.mock("@/lib/authzed/outbox-processor", () => ({ processAuthzedOutboxBatch: vi.fn() }));
vi.mock("@/lib/authzed/outbox-repository", () => ({ getAuthzedOutboxStatus: vi.fn() }));
const row = { id: "a", workspaceId: "w", ownerId: "u", visibility: "workspace", visibilityVersion: 1 };
const lock = vi.fn(async () => {});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.onlineUpgradeState.findUniqueOrThrow).mockResolvedValue({
    surveyCursor: null,
    baselineCompletedAt: null,
  } as never);
  vi.mocked(prisma.onlineUpgradeState.update).mockResolvedValue({ surveyCursor: "a" } as never);
  vi.mocked(prisma.survey.findMany).mockResolvedValue([]);
  vi.mocked(reconcileSurveyRelationships).mockResolvedValue({ status: "projected", passes: 1 });
  vi.mocked(diffSurveyRelationships).mockReturnValue([]);
  vi.mocked(getAuthzedOutboxStatus).mockResolvedValue({
    pending: 17,
    oldestPendingAgeSeconds: 0,
    deadLettered: 0,
    overdueRevocations: 0,
    revocationsPastCritical: 0,
    revocationsPastWarning: 0,
  });
});

test("a failed survey page does not advance the durable cursor", async () => {
  vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([row] as never);
  vi.mocked(reconcileSurveyRelationships).mockResolvedValue({ status: "failed" } as never);
  await expect(backfillOnlineSurveys(lock)).rejects.toThrow("survey_projection_failed");
  expect(prisma.onlineUpgradeState.update).not.toHaveBeenCalled();
});

test("bounded pages checkpoint only after successful projection, then mark the baseline", async () => {
  vi.mocked(prisma.survey.findMany)
    .mockResolvedValueOnce([row] as never)
    .mockResolvedValueOnce([]);
  await backfillOnlineSurveys(lock);
  expect(prisma.survey.findMany).toHaveBeenLastCalledWith(
    expect.objectContaining({ take: 100, where: { id: { gt: "a" } } })
  );
  expect(prisma.onlineUpgradeState.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { surveyCursor: "a", surveyCount: { increment: 1 } } })
  );
  expect(prisma.onlineUpgradeState.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ data: { baselineCompletedAt: expect.any(Date) } })
  );
});

test("fresh live grants need not drain to zero; dead letters and late revocations still block", async () => {
  vi.mocked(prisma.onlineUpgradeState.findUniqueOrThrow).mockResolvedValue({
    baselineCompletedAt: new Date(),
  } as never);
  await expect(verifyOnlineProjection(lock)).resolves.toBeUndefined();
  vi.mocked(getAuthzedOutboxStatus).mockResolvedValueOnce({ deadLettered: 1 } as never);
  await expect(verifyOnlineProjection(lock)).rejects.toThrow("outbox_dead_letters");
  vi.mocked(getAuthzedOutboxStatus).mockResolvedValueOnce({
    deadLettered: 0,
    revocationsPastWarning: 1,
  } as never);
  await expect(verifyOnlineProjection(lock)).rejects.toThrow("revocation_delivery_unhealthy");
});

test("unexplained stable-version drift is repaired but cannot activate in that pass", async () => {
  vi.mocked(prisma.onlineUpgradeState.findUniqueOrThrow).mockResolvedValue({
    baselineCompletedAt: new Date(),
  } as never);
  vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([row] as never);
  vi.mocked(prisma.survey.findUnique).mockResolvedValue(row as never);
  vi.mocked(diffSurveyRelationships).mockReturnValue([{}] as never);
  await expect(verifyOnlineProjection(lock)).rejects.toThrow("stable_projection_drift");
  expect(reconcileSurveyRelationships).toHaveBeenCalledWith(["a"]);
});
