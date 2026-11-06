import { describe, expect, test } from "vitest";
import { NO_VALUE_PICK } from "./dashboard-filters";
import { chartExcludesTextAnswers, pickNeedsTextAnswer } from "./enrichment-filters";

const FIELD_TYPE = "FeedbackRecords.fieldType";
const SENTIMENT = "FeedbackRecords.sentiment";

describe("chartExcludesTextAnswers", () => {
  test("a chart whose saved filters pin fieldType to types without text reads no text answer", () => {
    expect(
      chartExcludesTextAnswers({
        measures: ["FeedbackRecords.count"],
        filters: [{ member: FIELD_TYPE, operator: "equals", values: ["nps", " Rating "] }],
      })
    ).toBe(true);
    expect(
      chartExcludesTextAnswers({
        measures: ["FeedbackRecords.count"],
        filters: [
          {
            and: [
              { member: "FeedbackRecords.sourceName", operator: "set" },
              { member: FIELD_TYPE, operator: "equals", values: ["csat"] },
            ],
          },
        ],
      })
    ).toBe(true);
    expect(
      chartExcludesTextAnswers({
        filters: [
          {
            or: [
              { member: FIELD_TYPE, operator: "equals", values: ["nps"] },
              { member: FIELD_TYPE, operator: "equals", values: ["boolean"] },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  test("a chart whose every measure reads one numeric question type reads no text answer", () => {
    expect(chartExcludesTextAnswers({ measures: ["FeedbackRecords.npsScore"] })).toBe(true);
    expect(
      chartExcludesTextAnswers({ measures: ["FeedbackRecords.csatAverage", "FeedbackRecords.ratingCount"] })
    ).toBe(true);
  });

  test("anything that does not prove it keeps today's behaviour", () => {
    // text and categorical can carry text; notEquals and an OR with another rule prove nothing.
    for (const query of [
      { measures: ["FeedbackRecords.count"] },
      { measures: ["FeedbackRecords.count", "FeedbackRecords.npsScore"] },
      { measures: [] },
      { filters: [{ member: FIELD_TYPE, operator: "equals", values: ["nps", "text"] }] },
      { filters: [{ member: FIELD_TYPE, operator: "equals", values: ["categorical"] }] },
      { filters: [{ member: FIELD_TYPE, operator: "equals", values: [] }] },
      { filters: [{ member: FIELD_TYPE, operator: "notEquals", values: ["text"] }] },
      {
        filters: [
          {
            or: [
              { member: FIELD_TYPE, operator: "equals", values: ["nps"] },
              { member: "FeedbackRecords.sourceName", operator: "equals", values: ["Web"] },
            ],
          },
        ],
      },
      { filters: [{ or: [] }] },
      null,
      "nps",
      { filters: "nope", measures: "nope" },
    ]) {
      expect(chartExcludesTextAnswers(query)).toBe(false);
    }
  });
});

describe("pickNeedsTextAnswer", () => {
  test("a pick on an enrichment field that only a record with a value passes needs a text answer", () => {
    for (const operator of ["equals", "contains", "set"] as const) {
      expect(pickNeedsTextAnswer({ field: SENTIMENT, operator }, ["positive"])).toBe(true);
    }
    expect(pickNeedsTextAnswer({ field: "FeedbackRecords.sentimentScore", operator: "gt" }, ["0.5"])).toBe(
      true
    );
    expect(pickNeedsTextAnswer({ field: "FeedbackRecords.emotions", operator: "contains" }, ["joy"])).toBe(
      true
    );
  });

  test("a pick a record without a value passes, or on another field, does not", () => {
    for (const operator of ["notEquals", "notContains", "notSet"] as const) {
      expect(pickNeedsTextAnswer({ field: SENTIMENT, operator }, ["positive"])).toBe(false);
    }
    expect(pickNeedsTextAnswer({ field: SENTIMENT, operator: "equals" }, ["positive", NO_VALUE_PICK])).toBe(
      false
    );
    expect(pickNeedsTextAnswer({ field: "FeedbackRecords.valueText", operator: "equals" }, ["x"])).toBe(
      false
    );
  });
});
