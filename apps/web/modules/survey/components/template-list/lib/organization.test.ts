import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { subscribeOrganizationMembersToSurveyResponses } from "./organization";
import { updateUser } from "./user";

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./user", () => ({
  updateUser: vi.fn(),
}));

describe("subscribeOrganizationMembersToSurveyResponses", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("subscribes user to survey responses successfully", async () => {
    const mockUser = {
      id: "user-123",
      notificationSettings: {
        alert: { "existing-survey-id": true },
        weeklySummary: {},
      },
    };

    const surveyId = "survey-123";
    const userId = "user-123";

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(updateUser).mockResolvedValueOnce({} as any);

    await subscribeOrganizationMembersToSurveyResponses(surveyId, userId);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
    });

    expect(updateUser).toHaveBeenCalledWith(userId, {
      notificationSettings: {
        alert: {
          "existing-survey-id": true,
          "survey-123": true,
        },
        weeklySummary: {},
      },
    });
  });

  test("creates notification settings if user doesn't have any", async () => {
    const mockUser = {
      id: "user-123",
      notificationSettings: null,
    };

    const surveyId = "survey-123";
    const userId = "user-123";

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(updateUser).mockResolvedValueOnce({} as any);

    await subscribeOrganizationMembersToSurveyResponses(surveyId, userId);

    expect(updateUser).toHaveBeenCalledWith(userId, {
      notificationSettings: {
        alert: {
          "survey-123": true,
        },
        weeklySummary: {},
      },
    });
  });

  test("throws ResourceNotFoundError if user is not found", async () => {
    const surveyId = "survey-123";
    const userId = "nonexistent-user";

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await expect(subscribeOrganizationMembersToSurveyResponses(surveyId, userId)).rejects.toThrow(
      new ResourceNotFoundError("User", userId)
    );

    expect(updateUser).not.toHaveBeenCalled();
  });

  test("propagates errors from database operations", async () => {
    const surveyId = "survey-123";
    const userId = "user-123";
    const dbError = new Error("Database error");

    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(dbError);

    await expect(subscribeOrganizationMembersToSurveyResponses(surveyId, userId)).rejects.toThrow(dbError);

    expect(updateUser).not.toHaveBeenCalled();
  });
});
