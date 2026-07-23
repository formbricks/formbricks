import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { SURVEY_ARCHIVE_PURGE_BATCH_SIZE } from "@/modules/survey/archive/lib/constants";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyArchivePurgeCutoff, purgeExpiredArchivedSurveys } from "./process-survey-archive-purge-job";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: vi.fn().mockResolvedValue(undefined),
}));

const makeSurvey = (id: string) => ({
  id,
  workspaceId: "ws_1",
  workspace: { organizationId: "org_1" },
});

describe("getSurveyArchivePurgeCutoff", () => {
  test("returns a cutoff 30 days before now", () => {
    const now = new Date("2026-07-31T00:00:00.000Z");
    expect(getSurveyArchivePurgeCutoff(now).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("purgeExpiredArchivedSurveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queueAuditEventWithoutRequest).mockResolvedValue(undefined as never);
  });

  test("queries surveys archived before the cutoff and deletes each one with the eligibility guard", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([makeSurvey("s1"), makeSurvey("s2")] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(deleteSurvey).mockResolvedValue({} as never);

    const now = new Date("2026-07-31T00:00:00.000Z");
    const cutoff = getSurveyArchivePurgeCutoff(now);
    const purged = await purgeExpiredArchivedSurveys(now);

    expect(purged).toBe(2);
    // The delete is guarded so a survey restored mid-batch is skipped rather than hard-deleted.
    expect(deleteSurvey).toHaveBeenCalledWith("s1", { requireArchivedBefore: cutoff });
    expect(deleteSurvey).toHaveBeenCalledWith("s2", { requireArchivedBefore: cutoff });
    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]).toMatchObject({
      where: { archivedAt: { lt: cutoff } },
      orderBy: { archivedAt: "asc" },
      take: SURVEY_ARCHIVE_PURGE_BATCH_SIZE,
    });
  });

  test("does not stop the batch when a single deletion fails", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([makeSurvey("s1"), makeSurvey("s2")] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(deleteSurvey)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({} as never);

    const purged = await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    expect(purged).toBe(1);
    expect(deleteSurvey).toHaveBeenCalledTimes(2);
  });

  test("treats a restored/already-gone survey (ResourceNotFoundError) as skipped, not failed", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([makeSurvey("s1"), makeSurvey("s2")] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(deleteSurvey)
      .mockRejectedValueOnce(new ResourceNotFoundError("Survey", "s1"))
      .mockResolvedValueOnce({} as never);

    const purged = await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    // s1 was restored between selection and delete, so it is skipped (not counted); s2 is purged.
    expect(purged).toBe(1);
    expect(deleteSurvey).toHaveBeenCalledTimes(2);
    // The short batch ends the run in one query, and the skipped survey is never added to the
    // failed-exclusion set (a restored survey already drops out of the archivedAt<cutoff filter).
    expect(vi.mocked(prisma.survey.findMany)).toHaveBeenCalledTimes(1);
  });

  test("excludes a persistently failing survey from later batches so the loop terminates", async () => {
    // First batch is full and the head survey always fails; a real DB would then exclude it via
    // id:notIn and return the remainder. Assert the second query carries the exclusion and the run ends.
    const fullBatch = Array.from({ length: SURVEY_ARCHIVE_PURGE_BATCH_SIZE }, (_, i) => makeSurvey(`s${i}`));
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce(fullBatch as never)
      .mockResolvedValueOnce([] as never);
    // Only the first survey (s0) fails; the rest succeed.
    vi.mocked(deleteSurvey).mockImplementation((id: string) =>
      id === "s0" ? Promise.reject(new Error("boom")) : (Promise.resolve({}) as never)
    );

    const purged = await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    expect(purged).toBe(SURVEY_ARCHIVE_PURGE_BATCH_SIZE - 1);
    expect(vi.mocked(prisma.survey.findMany)).toHaveBeenCalledTimes(2);
    const secondCallWhere = vi.mocked(prisma.survey.findMany).mock.calls[1][0] as {
      where: { id?: { notIn: string[] } };
    };
    expect(secondCallWhere.where.id).toEqual({ notIn: ["s0"] });
  });

  test("counts the delete as purged even when the audit enqueue fails", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([makeSurvey("s1")] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(deleteSurvey).mockResolvedValue({} as never);
    vi.mocked(queueAuditEventWithoutRequest).mockRejectedValueOnce(new Error("audit down") as never);

    const purged = await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    expect(purged).toBe(1);
    expect(queueAuditEventWithoutRequest).toHaveBeenCalledTimes(1);
  });
});
