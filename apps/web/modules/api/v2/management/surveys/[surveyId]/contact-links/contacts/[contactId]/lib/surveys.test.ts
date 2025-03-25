import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getSurvey } from "./surveys";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getSurvey", () => {
  const mockSurveyId = "cm8fj9psb000408l50e1x4c6f";
  const mockSurvey = {
    id: mockSurveyId,
    type: "web",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns survey when found", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);

    const result = await getSurvey(mockSurveyId);

    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockSurveyId,
      },
      select: {
        id: true,
        type: true,
      },
    });
    if (result.ok) {
      expect(result.data).toEqual(mockSurvey);
    }
  });

  test("returns null when survey not found", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

    const result = await getSurvey(mockSurveyId);

    expect(prisma.survey.findUnique).toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error).toEqual({
        details: [
          {
            field: "survey",
            issue: "not found",
          },
        ],
        type: "not_found",
      });
    }
  });
});
