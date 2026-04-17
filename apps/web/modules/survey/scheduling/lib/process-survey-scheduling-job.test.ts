import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  pauseOn,
  publishOn,
  status,
}: {
  pauseOn: Date | null;
  publishOn: Date | null;
  status: "draft" | "inProgress";
}) => ({
  environment: {
    workspace: {
      organizationId: "org123",
    },
  },
  environmentId: "env123",
  id: "survey123",
  pauseOn,
  publishOn,
  status,
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

  test("publishes due draft surveys", async () => {
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createCandidate({
          pauseOn: null,
          publishOn: new Date("2026-04-16T23:00:00.000Z"),
          status: "draft",
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
        status: "draft",
      },
    });
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(1);
  });

  test("pauses due published surveys", async () => {
    prisma.survey.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      createCandidate({
        pauseOn: new Date("2026-04-16T23:00:00.000Z"),
        publishOn: null,
        status: "inProgress",
      }),
    ] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);

    await expect(processSurveySchedulingJob({ scope: "global" }, baseContext)).resolves.toBeUndefined();

    expect(prisma.survey.updateMany).toHaveBeenCalledWith({
      data: {
        pauseOn: null,
        status: "paused",
      },
      where: {
        id: "survey123",
        pauseOn: {
          lte: new Date("2026-04-17T12:30:00.000Z"),
          not: null,
        },
        status: "inProgress",
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

  test("publishes before pausing when both schedules are due on the same day", async () => {
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createCandidate({
          pauseOn: new Date("2026-04-16T23:00:00.000Z"),
          publishOn: new Date("2026-04-16T23:00:00.000Z"),
          status: "draft",
        }),
      ] as never)
      .mockResolvedValueOnce([
        createCandidate({
          pauseOn: new Date("2026-04-16T23:00:00.000Z"),
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
          pauseOn: null,
          publishOn: new Date("2026-04-16T23:00:00.000Z"),
          status: "draft",
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
          pauseOn: null,
          publishOn: new Date("2026-04-16T23:00:00.000Z"),
          status: "draft",
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
