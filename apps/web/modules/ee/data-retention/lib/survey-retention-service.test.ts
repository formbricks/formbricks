import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { RETENTION_POLICY_DEFAULTS } from "./policy-rules";
import {
  SURVEY_RETENTION_DUE_COUNT_CAP,
  countSurveyResponsesCreatedAtOrBefore,
  countSurveysResponsesCreatedAtOrBefore,
  getSurveyRetentionFacts,
  getSurveyRetentionPolicies,
} from "./survey-retention-service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    response: { aggregate: vi.fn() },
    retentionNotice: { findMany: vi.fn() },
    retentionPolicy: { findMany: vi.fn() },
  },
}));

/**
 * These facts read from a real database (the oldest and newest response, both notices, exemptions
 * revoked or expired) are proven in `survey-retention-service.integration.test.ts`. These pin how the
 * rows are combined into what the survey's retention dates derive from.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const NOW = new Date("2030-01-10T00:00:00.000Z");
const at = (day: number) => new Date(Date.UTC(2029, 11, day));

describe("getSurveyRetentionPolicies", () => {
  test("gives both survey policies their settings and when each took effect, null if never saved", async () => {
    vi.mocked(prisma.retentionPolicy.findMany).mockResolvedValue([
      {
        id: "p1",
        entity: "responses",
        enabled: true,
        enabledAt: at(1),
        warnDays: 30,
        periodDays: 90,
        conditions: [],
      },
      {
        id: "p2",
        entity: "members",
        enabled: true,
        enabledAt: at(2),
        warnDays: 30,
        periodDays: 90,
        conditions: [],
      },
    ] as never);

    await expect(getSurveyRetentionPolicies("clorg")).resolves.toEqual({
      responses: { enabled: true, warnDays: 30, periodDays: 90, conditions: [], enabledAt: at(1) },
      surveys: { ...RETENTION_POLICY_DEFAULTS.surveys, enabledAt: null },
    });
  });
});

describe("getSurveyRetentionFacts", () => {
  const survey = { id: "clsrv", createdAt: at(1), updatedAt: at(2) };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(prisma.response.aggregate).mockResolvedValue({
      _min: { createdAt: at(3) },
      _max: { createdAt: at(9) },
    } as never);
    vi.mocked(prisma.retentionNotice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("reads only exemptions ended by the caller's clock, and each notice with its clock", async () => {
    const dbNow = at(10);
    await getSurveyRetentionFacts(survey, dbNow);

    const { text, values } = statement(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(text).toContain('WHERE "surveyId" = ? AND LEAST("until", "revokedAt") <= ?');
    expect(values).toEqual(["clsrv", dbNow]);
    expect(prisma.retentionNotice.findMany).toHaveBeenCalledWith({
      where: { surveyId: "clsrv", entity: { in: ["surveys", "responses"] } },
      select: { entity: true, sentAt: true, deliveredAt: true, clockAt: true },
    });
  });

  test("combines the survey, its responses, both notices and its ended exemptions", async () => {
    vi.mocked(prisma.retentionNotice.findMany).mockResolvedValue([
      { entity: "surveys", sentAt: at(5), deliveredAt: at(6), clockAt: at(2) },
      { entity: "responses", sentAt: at(7), deliveredAt: null, clockAt: null },
    ] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { entity: "surveys", endedAt: at(4) },
      { entity: "responses", endedAt: at(8) },
    ]);

    await expect(getSurveyRetentionFacts({ ...survey, archivedAt: at(9) }, NOW)).resolves.toEqual({
      createdAt: at(1),
      updatedAt: at(2),
      archivedAt: at(9),
      oldestResponseAt: at(3),
      newestResponseAt: at(9),
      surveysNotice: { claimedAt: at(5), deliveredAt: at(6), clockAt: at(2) },
      responsesNotice: { claimedAt: at(7), deliveredAt: null, clockAt: null },
      // Either kind of exemption holds the survey itself; only a responses one holds its responses.
      surveyHeldUntil: at(8),
      responsesHeldUntil: at(8),
    });
  });

  test("holds the survey until the later of its two exemptions, whichever kind ended last", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { entity: "surveys", endedAt: at(8) },
      { entity: "responses", endedAt: at(4) },
    ]);

    await expect(getSurveyRetentionFacts(survey, NOW)).resolves.toMatchObject({
      surveyHeldUntil: at(8),
      responsesHeldUntil: at(4),
    });

    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ entity: "surveys", endedAt: at(8) }]);
    await expect(getSurveyRetentionFacts(survey, NOW)).resolves.toMatchObject({
      surveyHeldUntil: at(8),
      responsesHeldUntil: null,
    });
  });

  test("reads a survey with no responses, notices or exemptions as never touched", async () => {
    vi.mocked(prisma.response.aggregate).mockResolvedValue({
      _min: { createdAt: null },
      _max: { createdAt: null },
    } as never);

    await expect(getSurveyRetentionFacts(survey, NOW)).resolves.toEqual({
      createdAt: at(1),
      updatedAt: at(2),
      archivedAt: null,
      oldestResponseAt: null,
      newestResponseAt: null,
      surveysNotice: null,
      responsesNotice: null,
      surveyHeldUntil: null,
      responsesHeldUntil: null,
    });
  });
});

describe("countSurveysResponsesCreatedAtOrBefore", () => {
  const cutoff = at(1);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("asks nothing for no surveys", async () => {
    await expect(countSurveysResponsesCreatedAtOrBefore([], cutoff)).resolves.toEqual(new Map());
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("counts every survey in one statement, up to the cap each, and marks a capped count", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { surveyId: "s1", count: 3 },
      { surveyId: "s2", count: 5 },
    ]);

    await expect(countSurveysResponsesCreatedAtOrBefore(["s1", "s2"], cutoff, 5)).resolves.toEqual(
      new Map([
        ["s1", { count: 3, relation: "eq" }],
        ["s2", { count: 5, relation: "gte" }],
      ])
    );

    const { text, values } = statement(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(text).toContain('FROM unnest(?::text[]) AS s("id")');
    expect(values).toEqual([cutoff, 5, ["s1", "s2"]]);
  });

  test("runs on the client it is given, with the default cap", async () => {
    const client = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await countSurveysResponsesCreatedAtOrBefore(["s1"], cutoff, undefined, client as never);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(statement(client.$queryRaw.mock.calls[0]).values[1]).toBe(SURVEY_RETENTION_DUE_COUNT_CAP);
  });

  test("counts one survey, as none when it has no row", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ surveyId: "s1", count: 2 }])
      .mockResolvedValueOnce([]);

    await expect(countSurveyResponsesCreatedAtOrBefore("s1", cutoff)).resolves.toEqual({
      count: 2,
      relation: "eq",
    });
    await expect(countSurveyResponsesCreatedAtOrBefore("s1", cutoff)).resolves.toEqual({
      count: 0,
      relation: "eq",
    });
  });
});
