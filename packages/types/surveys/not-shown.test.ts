import { describe, expect, test } from "vitest";
import {
  MAX_NOT_SHOWN_IDS,
  MAX_NOT_SHOWN_MAP_KEYS,
  ZResponseNotShownInput,
  getNotShownElementIds,
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
});
