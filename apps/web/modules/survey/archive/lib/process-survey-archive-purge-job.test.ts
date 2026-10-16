import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { SURVEY_ARCHIVE_PURGE_BATCH_SIZE } from "@/modules/survey/archive/lib/constants";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyArchivePurgeCutoff, purgeExpiredArchivedSurveys } from "./process-survey-archive-purge-job";
import { getSurveyPurgeEligibleWhere } from "./purge-eligibility";
import { createRetentionPurgeHistory } from "./retention-purge-history";

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

const history = vi.hoisted(() => ({
  archivedByPolicy: vi.fn(),
  runFor: vi.fn(),
  recordDeletion: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./retention-purge-history", () => ({ createRetentionPurgeHistory: vi.fn(() => history) }));

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
    history.archivedByPolicy.mockResolvedValue(new Set());
    history.runFor.mockResolvedValue("run_1");
    history.close.mockResolvedValue(undefined);
  });

  test("records the deletion of a survey the policy archived in History, in the delete's transaction", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([makeSurvey("s1"), makeSurvey("s2")] as never)
      .mockResolvedValueOnce([] as never);
    history.archivedByPolicy.mockResolvedValue(new Set(["s1"]));
    vi.mocked(deleteSurvey).mockResolvedValue({} as never);

    await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    expect(createRetentionPurgeHistory).toHaveBeenCalledOnce();
    // One check for the whole batch.
    expect(history.archivedByPolicy).toHaveBeenCalledExactlyOnceWith(["s1", "s2"]);
    expect(history.runFor).toHaveBeenCalledExactlyOnceWith("org_1");
    // s1 carries a hook that writes its row inside the delete; s2, archived by hand, none.
    const [[, s1Options], [, s2Options]] = vi.mocked(deleteSurvey).mock.calls;
    expect(s2Options).not.toHaveProperty("inTransaction");
    const tx = {};
    await s1Options?.inTransaction?.(tx as never);
    expect(history.recordDeletion).toHaveBeenCalledWith(tx, "run_1", "s1");
    expect(history.close).toHaveBeenCalledOnce();
  });

  test("closes the History runs it opened even when the purge fails part-way", async () => {
    vi.mocked(prisma.survey.findMany).mockRejectedValueOnce(new Error("db down"));

    await expect(purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"))).rejects.toThrow(
      "db down"
    );
    expect(history.close).toHaveBeenCalledOnce();
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
    // The delete is guarded so a survey restored or held mid-batch is skipped rather than hard-deleted.
    expect(deleteSurvey).toHaveBeenCalledWith("s1", { purgeCutoff: cutoff });
    expect(deleteSurvey).toHaveBeenCalledWith("s2", { purgeCutoff: cutoff });
    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]).toMatchObject({
      where: getSurveyPurgeEligibleWhere(cutoff),
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
    // The short batch ends the run in one query.
    expect(vi.mocked(prisma.survey.findMany)).toHaveBeenCalledTimes(1);
  });

  test("excludes a skipped survey from later batches too", async () => {
    // A survey the locked guard refused (held by an exemption created after the batch was read) would
    // otherwise head every following page.
    const fullBatch = Array.from({ length: SURVEY_ARCHIVE_PURGE_BATCH_SIZE }, (_, i) => makeSurvey(`s${i}`));
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce(fullBatch as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(deleteSurvey).mockImplementation((id: string) =>
      id === "s0" ? Promise.reject(new ResourceNotFoundError("Survey", id)) : (Promise.resolve({}) as never)
    );

    await purgeExpiredArchivedSurveys(new Date("2026-07-31T00:00:00.000Z"));

    const secondCallWhere = vi.mocked(prisma.survey.findMany).mock.calls[1][0] as {
      where: { id?: { notIn: string[] } };
    };
    expect(secondCallWhere.where.id).toEqual({ notIn: ["s0"] });
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
