import { describe, expect, test } from "vitest";
import {
  FIELD_TYPE_DIMENSION_ID,
  QUESTION_LABEL_DIMENSION_ID,
  buildDimensionValueQuery,
  collectDimensionValues,
} from "./dimension-value-lookup";

describe("buildDimensionValueQuery", () => {
  test("pairs the question label with its field type", () => {
    const query = buildDimensionValueQuery({ dimension: QUESTION_LABEL_DIMENSION_ID, limit: 100 });

    expect(query.dimensions).toEqual([QUESTION_LABEL_DIMENSION_ID, FIELD_TYPE_DIMENSION_ID]);
    expect(query.order).toEqual([[QUESTION_LABEL_DIMENSION_ID, "asc"]]);
    expect(query.limit).toBe(100);
    expect(query.filters).toBeUndefined();
  });

  test("looks up any other dimension on its own", () => {
    const query = buildDimensionValueQuery({ dimension: "FeedbackRecords.sourceName", limit: 25 });

    expect(query.dimensions).toEqual(["FeedbackRecords.sourceName"]);
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

  test("tolerates a non-array query result", () => {
    expect(collectDimensionValues(undefined, QUESTION_LABEL_DIMENSION_ID)).toEqual([]);
    expect(collectDimensionValues({ notRows: true }, QUESTION_LABEL_DIMENSION_ID)).toEqual([]);
  });
});
