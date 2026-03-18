import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { buildWhereClause } from "@/modules/survey/lib/utils";
import { decodeSurveyListPageCursor, encodeSurveyListPageCursor, getSurveyListPage } from "./survey-page";

vi.mock("@/modules/survey/lib/utils", () => ({
  buildWhereClause: vi.fn(() => ({ AND: [] })),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const environmentId = "env_123";

function makeSurveyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "survey_1",
    name: "Survey 1",
    environmentId,
    type: "link",
    status: "draft",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    creator: { name: "Alice" },
    singleUse: null,
    _count: { responses: 3 },
    ...overrides,
  };
}

describe("survey-page cursor helpers", () => {
  test("encodes and decodes an updatedAt cursor", () => {
    const encoded = encodeSurveyListPageCursor({
      version: 1,
      sortBy: "updatedAt",
      value: "2025-01-02T00:00:00.000Z",
      id: "survey_1",
    });

    expect(decodeSurveyListPageCursor(encoded, "updatedAt")).toEqual({
      version: 1,
      sortBy: "updatedAt",
      value: "2025-01-02T00:00:00.000Z",
      id: "survey_1",
    });
  });

  test("rejects a cursor that does not match the requested sort order", () => {
    const encoded = encodeSurveyListPageCursor({
      version: 1,
      sortBy: "name",
      value: "Survey 1",
      id: "survey_1",
    });

    expect(() => decodeSurveyListPageCursor(encoded, "updatedAt")).toThrow(InvalidInputError);
  });
});

describe("getSurveyListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses a stable updatedAt order with a next cursor", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      makeSurveyRow({ id: "survey_2", updatedAt: new Date("2025-01-03T00:00:00.000Z") }),
      makeSurveyRow({ id: "survey_1", updatedAt: new Date("2025-01-02T00:00:00.000Z") }),
    ] as never);

    const page = await getSurveyListPage(environmentId, {
      limit: 1,
      cursor: null,
      sortBy: "updatedAt",
    });

    expect(buildWhereClause).toHaveBeenCalledWith(undefined);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId, AND: [] },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(page.surveys).toHaveLength(1);
    expect(page.surveys[0].responseCount).toBe(3);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeSurveyListPageCursor(page.nextCursor as string, "updatedAt")).toEqual({
      version: 1,
      sortBy: "updatedAt",
      value: "2025-01-03T00:00:00.000Z",
      id: "survey_2",
    });
  });

  test("applies a name cursor for forward pagination", async () => {
    const cursor = decodeSurveyListPageCursor(
      encodeSurveyListPageCursor({
        version: 1,
        sortBy: "name",
        value: "Bravo",
        id: "survey_b",
      }),
      "name"
    );

    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      makeSurveyRow({ id: "survey_c", name: "Charlie" }),
    ] as never);

    await getSurveyListPage(environmentId, {
      limit: 2,
      cursor,
      sortBy: "name",
    });

    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        environmentId,
        AND: [],
        OR: [{ name: { gt: "Bravo" } }, { name: "Bravo", id: { gt: "survey_b" } }],
      },
      select: expect.any(Object),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 3,
    });
  });

  test("paginates relevance by exhausting in-progress surveys before others", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "survey_in_progress",
          status: "inProgress",
          updatedAt: new Date("2025-01-03T00:00:00.000Z"),
        }),
      ] as never)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "survey_other_1",
          status: "completed",
          updatedAt: new Date("2025-01-02T00:00:00.000Z"),
        }),
        makeSurveyRow({
          id: "survey_other_2",
          status: "paused",
          updatedAt: new Date("2025-01-01T00:00:00.000Z"),
        }),
      ] as never);

    const page = await getSurveyListPage(environmentId, {
      limit: 2,
      cursor: null,
      sortBy: "relevance",
    });

    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        environmentId,
        AND: [],
        status: "inProgress",
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 3,
    });
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        environmentId,
        AND: [],
        status: { not: "inProgress" },
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(page.surveys.map((survey) => survey.id)).toEqual(["survey_in_progress", "survey_other_1"]);
    expect(decodeSurveyListPageCursor(page.nextCursor as string, "relevance")).toEqual({
      version: 1,
      sortBy: "relevance",
      bucket: "other",
      updatedAt: "2025-01-02T00:00:00.000Z",
      id: "survey_other_1",
    });
  });

  test("returns an in-progress next cursor when the page fills before switching to other surveys", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "survey_in_progress",
          status: "inProgress",
          updatedAt: new Date("2025-01-03T00:00:00.000Z"),
        }),
      ] as never)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "survey_other_1",
          status: "completed",
          updatedAt: new Date("2025-01-02T00:00:00.000Z"),
        }),
      ] as never);

    const page = await getSurveyListPage(environmentId, {
      limit: 1,
      cursor: null,
      sortBy: "relevance",
    });

    expect(page.surveys.map((survey) => survey.id)).toEqual(["survey_in_progress"]);
    expect(decodeSurveyListPageCursor(page.nextCursor as string, "relevance")).toEqual({
      version: 1,
      sortBy: "relevance",
      bucket: "inProgress",
      updatedAt: "2025-01-03T00:00:00.000Z",
      id: "survey_in_progress",
    });
  });

  test("continues relevance pagination from the other bucket cursor", async () => {
    const cursor = decodeSurveyListPageCursor(
      encodeSurveyListPageCursor({
        version: 1,
        sortBy: "relevance",
        bucket: "other",
        updatedAt: "2025-01-02T00:00:00.000Z",
        id: "survey_other_1",
      }),
      "relevance"
    );

    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      makeSurveyRow({
        id: "survey_other_2",
        status: "completed",
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    ] as never);

    const page = await getSurveyListPage(environmentId, {
      limit: 2,
      cursor,
      sortBy: "relevance",
    });

    expect(prisma.survey.findMany).toHaveBeenCalledOnce();
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        environmentId,
        AND: [],
        status: { not: "inProgress" },
        OR: [
          { updatedAt: { lt: new Date("2025-01-02T00:00:00.000Z") } },
          {
            updatedAt: new Date("2025-01-02T00:00:00.000Z"),
            id: { lt: "survey_other_1" },
          },
        ],
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 3,
    });
    expect(page.surveys.map((survey) => survey.id)).toEqual(["survey_other_2"]);
    expect(page.nextCursor).toBeNull();
  });

  test("wraps Prisma errors as DatabaseError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db failed", {
      code: "P2025",
      clientVersion: "test",
    });
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);

    await expect(
      getSurveyListPage(environmentId, {
        limit: 1,
        cursor: null,
        sortBy: "updatedAt",
      })
    ).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting paginated surveys");
  });

  test("rethrows InvalidInputError unchanged", async () => {
    const invalidInputError = new InvalidInputError("bad cursor");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(invalidInputError);

    await expect(
      getSurveyListPage(environmentId, {
        limit: 1,
        cursor: null,
        sortBy: "updatedAt",
      })
    ).rejects.toThrow(invalidInputError);
  });

  test("rethrows unexpected errors unchanged", async () => {
    const unexpectedError = new Error("boom");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(unexpectedError);

    await expect(
      getSurveyListPage(environmentId, {
        limit: 1,
        cursor: null,
        sortBy: "updatedAt",
      })
    ).rejects.toThrow(unexpectedError);
  });
});
