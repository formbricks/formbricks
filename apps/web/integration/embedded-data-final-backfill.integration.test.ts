import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  dropLegacySurveyColumns,
  restoreLegacySurveyColumns,
  setLegacySurveyColumns,
} from "@/integration/legacy-survey-columns";
import { resetDb } from "@/integration/reset-db";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { backfillRemainingEmbeddedDataRows } from "../../../packages/database/migration/20260928120000_eng_2404_backfill_remaining_embedded_data/migration";

/**
 * ENG-2404's final backfill against real Postgres: the last read of `Survey.variables` /
 * `Survey.hiddenFields` before the next migration drops them.
 *
 * What only a real database shows: the candidate query (zero links, something declared — malformed
 * included), that a survey with rows is never touched, the unique constraints a salvage has to stay
 * inside, and that `Response` is never read or written. The salvage rules themselves are unit-tested
 * beside the migration (`utils.test.ts`).
 */

const seedWorkspace = async (): Promise<string> => {
  const organization = await prisma.organization.create({ data: { name: "Final Backfill Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Final Backfill Workspace", organizationId: organization.id },
  });
  return workspace.id;
};

const seedSurvey = async (
  workspaceId: string,
  legacy: { variables?: unknown; hiddenFields?: unknown },
  name = "Survey"
): Promise<string> => {
  const survey = await prisma.survey.create({ data: { name, workspaceId } });
  await setLegacySurveyColumns(survey.id, legacy);
  return survey.id;
};

/** The survey's fields in stored order — the order every reader sees. */
const readFields = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      orderBy: [{ order: "asc" }, { storageKey: "asc" }],
      select: {
        storageKey: true,
        order: true,
        embeddedData: { select: { name: true, source: true, dataType: true, defaultValue: true } },
      },
    })
    .then((links) =>
      links.map(({ storageKey, order, embeddedData }) => ({ storageKey, order, ...embeddedData }))
    );

const score = { id: "clx000000000000000000001", name: "score", type: "number", value: 7 };
const tier = { id: "clx000000000000000000002", name: "tier", type: "text", value: "free" };

beforeAll(async () => {
  await restoreLegacySurveyColumns();
});

afterAll(async () => {
  await dropLegacySurveyColumns();
});

beforeEach(async () => {
  await resetDb();
  vi.restoreAllMocks();
});

describe("ENG-2404 final Embedded Data backfill (real Postgres)", () => {
  test("gives a survey with no links its fields, in declaration order, at their existing addresses", async () => {
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, {
      // `tier` declared before `score` although its cuid sorts after: `order` has to record that.
      variables: [tier, score],
      hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
    });

    const stats = await backfillRemainingEmbeddedDataRows(prisma);

    expect(stats).toEqual({ backfilledSurveys: 1, backfilledFields: 4, lossySurveys: [] });
    expect(await readFields(surveyId)).toEqual([
      {
        storageKey: tier.id,
        order: 0,
        name: "tier",
        source: "computed",
        dataType: "string",
        defaultValue: "free",
      },
      {
        storageKey: score.id,
        order: 1,
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 7,
      },
      {
        storageKey: "utm_source",
        order: 2,
        name: "utm_source",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
      },
      {
        storageKey: "plan",
        order: 3,
        name: "plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
      },
    ]);
  });

  test("never touches a survey that already has links, even when its columns disagree", async () => {
    // Rows are authoritative since ENG-2412 and may have been edited in the Embedded Data panel.
    // Repairing them from the columns would revert those edits to whatever the columns last said.
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, {
      variables: [score],
      hiddenFields: { enabled: true, fieldIds: ["plan", "stale_field"] },
    });
    const renamed = await prisma.embeddedData.create({
      data: {
        workspaceId,
        surveyId,
        name: "Plan (renamed in the panel)",
        source: "ingested",
        dataType: "number",
      },
    });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId, surveyId, embeddedDataId: renamed.id, storageKey: "plan", order: 0 },
    });
    const before = await readFields(surveyId);

    const stats = await backfillRemainingEmbeddedDataRows(prisma);

    expect(stats.backfilledSurveys).toBe(0);
    expect(await readFields(surveyId)).toEqual(before);
    expect(await prisma.embeddedData.count({ where: { surveyId } })).toBe(1);
  });

  test("salvages a survey the first backfill skipped, and logs exactly what it could not keep", async () => {
    const warn = vi.spyOn(logger, "warn");
    const workspaceId = await seedWorkspace();
    // A duplicated hidden field — what made ENG-1835 skip the whole survey — beside a malformed
    // variable element and a healthy one.
    const surveyId = await seedSurvey(workspaceId, {
      variables: [score, { name: "no_id", type: "text", value: "" }],
      hiddenFields: { enabled: true, fieldIds: ["plan", "campaign", "plan"] },
    });

    const stats = await backfillRemainingEmbeddedDataRows(prisma);

    expect((await readFields(surveyId)).map(({ storageKey, order }) => [storageKey, order])).toEqual([
      [score.id, 0],
      ["plan", 1],
      ["campaign", 2],
    ]);
    const lost = ["variables[1] has no string id", "duplicate ingested field plan; kept the first"];
    expect(stats).toEqual({ backfilledSurveys: 1, backfilledFields: 3, lossySurveys: [{ surveyId, lost }] });
    expect(warn).toHaveBeenCalledWith({ surveyId, kept: 3, lost }, expect.stringContaining("could not keep"));
  });

  test("logs a survey whose only declarations are unreadable, rather than passing it in silence", async () => {
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, {
      variables: { oops: true },
      hiddenFields: { enabled: true, fieldIds: "plan" },
    });

    const stats = await backfillRemainingEmbeddedDataRows(prisma);

    expect(stats).toEqual({
      backfilledSurveys: 0,
      backfilledFields: 0,
      lossySurveys: [
        {
          surveyId,
          lost: ["variables is object, not an array", "hiddenFields.fieldIds is string, not an array"],
        },
      ],
    });
    expect(await readFields(surveyId)).toEqual([]);
  });

  test("says so when nothing needed backfilling, and a second run is a no-op", async () => {
    const info = vi.spyOn(logger, "info");
    const workspaceId = await seedWorkspace();
    await seedSurvey(workspaceId, {});

    const empty = await backfillRemainingEmbeddedDataRows(prisma);
    expect(empty).toEqual({ backfilledSurveys: 0, backfilledFields: 0, lossySurveys: [] });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("0 surveys needed backfill"));

    await seedSurvey(workspaceId, { hiddenFields: { enabled: true, fieldIds: ["plan"] } });
    expect((await backfillRemainingEmbeddedDataRows(prisma)).backfilledSurveys).toBe(1);
    expect((await backfillRemainingEmbeddedDataRows(prisma)).backfilledSurveys).toBe(0);
    expect(await prisma.embeddedData.count()).toBe(1);
  });

  test("never reads or writes Response", async () => {
    const workspaceId = await seedWorkspace();
    const surveyId = await seedSurvey(workspaceId, {
      variables: [score],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });
    const response = await prisma.response.create({
      data: {
        surveyId,
        finished: true,
        data: { plan: "pro" },
        variables: { [score.id]: 42 },
        meta: {},
        ttc: {},
      },
      select: { id: true, updatedAt: true },
    });
    // Everything the migration does goes through the client it is handed, so hand it one that
    // records its raw SQL and refuses the `response` model outright.
    const queries: string[] = [];
    const recordingTx = new Proxy(prisma, {
      get(target, property) {
        if (property === "response") throw new Error("the final backfill touched Response");
        if (property === "$queryRaw") {
          return (strings: TemplateStringsArray, ...values: unknown[]) => {
            queries.push(strings.join("?"));
            return target.$queryRaw(strings, ...values);
          };
        }
        const value: unknown = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await backfillRemainingEmbeddedDataRows(recordingTx);

    const stored = await prisma.response.findUniqueOrThrow({
      where: { id: response.id },
      select: { data: true, variables: true, updatedAt: true },
    });
    expect(stored).toEqual({
      data: { plan: "pro" },
      variables: { [score.id]: 42 },
      updatedAt: response.updatedAt,
    });
    expect(await prisma.response.count({ where: { surveyId } })).toBe(1);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((sql) => !sql.includes('"Response"'))).toBe(true);
    // And the survey did get its rows, so the run above was not a no-op that proves nothing.
    expect(await prisma.surveyEmbeddedData.count({ where: { surveyId } })).toBe(2);
  });
});
