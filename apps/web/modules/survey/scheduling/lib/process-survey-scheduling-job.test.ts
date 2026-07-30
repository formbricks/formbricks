import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE } from "./constants";
import { processSurveySchedulingJob } from "./process-survey-scheduling-job";

const { mockLoggerError, mockLoggerInfo, mockQueueAuditEventWithoutRequest } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockQueueAuditEventWithoutRequest: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: mockQueueAuditEventWithoutRequest,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const baseContext = {
  attempt: 1,
  jobId: "job-123",
  jobName: "survey-scheduling.reconcile",
  maxAttempts: 3,
  queueName: "background-jobs",
};

const createCandidate = ({
  id = "survey123",
  closeOn,
  publishOn,
  status,
}: {
  id?: string;
  closeOn: Date | null;
  publishOn: Date | null;
  status: "draft" | "paused" | "inProgress";
}) => ({
  id,
  closeOn,
  publishOn,
  status,
  workspace: {
    organizationId: "org123",
  },
  workspaceId: "workspace123",
});

describe("processSurveySchedulingJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00.000Z"));
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("publishes due paused surveys", async () => {
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createCandidate({
          closeOn: null,
          publishOn: new Date("2026-04-16T22:00:00.000Z"),
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(prisma.survey.updateMany).toHaveBeenCalledWith({
      data: {
        publishOn: null,
        status: "inProgress",
      },
      where: {
        id: "survey123",
        publishOn: {
          lte: new Date("2026-04-17T12:30:00.000Z"),
          not: null,
        },
        status: "paused",
        archivedAt: null,
      },
    });
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(1);
  });

  test("processes due publish transitions in batches when the backlog is large", async () => {
    const duePublishOn = new Date("2026-04-16T22:00:00.000Z");
    const firstBatch = Array.from({ length: SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE }, (_, index) =>
      createCandidate({
        id: `survey-${index}`,
        closeOn: null,
        publishOn: duePublishOn,
        status: "paused",
      })
    );
    const secondBatch = [
      createCandidate({
        id: `survey-${SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE}`,
        closeOn: null,
        publishOn: duePublishOn,
        status: "paused",
      }),
    ];

    prisma.survey.findMany
      .mockResolvedValueOnce(firstBatch as never)
      .mockResolvedValueOnce(secondBatch as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockResolvedValue({ count: 1 } as never);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE,
      })
    );
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE,
      })
    );
    expect(prisma.survey.updateMany).toHaveBeenCalledTimes(
      SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE + secondBatch.length
    );
  });

  test("closes due published surveys", async () => {
    prisma.survey.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      createCandidate({
        closeOn: new Date("2026-04-16T22:00:00.000Z"),
        publishOn: null,
        status: "inProgress",
      }),
    ] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(prisma.survey.updateMany).toHaveBeenCalledWith({
      data: {
        closeOn: null,
        status: "completed",
      },
      where: {
        id: "survey123",
        closeOn: {
          lte: new Date("2026-04-17T12:30:00.000Z"),
          not: null,
        },
        status: "inProgress",
        archivedAt: null,
      },
    });
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(1);
  });

  test("reruns are idempotent when nothing is due", async () => {
    prisma.survey.findMany.mockResolvedValue([] as never);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(prisma.survey.updateMany).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).not.toHaveBeenCalled();
  });

  test("publishes before closing when both schedules are due on the same day", async () => {
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createCandidate({
          closeOn: new Date("2026-04-16T22:00:00.000Z"),
          publishOn: new Date("2026-04-16T22:00:00.000Z"),
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([
        createCandidate({
          closeOn: new Date("2026-04-16T22:00:00.000Z"),
          publishOn: null,
          status: "inProgress",
        }),
      ] as never);
    prisma.survey.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(prisma.survey.updateMany).toHaveBeenCalledTimes(2);
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(2);
  });

  test("throws when a transition update fails so BullMQ can retry", async () => {
    const updateError = new Error("database offline");
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createCandidate({
          closeOn: null,
          publishOn: new Date("2026-04-16T22:00:00.000Z"),
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockRejectedValueOnce(updateError);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).rejects.toThrow(
      "database offline"
    );
  });

  test("logs audit failures without failing successful transitions", async () => {
    const auditError = new Error("audit offline");
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createCandidate({
          closeOn: null,
          publishOn: new Date("2026-04-16T22:00:00.000Z"),
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockQueueAuditEventWithoutRequest.mockRejectedValueOnce(auditError);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        auditStatus: "success",
        err: auditError,
        surveyId: "survey123",
        transition: "publish",
      }),
      "Survey scheduling audit log failed"
    );
  });
});
