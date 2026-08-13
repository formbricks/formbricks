import { describe, expect, test } from "vitest";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { isDeepEqual } from "@/lib/utils/object";
import { inlineSurveyEmbeddedFields, withInlinedEmbeddedFields } from "./survey-fields";

const link = (storageKey: string, name: string, source: "computed" | "ingested") => ({
  storageKey,
  embeddedData: {
    name,
    source,
    dataType: "string" as const,
    defaultValue: null,
    locked: false,
  },
});

const LEGACY = {
  variables: [
    { id: "clx000000000000000000002", name: "tier", type: "text" as const, value: "free" },
    { id: "clx000000000000000000001", name: "score", type: "number" as const, value: 7 },
  ],
  hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
};

/** The join's own output order: `orderBy: { storageKey: "asc" }`. */
const JOINED_LINKS = [
  link("clx000000000000000000001", "score", "computed"),
  link("clx000000000000000000002", "tier", "computed"),
  link("plan", "plan", "ingested"),
  link("utm_source", "utm_source", "ingested"),
];

describe("inlineSurveyEmbeddedFields", () => {
  test("returns undefined when the select omitted the join, so the accessor can fall back", () => {
    expect(inlineSurveyEmbeddedFields({ ...LEGACY })).toBeUndefined();
  });

  test("reshapes the rows into {field, link} pairs", () => {
    const fields = inlineSurveyEmbeddedFields({ ...LEGACY, embeddedDataLinks: JOINED_LINKS });

    expect(fields?.[0]).toStrictEqual({
      field: { name: "tier", source: "computed", dataType: "string", defaultValue: null, locked: false },
      link: { storageKey: "clx000000000000000000002" },
    });
  });

  test("orders by the legacy declaration, not by storage key", () => {
    // `tier` is declared before `score` even though its cuid sorts after. This is CSV/XLSX header
    // order and picker order, so the join's `storageKey asc` is only the tie-break.
    expect(
      inlineSurveyEmbeddedFields({ ...LEGACY, embeddedDataLinks: JOINED_LINKS })?.map(
        ({ link: { storageKey } }) => storageKey
      )
    ).toStrictEqual(["clx000000000000000000002", "clx000000000000000000001", "utm_source", "plan"]);
  });

  test("keeps a row the legacy columns do not know, sorted last", () => {
    const fields = inlineSurveyEmbeddedFields({
      ...LEGACY,
      embeddedDataLinks: [...JOINED_LINKS, link("orphan", "orphan", "ingested")],
    });

    expect(fields?.map(({ link: { storageKey } }) => storageKey).at(-1)).toBe("orphan");
    expect(fields).toHaveLength(5);
  });

  test("a survey with no declarations and no rows inlines an empty list", () => {
    expect(
      inlineSurveyEmbeddedFields({
        variables: [],
        hiddenFields: { enabled: false, fieldIds: [] },
        embeddedDataLinks: [],
      })
    ).toStrictEqual([]);
  });
});

describe("withInlinedEmbeddedFields", () => {
  test("swaps the raw relation for the inlined pairs", () => {
    const survey = { id: "s1", ...LEGACY, embeddedDataLinks: JOINED_LINKS };
    const transformed = withInlinedEmbeddedFields(survey);

    expect(transformed).not.toHaveProperty("embeddedDataLinks");
    expect(transformed).toHaveProperty("embeddedFields");
  });

  test("leaves a survey read without the join untouched, adding no key", () => {
    const survey = { id: "s1", ...LEGACY };

    expect(withInlinedEmbeddedFields(survey)).toStrictEqual(survey);
    expect(withInlinedEmbeddedFields(survey)).not.toHaveProperty("embeddedFields");
  });

  test("adds the key even when the survey has no fields at all", () => {
    // Load-bearing for the editor invariant below: once a select carries the join, EVERY survey read
    // through it has an `embeddedFields` key, empty list included.
    const transformed = withInlinedEmbeddedFields({
      id: "s1",
      variables: [],
      hiddenFields: { enabled: false, fieldIds: [] },
      embeddedDataLinks: [],
    });

    expect(transformed).toHaveProperty("embeddedFields", []);
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
    ...LEGACY,
    embeddedDataLinks: JOINED_LINKS,
  });

  const surveyWithoutFields = withInlinedEmbeddedFields({
    id: "s1",
    updatedAt: new Date("2026-08-13T10:00:00.000Z"),
    variables: [],
    hiddenFields: { enabled: false, fieldIds: [] },
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
