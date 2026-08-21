import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type TSurveyRow,
  getResponseCountsBySurveyIds,
  mapSurveyRowToSurvey,
  mapSurveyRowsToSurveys,
} from "./survey-record";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      groupBy: vi.fn(),
    },
  },
}));

const makeSurveyRow = (overrides: Partial<TSurveyRow> = {}): TSurveyRow =>
  ({
    id: "survey_1",
    name: "Survey 1",
    workspaceId: "ws_1",
    type: "link",
    status: "inProgress",
    publishOn: null,
    archivedAt: null,
    createdAt: new Date("2026-04-15T10:00:00.000Z"),
    updatedAt: new Date("2026-04-16T10:00:00.000Z"),
    creator: { name: "Alice" },
    singleUse: null,
    ...overrides,
  }) as TSurveyRow;

describe("getResponseCountsBySurveyIds", () => {
  beforeEach(() => {
    vi.mocked(prisma.response.groupBy).mockReset();
  });

  test("returns an empty map without querying when there are no survey ids", async () => {
    const counts = await getResponseCountsBySurveyIds([]);

    expect(counts.size).toBe(0);
    expect(prisma.response.groupBy).not.toHaveBeenCalled();
  });

  test("groups by surveyId and finished so partial responses are excluded from the completed count", async () => {
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "survey_1", finished: true, _count: { _all: 4 } },
      { surveyId: "survey_1", finished: false, _count: { _all: 6 } },
      { surveyId: "survey_2", finished: false, _count: { _all: 3 } },
    ] as never);

    const counts = await getResponseCountsBySurveyIds(["survey_1", "survey_2"]);

    expect(prisma.response.groupBy).toHaveBeenCalledWith({
      by: ["surveyId", "finished"],
      where: { surveyId: { in: ["survey_1", "survey_2"] } },
      _count: { _all: true },
    });
    expect(counts.get("survey_1")).toEqual({ total: 10, completed: 4 });
    expect(counts.get("survey_2")).toEqual({ total: 3, completed: 0 });
  });

  test("omits surveys without any response", async () => {
    vi.mocked(prisma.response.groupBy).mockResolvedValue([] as never);

    const counts = await getResponseCountsBySurveyIds(["survey_1"]);

    expect(counts.get("survey_1")).toBeUndefined();
  });
});

describe("mapSurveyRowToSurvey", () => {
  test("maps both counts onto the row", () => {
    const survey = mapSurveyRowToSurvey(makeSurveyRow(), { total: 9, completed: 5 });

    expect(survey.responseCount).toBe(9);
    expect(survey.completedResponseCount).toBe(5);
  });

  test("defaults both counts to zero", () => {
    const survey = mapSurveyRowToSurvey(makeSurveyRow());

    expect(survey.responseCount).toBe(0);
    expect(survey.completedResponseCount).toBe(0);
  });
});

describe("mapSurveyRowsToSurveys", () => {
  test("matches each row with its own counts and falls back to zero", () => {
    const rows = [makeSurveyRow({ id: "survey_1" }), makeSurveyRow({ id: "survey_2" })];
    const countsBySurveyId = new Map([["survey_1", { total: 8, completed: 3 }]]);

    const surveys = mapSurveyRowsToSurveys(rows, countsBySurveyId);

    expect(surveys[0]).toMatchObject({ id: "survey_1", responseCount: 8, completedResponseCount: 3 });
    expect(surveys[1]).toMatchObject({ id: "survey_2", responseCount: 0, completedResponseCount: 0 });
  });

  test("defaults to zero counts when no map is given", () => {
    const surveys = mapSurveyRowsToSurveys([makeSurveyRow()]);

    expect(surveys[0].responseCount).toBe(0);
    expect(surveys[0].completedResponseCount).toBe(0);
  });
});
