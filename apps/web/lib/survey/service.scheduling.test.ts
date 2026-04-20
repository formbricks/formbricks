import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getActionClasses } from "@/lib/actionClass/service";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import {
  createSurveyInput,
  mockActionClass,
  mockSurveyOutput,
  updateSurveyInput,
} from "./__mock__/survey.mock";
import { createSurvey, updateSurveyInternal } from "./service";

const { mockQueueAuditEventWithoutRequest } = vi.hoisted(() => ({
  mockQueueAuditEventWithoutRequest: vi.fn(),
}));

vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
  subscribeOrganizationMembersToSurveyResponses: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: mockQueueAuditEventWithoutRequest,
}));

const createSchedulingCandidate = ({
  id = updateSurveyInput.id,
  closeOn,
  publishOn,
  status,
  workspaceId = updateSurveyInput.workspaceId,
}: {
  id?: string;
  closeOn: Date | null;
  publishOn: Date | null;
  status: "draft" | "paused" | "inProgress";
  workspaceId?: string;
}) => ({
  id,
  closeOn,
  publishOn,
  status,
  workspace: {
    organizationId: "org123",
  },
  workspaceId,
});

describe("survey service scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00.000Z"));
    vi.mocked(getActionClasses).mockResolvedValue([mockActionClass] as never);
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({ id: "org123" } as never);
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("manual publish clears publishOn", async () => {
    const scheduledPublishSelection = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: scheduledPublishSelection,
      status: "draft",
    } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: null,
      status: "inProgress",
    } as never);

    await updateSurveyInternal(
      {
        ...updateSurveyInput,
        publishOn: scheduledPublishSelection,
        status: "inProgress",
      },
      true
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishOn: null,
          status: "inProgress",
        }),
      })
    );
  });

  test("manual paused status clears closeOn", async () => {
    const scheduledCloseSelection = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: scheduledCloseSelection,
      status: "inProgress",
    } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: null,
      status: "paused",
    } as never);

    await updateSurveyInternal(
      {
        ...updateSurveyInput,
        closeOn: scheduledCloseSelection,
        status: "paused",
      },
      true
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closeOn: null,
          status: "paused",
        }),
      })
    );
  });

  test("scheduling from draft keeps closeOn when publishOn is set", async () => {
    const scheduledPublishSelection = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
    const scheduledCloseSelection = new Date(Date.UTC(2026, 3, 21, 12, 0, 0));
    const normalizedPublishOn = new Date("2026-04-19T22:00:00.000Z");
    const normalizedCloseOn = new Date("2026-04-20T22:00:00.000Z");

    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: null,
      publishOn: null,
      status: "draft",
    } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: normalizedCloseOn,
      publishOn: normalizedPublishOn,
      status: "paused",
    } as never);
    prisma.survey.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never);

    await updateSurveyInternal(
      {
        ...updateSurveyInput,
        closeOn: scheduledCloseSelection,
        publishOn: scheduledPublishSelection,
        status: "paused",
      },
      true
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closeOn: normalizedCloseOn,
          publishOn: normalizedPublishOn,
          status: "paused",
        }),
      })
    );
  });

  test("manual completion clears both scheduling dates", async () => {
    const scheduledSelection = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: scheduledSelection,
      publishOn: scheduledSelection,
      status: "inProgress",
    } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: null,
      publishOn: null,
      status: "completed",
    } as never);

    await updateSurveyInternal(
      {
        ...updateSurveyInput,
        closeOn: scheduledSelection,
        publishOn: scheduledSelection,
        status: "completed",
      },
      true
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          closeOn: null,
          publishOn: null,
          status: "completed",
        }),
      })
    );
  });

  test("saving a due publish schedule catches up immediately for paused surveys", async () => {
    const dueSelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDuePublishOn = new Date("2026-04-16T22:00:00.000Z");

    prisma.survey.findUnique
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        publishOn: null,
        status: "paused",
      } as never)
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        publishOn: null,
        status: "inProgress",
      } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: normalizedDuePublishOn,
      status: "paused",
    } as never);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createSchedulingCandidate({
          closeOn: null,
          publishOn: normalizedDuePublishOn,
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);

    const updatedSurvey = await updateSurveyInternal(
      {
        ...updateSurveyInput,
        publishOn: dueSelection,
        status: "paused",
      },
      true
    );

    expect(updatedSurvey.status).toBe("inProgress");
    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishOn: normalizedDuePublishOn,
        }),
      })
    );
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(1);
  });

  test("saving a due publish schedule in draft does not auto-publish", async () => {
    const dueSelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDuePublishOn = new Date("2026-04-16T22:00:00.000Z");

    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: null,
      status: "draft",
    } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: normalizedDuePublishOn,
      status: "draft",
    } as never);
    prisma.survey.findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never);

    const updatedSurvey = await updateSurveyInternal(
      {
        ...updateSurveyInput,
        publishOn: dueSelection,
        status: "draft",
      },
      true
    );

    expect(updatedSurvey.status).toBe("draft");
    expect(prisma.survey.updateMany).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(0);
  });

  test("creating a paused survey with a due publish schedule catches up immediately", async () => {
    const dueSelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDuePublishOn = new Date("2026-04-16T22:00:00.000Z");

    prisma.survey.create.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: normalizedDuePublishOn,
      status: "paused",
      type: "link",
    } as never);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createSchedulingCandidate({
          closeOn: null,
          publishOn: normalizedDuePublishOn,
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: null,
      status: "inProgress",
      type: "link",
    } as never);

    const createdSurvey = await createSurvey(updateSurveyInput.workspaceId, {
      ...createSurveyInput,
      name: "Scheduled survey",
      publishOn: dueSelection,
      status: "paused",
      type: "link",
    });

    expect(createdSurvey.status).toBe("inProgress");
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishOn: normalizedDuePublishOn,
        }),
      })
    );
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(1);
  });

  test("same-day publish and close resolves to completed", async () => {
    const sameDaySelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDueDate = new Date("2026-04-16T22:00:00.000Z");

    prisma.survey.findUnique
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        closeOn: null,
        publishOn: null,
        status: "paused",
      } as never)
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        closeOn: null,
        publishOn: null,
        status: "completed",
      } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      closeOn: normalizedDueDate,
      publishOn: normalizedDueDate,
      status: "paused",
    } as never);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        createSchedulingCandidate({
          closeOn: normalizedDueDate,
          publishOn: normalizedDueDate,
          status: "paused",
        }),
      ] as never)
      .mockResolvedValueOnce([
        createSchedulingCandidate({
          closeOn: normalizedDueDate,
          publishOn: null,
          status: "inProgress",
        }),
      ] as never);
    prisma.survey.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never);

    const updatedSurvey = await updateSurveyInternal(
      {
        ...updateSurveyInput,
        closeOn: sameDaySelection,
        publishOn: sameDaySelection,
        status: "paused",
      },
      true
    );

    expect(updatedSurvey.status).toBe("completed");
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(2);
  });
});
