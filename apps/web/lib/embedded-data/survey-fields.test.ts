import { describe, expect, test } from "vitest";
import { isDeepEqual } from "@/lib/utils/object";
import {
  inlineSurveyEmbeddedFields,
  selectPublicSurveyEmbeddedDataLinks,
  selectSurveyEmbeddedDataLinks,
  withInlinedEmbeddedFields,
} from "./survey-fields";

/**
 * The property the respondent-facing callers rest on.
 *
 * Their own tests assert that each loader selects `selectPublicSurveyEmbeddedDataLinks` — necessary,
 * but both sides of that comparison are this module's constant, so adding `id` to it would leave
 * every one of them green. This is the half that cannot be satisfied by the constant agreeing with
 * itself, and it is why the pair is worth having: caller → public constant, public constant → no id.
 */
describe("selectPublicSurveyEmbeddedDataLinks", () => {
  test("omits the workspace-library row id", () => {
    expect(selectPublicSurveyEmbeddedDataLinks.select.embeddedData.select).not.toHaveProperty("id");
  });

  test("still carries what a renderer resolves recall and logic through", () => {
    expect(selectPublicSurveyEmbeddedDataLinks.select.embeddedData.select).toMatchObject({
      key: true,
      name: true,
      source: true,
      dataType: true,
      defaultValue: true,
      locked: true,
    });
  });

  test("the authenticated selector keeps the id, which is what the editor sends a link back by", () => {
    expect(selectSurveyEmbeddedDataLinks.select.embeddedData.select).toHaveProperty("id", true);
  });
});

const link = (
  storageKey: string,
  name: string,
  source: "computed" | "ingested",
  shared?: { id: string; key: string }
) => ({
  storageKey,
  embeddedData: {
    id: shared?.id ?? `ed_${storageKey}`,
    key: shared?.key ?? null,
    name,
    source,
    dataType: "string" as const,
    defaultValue: null,
    locked: false,
  },
});

/**
 * As the join returns them: `orderBy: [{ order: "asc" }, { storageKey: "asc" }]`. `tier` is declared
 * before `score` even though its cuid sorts after, which is what the `order` column records.
 */
const JOINED_LINKS = [
  link("clx000000000000000000002", "tier", "computed"),
  link("clx000000000000000000001", "score", "computed"),
  link("utm_source", "utm_source", "ingested"),
  link("plan", "plan", "ingested"),
];

interface TTestSurvey {
  id: string;
  updatedAt?: Date;
  embeddedDataLinks?: typeof JOINED_LINKS;
}

describe("inlineSurveyEmbeddedFields", () => {
  test("returns undefined when the select omitted the join, so the accessor can fall back", () => {
    expect(inlineSurveyEmbeddedFields({})).toBeUndefined();
  });

  test("reshapes the rows into {field, link} pairs", () => {
    const fields = inlineSurveyEmbeddedFields({ embeddedDataLinks: JOINED_LINKS });

    expect(fields?.[0]).toStrictEqual({
      field: {
        id: "ed_clx000000000000000000002",
        key: null,
        name: "tier",
        source: "computed",
        dataType: "string",
        defaultValue: null,
        locked: false,
      },
      link: { storageKey: "clx000000000000000000002" },
    });
  });

  test("preserves the order the query returned, rather than re-sorting", () => {
    // Load-bearing: ordering lives entirely in `selectSurveyEmbeddedDataLinks`' `orderBy` (ENG-2401).
    // If this ever re-sorted, the `order` column would stop deciding CSV/XLSX header and picker order.
    expect(
      inlineSurveyEmbeddedFields({ embeddedDataLinks: JOINED_LINKS })?.map(
        ({ link: { storageKey } }) => storageKey
      )
    ).toStrictEqual(["clx000000000000000000002", "clx000000000000000000001", "utm_source", "plan"]);
  });

  test("carries a shared row's id and key, which is what lets the editor send the link back", () => {
    // ENG-3228: the pairs are a write shape too. Drop either of these on the read and a survey can
    // load a library link but never save one — the write path would read it as a local field.
    const links = [link("plan_tier", "Plan tier", "ingested", { id: "ed_shared", key: "plan_tier" })];

    expect(inlineSurveyEmbeddedFields({ embeddedDataLinks: links })?.[0].field).toMatchObject({
      id: "ed_shared",
      key: "plan_tier",
    });
  });

  test("a survey with no rows and no legacy declarations inlines an empty list", () => {
    expect(inlineSurveyEmbeddedFields({ embeddedDataLinks: [] })).toStrictEqual([]);
  });

  test("a backfill-skipped survey falls back to its legacy columns rather than reporting no fields", () => {
    // Zero rows is "not reconciled yet", not "no fields". Reporting `[]` here is what let
    // `updateSingleUseLinksAction` — which spreads a loaded survey straight back into `updateSurvey` —
    // derive empty legacy columns over the only copy of this survey's declarations.
    const inlined = inlineSurveyEmbeddedFields({
      embeddedDataLinks: [],
      variables: [{ id: "var1", name: "Var One", type: "text", value: "" }],
      hiddenFields: { enabled: true, fieldIds: ["hf1"] },
    } as never);

    expect(inlined?.map((entry) => entry.link.storageKey)).toEqual(["var1", "hf1"]);
  });

  test("one row is enough to make the rows authoritative again", () => {
    // The fallback heals itself: the first save through it writes rows, and from then on the columns
    // are never consulted for this survey.
    const inlined = inlineSurveyEmbeddedFields({
      embeddedDataLinks: [link("plan", "plan", "ingested")],
      variables: [{ id: "var1", name: "Var One", type: "text", value: "" }],
      hiddenFields: { enabled: true, fieldIds: ["hf1"] },
    } as never);

    expect(inlined?.map((entry) => entry.link.storageKey)).toEqual(["plan"]);
  });
});

describe("withInlinedEmbeddedFields", () => {
  test("swaps the raw relation for the inlined pairs", () => {
    const survey: TTestSurvey = { id: "s1", embeddedDataLinks: JOINED_LINKS };
    const transformed = withInlinedEmbeddedFields(survey);

    expect(transformed).not.toHaveProperty("embeddedDataLinks");
    expect(transformed).toHaveProperty("embeddedFields");
  });

  test("leaves a survey read without the join untouched, adding no key", () => {
    const survey: TTestSurvey = { id: "s1" };

    expect(withInlinedEmbeddedFields(survey)).toStrictEqual(survey);
    expect(withInlinedEmbeddedFields(survey)).not.toHaveProperty("embeddedFields");
  });

  test("adds the key even when the survey has no fields at all", () => {
    // Load-bearing for the editor invariant below: once a select carries the join, EVERY survey read
    // through it has an `embeddedFields` key, empty list included.
    const survey: TTestSurvey = { id: "s1", embeddedDataLinks: [] };

    expect(withInlinedEmbeddedFields(survey)).toHaveProperty("embeddedFields", []);
  });
});

/**
 * The survey editor clones the server survey into its working copy and the menu bar compares the two
 * with {@link isDeepEqual} to gate the draft auto-save, the discard-changes dialog and the
 * beforeunload prompt. That comparison short-circuits on differing key counts, so the working copy
 * must stay structurally identical to what the server sent — which is why ENG-1837 does NOT strip the
 * inlined `embeddedFields` there and gives editor surfaces `getDeclaredEmbeddedFields` instead.
 *
 * These cases fail if anyone reintroduces a key-shape mutation on the editor's clone: an untouched
 * editor would then report unsaved changes forever and re-save an open draft every 10 seconds.
 */
describe("the editor's clone stays comparable to the server survey", () => {
  const surveyWithRows = withInlinedEmbeddedFields({
    id: "s1",
    updatedAt: new Date("2026-08-13T10:00:00.000Z"),
    embeddedDataLinks: JOINED_LINKS,
  });

  const surveyWithoutFields = withInlinedEmbeddedFields({
    id: "s1",
    updatedAt: new Date("2026-08-13T10:00:00.000Z"),
    embeddedDataLinks: [],
  });

  test.each([
    ["with rows", surveyWithRows],
    ["with no fields at all", surveyWithoutFields],
  ])("an untouched clone deep-equals the server survey (%s)", (_label, survey) => {
    const localSurvey = structuredClone(survey);

    // beforeunload compares the whole objects; back-navigation and auto-save strip `updatedAt` first.
    expect(isDeepEqual(localSurvey, survey)).toBe(true);

    const { updatedAt: _localUpdatedAt, ...localSurveyRest } = localSurvey;
    const { updatedAt: _surveyUpdatedAt, ...surveyRest } = survey;
    expect(isDeepEqual(localSurveyRest, surveyRest)).toBe(true);
  });

  test.each([
    ["with rows", surveyWithRows],
    ["with no fields at all", surveyWithoutFields],
  ])("dropping embeddedFields from the clone would break that comparison (%s)", (_label, survey) => {
    const { embeddedFields: _embeddedFields, ...strippedClone } = structuredClone(survey);

    expect(isDeepEqual(strippedClone, survey)).toBe(false);
  });
});
