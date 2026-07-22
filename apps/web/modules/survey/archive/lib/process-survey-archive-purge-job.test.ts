import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { SURVEY_ARCHIVE_PURGE_BATCH_SIZE } from "@/modules/survey/archive/lib/constants";
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
  logger: { info: vi.fn(), error: vi.fn() },
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
  });

  test("queries surveys archived before the cutoff and deletes each one", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([makeSurvey("s1"), makeSurvey("s2")] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(deleteSurvey).mockResolvedValue({} as never);

    const now = new Date("2026-07-31T00:00:00.000Z");
    const purged = await purgeExpiredArchivedSurveys(now);

    expect(purged).toBe(2);
    expect(deleteSurvey).toHaveBeenCalledWith("s1");
    expect(deleteSurvey).toHaveBeenCalledWith("s2");
    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]).toMatchObject({
      where: { archivedAt: { lt: getSurveyArchivePurgeCutoff(now) } },
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

  test("aborts a full batch that makes no progress to avoid an infinite loop", async () => {
    const fullBatch = Array.from({ length: SURVEY_ARCHIVE_PURGE_BATCH_SIZE }, (_, i) => makeSurvey(`s${i}`));
    vi.mocked(prisma.survey.findMany).mockResolvedValue(fullBatch as never);
    vi.mocked(deleteSurvey).mockRejectedValue(new Error("boom"));

    const purged = await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    expect(purged).toBe(0);
    // Only the first batch is attempted; the loop bails instead of re-querying forever.
    expect(vi.mocked(prisma.survey.findMany)).toHaveBeenCalledTimes(1);
  });
});
