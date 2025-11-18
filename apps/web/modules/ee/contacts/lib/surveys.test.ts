import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getPublishedLinkSurveys } from "./surveys";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
  },
}));

const environmentId = "cm123456789012345678901237";

describe("getPublishedLinkSurveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns published link surveys", async () => {
    const mockSurveys = [
      { id: "survey1", name: "Customer Feedback Survey" },
      { id: "survey2", name: "Product Survey" },
      { id: "survey3", name: "NPS Survey" },
    ];

    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockSurveys);

    const result = await getPublishedLinkSurveys(environmentId);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: "survey1", name: "Customer Feedback Survey" });
    expect(result[1]).toEqual({ id: "survey2", name: "Product Survey" });
    expect(result[2]).toEqual({ id: "survey3", name: "NPS Survey" });

    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId, status: "inProgress", type: "link" },
      select: {
        id: true,
        name: true,
      },
    });
  });

  test("returns empty array if no published link surveys", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    const result = await getPublishedLinkSurveys(environmentId);

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });

    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);

    await expect(getPublishedLinkSurveys(environmentId)).rejects.toThrow(DatabaseError);
    await expect(getPublishedLinkSurveys(environmentId)).rejects.toThrow("DB error");
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");

    vi.mocked(prisma.survey.findMany).mockRejectedValue(genericError);

    await expect(getPublishedLinkSurveys(environmentId)).rejects.toThrow(genericError);
    await expect(getPublishedLinkSurveys(environmentId)).rejects.toThrow("Unknown error");
  });

  test("filters surveys by status inProgress", async () => {
    const mockSurveys = [{ id: "survey1", name: "Active Survey" }];

    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockSurveys);

    await getPublishedLinkSurveys(environmentId);

    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "inProgress",
        }),
      })
    );
  });

  test("filters surveys by type link", async () => {
    const mockSurveys = [{ id: "survey1", name: "Link Survey" }];

    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockSurveys);

    await getPublishedLinkSurveys(environmentId);

    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "link",
        }),
      })
    );
  });

  test("only selects id and name fields", async () => {
    const mockSurveys = [{ id: "survey1", name: "Test Survey" }];

    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockSurveys);

    const result = await getPublishedLinkSurveys(environmentId);

    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          name: true,
        },
      })
    );

    // Verify the result only contains id and name
    expect(Object.keys(result[0])).toEqual(["id", "name"]);
  });
});
