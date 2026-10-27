import { beforeEach, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TAuthzedRelationship } from "@/lib/authzed/client";
import { getAuthzedOutboxStatus } from "@/lib/authzed/outbox-repository";
import { readAllRelationships } from "@/lib/authzed/relationship-reads";
import { reconcileSurveyRelationships } from "@/lib/authzed/survey";
import { type TSurveyProjectionRow, expectedSurveyRelationships } from "@/lib/authzed/survey-relationships";
import { backfillOnlineSurveys, verifyOnlineProjection } from "./projection";

vi.mock("@formbricks/database", () => ({
  prisma: {
    onlineUpgradeState: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    survey: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: () => ({}) }));
vi.mock("@/lib/authzed/relationship-reads", () => ({ readAllRelationships: vi.fn() }));
// The comparison and the expected edges stay real: a mocked comparison is how ENG-3950 went unnoticed.
vi.mock("@/lib/authzed/survey", () => ({ reconcileSurveyRelationships: vi.fn() }));
vi.mock("@/lib/authzed/outbox-processor", () => ({ processAuthzedOutboxBatch: vi.fn() }));
vi.mock("@/lib/authzed/outbox-repository", () => ({ getAuthzedOutboxStatus: vi.fn() }));
const row: TSurveyProjectionRow = {
  id: "a",
  workspaceId: "w",
  ownerId: "u",
  visibility: "workspace",
  visibilityVersion: 1,
};
const observeGraph = (relationships: TAuthzedRelationship[]) =>
  vi.mocked(readAllRelationships).mockResolvedValue({ relationships } as never);
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
  observeGraph([]);
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

test("a survey whose graph holds exactly its expected edges passes without a repair", async () => {
  vi.mocked(prisma.onlineUpgradeState.findUniqueOrThrow).mockResolvedValue({
    baselineCompletedAt: new Date(),
  } as never);
  vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([row] as never);
  // Unchanged when re-read, so any difference would count as drift.
  vi.mocked(prisma.survey.findUnique).mockResolvedValue(row as never);
  observeGraph(expectedSurveyRelationships(row).reverse());
  await expect(verifyOnlineProjection(lock)).resolves.toBeUndefined();
  expect(reconcileSurveyRelationships).not.toHaveBeenCalled();
});

test.each([
  ["a missing edge", (edges: TAuthzedRelationship[]) => edges.slice(1)],
  [
    "an unexpected edge",
    (edges: TAuthzedRelationship[]) => [
      ...edges,
      { ...edges[0], subject: { objectId: "other-workspace", objectType: "workspace" } },
    ],
  ],
])("unexplained drift (%s) is repaired but cannot activate in that pass", async (_drift, graph) => {
  vi.mocked(prisma.onlineUpgradeState.findUniqueOrThrow).mockResolvedValue({
    baselineCompletedAt: new Date(),
  } as never);
  vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([row] as never);
  vi.mocked(prisma.survey.findUnique).mockResolvedValue(row as never);
  observeGraph(graph(expectedSurveyRelationships(row)));
  await expect(verifyOnlineProjection(lock)).rejects.toThrow("stable_projection_drift");
  expect(reconcileSurveyRelationships).toHaveBeenCalledWith(["a"]);
});
