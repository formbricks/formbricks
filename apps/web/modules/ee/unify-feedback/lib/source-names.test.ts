import { describe, expect, test } from "vitest";
import { getConnectedSurveyIds, getRecordSourceNames } from "./source-names";

const surveySource = (surveyIds: string[]) =>
  ({
    type: "formbricks_survey",
    formbricksMappings: surveyIds.map((surveyId) => ({ surveyId })),
    fieldMappings: [],
  }) as unknown as Parameters<typeof getRecordSourceNames>[0][number];

const csvSource = (mapping?: { sourceFieldId?: string; staticValue: string | null }) =>
  ({
    type: "csv",
    formbricksMappings: [],
    fieldMappings: mapping
      ? [{ targetFieldId: "source_name", sourceFieldId: mapping.sourceFieldId ?? "", ...mapping }]
      : [],
  }) as unknown as Parameters<typeof getRecordSourceNames>[0][number];

describe("record source names", () => {
  test("a survey connector offers its linked surveys' names, not its own", () => {
    const sources = [surveySource(["s1", "s2", "s1"]), surveySource(["s2", "missing"])];
    expect(getConnectedSurveyIds(sources)).toEqual(["s1", "s2", "missing"]);
    expect(
      getRecordSourceNames(
        sources,
        new Map([
          ["s1", "NPS Q3"],
          ["s2", "Onboarding"],
        ])
      )
    ).toEqual(["NPS Q3", "Onboarding"]);
  });

  test("a CSV import offers its static source_name, and nothing when that is a column or unmapped", () => {
    expect(
      getRecordSourceNames(
        [
          csvSource({ staticValue: " Zendesk export " }),
          csvSource({ sourceFieldId: "channel", staticValue: null }),
          csvSource(),
        ],
        new Map()
      )
    ).toEqual(["Zendesk export"]);
  });

  test("CSV sources contribute no survey ids", () => {
    expect(getConnectedSurveyIds([csvSource({ staticValue: "x" })])).toEqual([]);
  });
});
