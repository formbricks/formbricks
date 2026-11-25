import { describe, expect, test } from "vitest";
import {
  MAX_NOT_SHOWN_IDS,
  MAX_NOT_SHOWN_MAP_KEYS,
  OPTION_LIST_NAMES,
  ZResponseNotShownInput,
  getElementOptionsNotShownFromRecord,
  getNotShownElementIds,
  getNotShownIds,
  getOptionListKeyOfNoun,
} from "./not-shown";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixtureNotShown } from "./test-fixtures/survey-flow-fixture";
import { surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";

const { blocks } = surveyFlowFixture;

describe("getNotShownElementIds", () => {
  test("lists the elements the record names and every element of the blocks it names", () => {
    expect([...getNotShownElementIds(surveyFlowFixtureNotShown, blocks)].sort()).toEqual([
      "apple_reason",
      "hours",
    ]);
  });

  test("an unknown record (null) hides nothing, so results read it as today", () => {
    expect(getNotShownElementIds(null, blocks).size).toBe(0);
    expect(getNotShownElementIds(undefined, blocks).size).toBe(0);
  });

  test("never returns an id that is not an element of the survey", () => {
    const ids = getNotShownElementIds(
      { elements: ["verifiedEmail", SURVEY_FLOW_FIXTURE_IDS.hiddenFields.panelId, "fav"] },
      blocks
    );
    expect([...ids]).toEqual(["fav"]);
  });

  // A draft or migrated block can be stored without `elements` (ENG-2497).
  test("skips a block with no elements array", () => {
    const ids = getNotShownElementIds({ blocks: ["legacy"], elements: ["fav"] }, [
      { id: "legacy" },
      ...blocks,
    ]);
    expect([...ids]).toEqual(["fav"]);
  });
});

describe("ZResponseNotShownInput", () => {
  test("accepts the approved shape, options, rows and columns included", () => {
    const record = {
      blocks: [SURVEY_FLOW_FIXTURE_IDS.blocks.heavyUsers],
      elements: ["apple_reason"],
      options: { services: ["apple"] },
      rows: { brand_grid: ["row_a"] },
      columns: { brand_grid: ["col_b"] },
    };
    expect(ZResponseNotShownInput.parse(record)).toEqual(record);
  });

  test("refuses unknown keys at every level", () => {
    expect(ZResponseNotShownInput.safeParse({ elements: [], extra: true }).success).toBe(false);
  });

  test("caps every list and map at its named limit", () => {
    const ids = (count: number) => Array.from({ length: count }, (_, index) => `id${index}`);
    expect(ZResponseNotShownInput.safeParse({ elements: ids(MAX_NOT_SHOWN_IDS) }).success).toBe(true);
    expect(ZResponseNotShownInput.safeParse({ elements: ids(MAX_NOT_SHOWN_IDS + 1) }).success).toBe(false);

    const map = (count: number) => Object.fromEntries(ids(count).map((id) => [id, ["a"]]));
    expect(ZResponseNotShownInput.safeParse({ options: map(MAX_NOT_SHOWN_MAP_KEYS) }).success).toBe(true);
    expect(ZResponseNotShownInput.safeParse({ options: map(MAX_NOT_SHOWN_MAP_KEYS + 1) }).success).toBe(
      false
    );
  });

  test("refuses a NULL byte in an id or a map key, which Postgres would answer with a 500", () => {
    const nul = "q\u0000";
    for (const record of [
      { elements: [nul] },
      { blocks: [nul] },
      { options: { [nul]: ["a"] } },
      { rows: { matrix: [nul] } },
    ]) {
      expect(ZResponseNotShownInput.safeParse(record).success).toBe(false);
    }
  });
});

describe("OPTION_LIST_NAMES: one name table for every option list", () => {
  test("each noun leads back to its own list, whose record map holds it", () => {
    for (const listKey of ["choices", "rows", "columns"] as const) {
      expect(getOptionListKeyOfNoun(OPTION_LIST_NAMES[listKey].noun)).toBe(listKey);
    }
    expect(OPTION_LIST_NAMES.choices).toEqual({ recordKey: "options", noun: "option" });
  });
});

describe("getElementOptionsNotShownFromRecord", () => {
  test("reads one element's options, rows and columns, keyed by option list", () => {
    const record = {
      options: { q1: ["a"], q2: ["b"] },
      rows: { matrix: ["r1"] },
      columns: { matrix: ["c1"], other: ["c2"] },
    };

    expect(getElementOptionsNotShownFromRecord(record, "q1")).toEqual({ choices: ["a"] });
    expect(getElementOptionsNotShownFromRecord(record, "matrix")).toEqual({ rows: ["r1"], columns: ["c1"] });
  });

  test("returns {} for an unknown record, an element it does not name, or an empty list", () => {
    expect(getElementOptionsNotShownFromRecord(null, "q1")).toEqual({});
    expect(getElementOptionsNotShownFromRecord(undefined, "q1")).toEqual({});
    expect(getElementOptionsNotShownFromRecord({ options: { q2: ["b"] } }, "q1")).toEqual({});
    expect(getElementOptionsNotShownFromRecord({ rows: { q1: [] } }, "q1")).toEqual({});
  });

  // ENG-6991: response ingestion spreads these lists, so an inherited member answered 500.
  test.each(["constructor", "toString", "__proto__"])(
    "reads only the record's own keys for an element id `%s`",
    (elementId) => {
      const record = { options: { q2: ["b"] }, rows: { q2: ["r"] }, columns: { q2: ["c"] } };

      expect(getElementOptionsNotShownFromRecord(record, elementId)).toEqual({});
      expect(getNotShownIds(record, "options", elementId)).toEqual([]);
    }
  );
});
