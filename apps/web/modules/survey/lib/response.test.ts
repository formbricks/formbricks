import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getResponseCountBySurveyId } from "./response";

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock react's cache to just return the function
  };
});

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      count: vi.fn(),
    },
  },
}));

const surveyId = "test-survey-id";

describe("getResponseCountBySurveyId", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return the response count for a survey", async () => {
    const mockCount = 5;
    vi.mocked(prisma.response.count).mockResolvedValue(mockCount);

    const result = await getResponseCountBySurveyId(surveyId);

    expect(result).toBe(mockCount);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: { surveyId },
    });
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.response.count).mockRejectedValue(prismaError);

    await expect(getResponseCountBySurveyId(surveyId)).rejects.toThrow(DatabaseError);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: { surveyId },
    });
  });

  test("should throw generic error if an unknown error occurs", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.response.count).mockRejectedValue(genericError);

    await expect(getResponseCountBySurveyId(surveyId)).rejects.toThrow(genericError);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: { surveyId },
    });
  });
});
