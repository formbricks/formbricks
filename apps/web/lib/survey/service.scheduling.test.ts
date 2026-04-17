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

  test("manual pause clears pauseOn", async () => {
    const scheduledPauseSelection = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
    prisma.survey.findUnique.mockResolvedValueOnce({
      ...mockSurveyOutput,
      pauseOn: scheduledPauseSelection,
      status: "inProgress",
    } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      pauseOn: null,
      status: "paused",
    } as never);

    await updateSurveyInternal(
      {
        ...updateSurveyInput,
        pauseOn: scheduledPauseSelection,
        status: "paused",
      },
      true
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pauseOn: null,
          status: "paused",
        }),
      })
    );
  });

  test("saving a due publish schedule catches up immediately", async () => {
    const dueSelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDuePublishOn = new Date("2026-04-16T23:00:00.000Z");

    prisma.survey.findUnique
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        publishOn: null,
        status: "draft",
      } as never)
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        publishOn: null,
        status: "inProgress",
      } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: normalizedDuePublishOn,
      status: "draft",
    } as never);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        {
          environment: {
            workspace: {
              organizationId: "org123",
            },
          },
          environmentId: updateSurveyInput.environmentId,
          id: updateSurveyInput.id,
          pauseOn: null,
          publishOn: normalizedDuePublishOn,
          status: "draft",
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
    prisma.survey.updateMany.mockResolvedValueOnce({ count: 1 } as never);

    const updatedSurvey = await updateSurveyInternal(
      {
        ...updateSurveyInput,
        publishOn: dueSelection,
        status: "draft",
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

  test("creating a survey with a due publish schedule catches up immediately", async () => {
    const dueSelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDuePublishOn = new Date("2026-04-16T23:00:00.000Z");

    prisma.survey.create.mockResolvedValueOnce({
      ...mockSurveyOutput,
      publishOn: normalizedDuePublishOn,
      status: "draft",
      type: "link",
    } as never);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        {
          environment: {
            workspace: {
              organizationId: "org123",
            },
          },
          environmentId: updateSurveyInput.environmentId,
          id: updateSurveyInput.id,
          pauseOn: null,
          publishOn: normalizedDuePublishOn,
          status: "draft",
        },
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
      status: "draft",
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

  test("same-day publish and pause resolves to paused", async () => {
    const sameDaySelection = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const normalizedDueDate = new Date("2026-04-16T23:00:00.000Z");

    prisma.survey.findUnique
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        pauseOn: null,
        publishOn: null,
        status: "draft",
      } as never)
      .mockResolvedValueOnce({
        ...mockSurveyOutput,
        pauseOn: null,
        publishOn: null,
        status: "paused",
      } as never);
    prisma.survey.update.mockResolvedValueOnce({
      ...mockSurveyOutput,
      pauseOn: normalizedDueDate,
      publishOn: normalizedDueDate,
      status: "draft",
    } as never);
    prisma.survey.findMany
      .mockResolvedValueOnce([
        {
          environment: {
            workspace: {
              organizationId: "org123",
            },
          },
          environmentId: updateSurveyInput.environmentId,
          id: updateSurveyInput.id,
          pauseOn: normalizedDueDate,
          publishOn: normalizedDueDate,
          status: "draft",
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          environment: {
            workspace: {
              organizationId: "org123",
            },
          },
          environmentId: updateSurveyInput.environmentId,
          id: updateSurveyInput.id,
          pauseOn: normalizedDueDate,
          publishOn: null,
          status: "inProgress",
        },
      ] as never);
    prisma.survey.updateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 1 } as never);

    const updatedSurvey = await updateSurveyInternal(
      {
        ...updateSurveyInput,
        pauseOn: sameDaySelection,
        publishOn: sameDaySelection,
        status: "draft",
      },
      true
    );

    expect(updatedSurvey.status).toBe("paused");
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledTimes(2);
  });
});
