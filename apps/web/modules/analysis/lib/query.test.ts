import { describe, expect, test } from "vitest";
import { surveyAnalysisKeys } from "./query";

describe("surveyAnalysisKeys", () => {
  test("keys a survey's filter data by its id", () => {
    expect(surveyAnalysisKeys.filterData("survey_1")).toEqual(["surveys", "survey_1", "filter-data"]);
  });
});
