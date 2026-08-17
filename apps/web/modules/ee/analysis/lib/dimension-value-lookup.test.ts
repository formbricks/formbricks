import { describe, expect, test } from "vitest";
import {
  FIELD_TYPE_DIMENSION_ID,
  QUESTION_LABEL_DIMENSION_ID,
  buildDimensionValueQuery,
  collectDimensionValues,
} from "./dimension-value-lookup";

describe("buildDimensionValueQuery", () => {
  test("pairs the question label with its field type, breaking label ties on the field type", () => {
    const query = buildDimensionValueQuery({ dimension: QUESTION_LABEL_DIMENSION_ID, limit: 100 });

    expect(query.dimensions).toEqual([QUESTION_LABEL_DIMENSION_ID, FIELD_TYPE_DIMENSION_ID]);
    expect(query.order).toEqual([
      [QUESTION_LABEL_DIMENSION_ID, "asc"],
      [FIELD_TYPE_DIMENSION_ID, "asc"],
    ]);
    expect(query.filters).toBeUndefined();
  });

  test("over-fetches rows for the label lookup, since a label can span several field types", () => {
    const query = buildDimensionValueQuery({ dimension: QUESTION_LABEL_DIMENSION_ID, limit: 100 });

    expect(query.limit).toBe(200);
  });

  test("looks up any other dimension on its own, at the requested limit", () => {
    const query = buildDimensionValueQuery({ dimension: "FeedbackRecords.sourceName", limit: 25 });

    expect(query.dimensions).toEqual(["FeedbackRecords.sourceName"]);
    expect(query.order).toEqual([["FeedbackRecords.sourceName", "asc"]]);
    expect(query.limit).toBe(25);
  });

  test("narrows results server-side when a search term is given", () => {
    const query = buildDimensionValueQuery({
      dimension: QUESTION_LABEL_DIMENSION_ID,
      limit: 100,
      search: "stadium",
    });

    expect(query.filters).toEqual([
      { member: QUESTION_LABEL_DIMENSION_ID, operator: "contains", values: ["stadium"] },
    ]);
  });
});

describe("collectDimensionValues", () => {
  test("returns each value with its field type, in row order", () => {
    const rows = [
      { [QUESTION_LABEL_DIMENSION_ID]: "How satisfied are you?", [FIELD_TYPE_DIMENSION_ID]: "csat" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Any other feedback?", [FIELD_TYPE_DIMENSION_ID]: "text" },
    ];

    expect(collectDimensionValues(rows, QUESTION_LABEL_DIMENSION_ID)).toEqual([
      { value: "How satisfied are you?", fieldType: "csat" },
      { value: "Any other feedback?", fieldType: "text" },
    ]);
  });

  test("keeps the first field type when a label was stored under several types", () => {
    const rows = [
      { [QUESTION_LABEL_DIMENSION_ID]: "Rate us", [FIELD_TYPE_DIMENSION_ID]: "rating" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Rate us", [FIELD_TYPE_DIMENSION_ID]: "nps" },
    ];

    expect(collectDimensionValues(rows, QUESTION_LABEL_DIMENSION_ID)).toEqual([
      { value: "Rate us", fieldType: "rating" },
    ]);
  });

  test("trims values and drops blank, non-string and duplicate ones", () => {
    const rows = [
      { [QUESTION_LABEL_DIMENSION_ID]: "  Padded  " },
      { [QUESTION_LABEL_DIMENSION_ID]: "Padded" },
      { [QUESTION_LABEL_DIMENSION_ID]: "   " },
      { [QUESTION_LABEL_DIMENSION_ID]: null },
      { [QUESTION_LABEL_DIMENSION_ID]: 42 },
      {},
    ];

    expect(collectDimensionValues(rows, QUESTION_LABEL_DIMENSION_ID)).toEqual([{ value: "Padded" }]);
  });

  test("omits the field type when the row has none", () => {
    const rows = [
      { "FeedbackRecords.sourceName": "Web app", [FIELD_TYPE_DIMENSION_ID]: "  " },
      { "FeedbackRecords.sourceName": "CSV import" },
    ];

    expect(collectDimensionValues(rows, "FeedbackRecords.sourceName")).toEqual([
      { value: "Web app" },
      { value: "CSV import" },
    ]);
  });

  test("caps the deduped values at the limit, counting each label once", () => {
    const rows = [
      { [QUESTION_LABEL_DIMENSION_ID]: "Rate us", [FIELD_TYPE_DIMENSION_ID]: "nps" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Rate us", [FIELD_TYPE_DIMENSION_ID]: "rating" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Any other feedback?", [FIELD_TYPE_DIMENSION_ID]: "text" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Would you recommend us?", [FIELD_TYPE_DIMENSION_ID]: "nps" },
    ];

    // The duplicate row must not spend one of the two slots — that is the truncation the over-fetch
    // in buildDimensionValueQuery exists to absorb.
    expect(collectDimensionValues(rows, QUESTION_LABEL_DIMENSION_ID, 2)).toEqual([
      { value: "Rate us", fieldType: "nps" },
      { value: "Any other feedback?", fieldType: "text" },
    ]);
  });

  test("returns every value when no limit is given", () => {
    const rows = [
      { [QUESTION_LABEL_DIMENSION_ID]: "One" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Two" },
      { [QUESTION_LABEL_DIMENSION_ID]: "Three" },
    ];

    expect(collectDimensionValues(rows, QUESTION_LABEL_DIMENSION_ID)).toHaveLength(3);
  });

  test("tolerates a non-array query result", () => {
    expect(collectDimensionValues(undefined, QUESTION_LABEL_DIMENSION_ID)).toEqual([]);
    expect(collectDimensionValues({ notRows: true }, QUESTION_LABEL_DIMENSION_ID)).toEqual([]);
  });
});
