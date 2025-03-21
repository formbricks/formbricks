import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getResponse } from "./response";

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findFirst: vi.fn(),
    },
  },
}));

describe("getResponse", () => {
  const mockContactId = "cm8fj8xt3000108l5art7594h";
  const mockSurveyId = "cm8fj9962000208l56jcu94i5";
  const mockResponse = {
    id: "cm8fj9gqp000308l5ab7y800j",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns response when found", async () => {
    vi.mocked(prisma.response.findFirst).mockResolvedValue(mockResponse);

    const result = await getResponse(mockContactId, mockSurveyId);

    expect(prisma.response.findFirst).toHaveBeenCalledWith({
      where: {
        contactId: mockContactId,
        surveyId: mockSurveyId,
      },
      select: {
        id: true,
      },
    });
    if (result.ok) {
      expect(result.data).toEqual(mockResponse);
    }
  });

  test("returns null when response not found", async () => {
    vi.mocked(prisma.response.findFirst).mockResolvedValue(null);

    const result = await getResponse(mockContactId, mockSurveyId);

    expect(prisma.response.findFirst).toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error).toEqual({
        details: [
          {
            field: "response",
            issue: "not found",
          },
        ],
        type: "not_found",
      });
    }
  });
});
