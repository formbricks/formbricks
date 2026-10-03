import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { buildWhereClause } from "@/modules/survey/lib/utils";
import { decodeSurveyListPageCursor, encodeSurveyListPageCursor, getSurveyListPage } from "./survey-page";

// The readiness marker is off unless a test says otherwise: the predicate restricts nothing.
const UNENFORCED_CONTEXT = {
  enforced: false,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "user_1",
} as const;

vi.mock("server-only", () => ({}));

vi.mock("@/modules/survey/lib/utils", () => ({
  buildWhereClause: vi.fn(() => ({ AND: [] })),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
    response: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const workspaceId = "ws_123";

function makeSurveyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "survey1",
    name: "Survey 1",
    workspaceId,
    type: "link",
    status: "draft",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    creator: { name: "Alice" },
    singleUse: null,
    ...overrides,
  };
}

describe("survey-page cursor helpers", () => {
  test("encodes and decodes an updatedAt cursor", () => {
    const encoded = encodeSurveyListPageCursor({
      version: 1,
      sortBy: "updatedAt",
      value: "2025-01-02T00:00:00.000Z",
      id: "survey1",
    });

    expect(decodeSurveyListPageCursor(encoded, "updatedAt")).toEqual({
      version: 1,
      sortBy: "updatedAt",
      value: "2025-01-02T00:00:00.000Z",
      id: "survey1",
    });
  });

  test("rejects a cursor that does not match the requested sort order", () => {
    const encoded = encodeSurveyListPageCursor({
      version: 1,
      sortBy: "name",
      value: "Survey 1",
      id: "survey1",
    });

    expect(() => decodeSurveyListPageCursor(encoded, "updatedAt")).toThrow(InvalidInputError);
  });

  /** The decoded strings are bound into the page query, where a NUL byte fails it with a 500 (ENG-3550). */
  test.each([
    { version: 1, sortBy: "updatedAt", value: "2025-01-02T00:00:00.000Z", id: "survey\u0000" },
    { version: 1, sortBy: "name", value: "Survey\u0000", id: "survey1" },
    {
      version: 1,
      sortBy: "relevance",
      bucket: "other",
      updatedAt: "2025-01-02T00:00:00.000Z",
      id: "s\u0000",
    },
  ] as const)("rejects a NULL byte in a $sortBy cursor", (cursor) => {
    const encoded = encodeSurveyListPageCursor(cursor);

    expect(() => decodeSurveyListPageCursor(encoded, cursor.sortBy)).toThrow(InvalidInputError);
  });
});

describe("getSurveyListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.survey.findMany).mockReset();
    vi.mocked(prisma.response.groupBy).mockReset();
  });

  test("adds the visibility predicate to the filter clauses instead of replacing them (ENG-3282)", async () => {
    vi.mocked(buildWhereClause).mockReturnValueOnce({ AND: [{ name: { contains: "nps" } }] } as never);
    vi.mocked(prisma.survey.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([] as never);

    await getSurveyListPage(workspaceId, {
      actorContext: { enforced: true, isOrganizationAdmin: false, kind: "user", userId: "user_1" },
      visibilityFilter: { visibility: ["restricted"] },
      limit: 5,
      cursor: null,
      sortBy: "updatedAt",
      filterCriteria: { name: "nps" },
    });

    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId,
          AND: [
            { name: { contains: "nps" } },
            {
              OR: [
                {
                  visibility: "workspace",
                  OR: [
                    { visibilityPending: false },
                    { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } },
                  ],
                },
                { ownerId: "user_1" },
              ],
            },
            {
              OR: [
                { visibility: "restricted" },
                {
                  visibilityPending: true,
                  NOT: { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } },
                },
              ],
            },
          ],
        },
      })
    );
  });

  test("uses a stable updatedAt order with a next cursor", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      makeSurveyRow({ id: "survey2", updatedAt: new Date("2025-01-03T00:00:00.000Z") }),
      makeSurveyRow({ id: "survey1", updatedAt: new Date("2025-01-02T00:00:00.000Z") }),
    ] as never);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "survey2", finished: true, _count: { _all: 2 } },
      { surveyId: "survey2", finished: false, _count: { _all: 1 } },
    ] as never);

    const page = await getSurveyListPage(workspaceId, {
      actorContext: UNENFORCED_CONTEXT,
      limit: 1,
      cursor: null,
      sortBy: "updatedAt",
    });

    expect(buildWhereClause).toHaveBeenCalledWith(undefined);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { workspaceId: workspaceId, AND: [] },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(page.surveys).toHaveLength(1);
    expect(page.surveys[0].responseCount).toBe(3);
    expect(page.surveys[0].completedResponseCount).toBe(2);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeSurveyListPageCursor(page.nextCursor as string, "updatedAt")).toEqual({
      version: 1,
      sortBy: "updatedAt",
      value: "2025-01-03T00:00:00.000Z",
      id: "survey2",
    });
  });

  test("applies a name cursor for forward pagination", async () => {
    const cursor = decodeSurveyListPageCursor(
      encodeSurveyListPageCursor({
        version: 1,
        sortBy: "name",
        value: "Bravo",
        id: "surveyb",
      }),
      "name"
    );

    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      makeSurveyRow({ id: "surveyc", name: "Charlie" }),
    ] as never);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "surveyc", finished: true, _count: { _all: 3 } },
    ] as never);

    await getSurveyListPage(workspaceId, {
      actorContext: UNENFORCED_CONTEXT,
      limit: 2,
      cursor,
      sortBy: "name",
    });

    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: workspaceId,
        AND: [],
        OR: [{ name: { gt: "Bravo" } }, { name: "Bravo", id: { gt: "surveyb" } }],
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
          id: "surveyinprogress",
          status: "inProgress",
          updatedAt: new Date("2025-01-03T00:00:00.000Z"),
        }),
      ] as never)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "surveyother1",
          status: "completed",
          updatedAt: new Date("2025-01-02T00:00:00.000Z"),
        }),
        makeSurveyRow({
          id: "surveyother2",
          status: "paused",
          updatedAt: new Date("2025-01-01T00:00:00.000Z"),
        }),
      ] as never);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "surveyinprogress", finished: true, _count: { _all: 3 } },
      { surveyId: "surveyother1", finished: true, _count: { _all: 2 } },
    ] as never);

    const page = await getSurveyListPage(workspaceId, {
      actorContext: UNENFORCED_CONTEXT,
      limit: 2,
      cursor: null,
      sortBy: "relevance",
    });

    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        workspaceId: workspaceId,
        AND: [],
        status: "inProgress",
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 3,
    });
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        workspaceId: workspaceId,
        AND: [],
        status: { not: "inProgress" },
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(page.surveys.map((survey) => survey.id)).toEqual(["surveyinprogress", "surveyother1"]);
    expect(decodeSurveyListPageCursor(page.nextCursor as string, "relevance")).toEqual({
      version: 1,
      sortBy: "relevance",
      bucket: "other",
      updatedAt: "2025-01-02T00:00:00.000Z",
      id: "surveyother1",
    });
  });

  test("returns an in-progress next cursor when the page fills before switching to other surveys", async () => {
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "surveyinprogress",
          status: "inProgress",
          updatedAt: new Date("2025-01-03T00:00:00.000Z"),
        }),
      ] as never)
      .mockResolvedValueOnce([
        makeSurveyRow({
          id: "surveyother1",
          status: "completed",
          updatedAt: new Date("2025-01-02T00:00:00.000Z"),
        }),
      ] as never);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "surveyinprogress", finished: true, _count: { _all: 3 } },
    ] as never);

    const page = await getSurveyListPage(workspaceId, {
      actorContext: UNENFORCED_CONTEXT,
      limit: 1,
      cursor: null,
      sortBy: "relevance",
    });

    expect(page.surveys.map((survey) => survey.id)).toEqual(["surveyinprogress"]);
    expect(decodeSurveyListPageCursor(page.nextCursor as string, "relevance")).toEqual({
      version: 1,
      sortBy: "relevance",
      bucket: "inProgress",
      updatedAt: "2025-01-03T00:00:00.000Z",
      id: "surveyinprogress",
    });
  });

  test("continues relevance pagination from the other bucket cursor", async () => {
    const cursor = decodeSurveyListPageCursor(
      encodeSurveyListPageCursor({
        version: 1,
        sortBy: "relevance",
        bucket: "other",
        updatedAt: "2025-01-02T00:00:00.000Z",
        id: "surveyother1",
      }),
      "relevance"
    );

    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      makeSurveyRow({
        id: "surveyother2",
        status: "completed",
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    ] as never);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "surveyother2", finished: true, _count: { _all: 3 } },
    ] as never);

    const page = await getSurveyListPage(workspaceId, {
      actorContext: UNENFORCED_CONTEXT,
      limit: 2,
      cursor,
      sortBy: "relevance",
    });

    expect(prisma.survey.findMany).toHaveBeenCalledOnce();
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: workspaceId,
        AND: [],
        status: { not: "inProgress" },
        OR: [
          { updatedAt: { lt: new Date("2025-01-02T00:00:00.000Z") } },
          {
            updatedAt: new Date("2025-01-02T00:00:00.000Z"),
            id: { lt: "surveyother1" },
          },
        ],
      },
      select: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 3,
    });
    expect(page.surveys.map((survey) => survey.id)).toEqual(["surveyother2"]);
    expect(page.nextCursor).toBeNull();
  });

  test("wraps Prisma errors as DatabaseError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db failed", {
      code: "P2025",
      clientVersion: "test",
    });
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);

    await expect(
      getSurveyListPage(workspaceId, {
        actorContext: UNENFORCED_CONTEXT,
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
      getSurveyListPage(workspaceId, {
        actorContext: UNENFORCED_CONTEXT,
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
      getSurveyListPage(workspaceId, {
        actorContext: UNENFORCED_CONTEXT,
        limit: 1,
        cursor: null,
        sortBy: "updatedAt",
      })
    ).rejects.toThrow(unexpectedError);
  });
});
