import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { toSentenceFieldGroups } from "./condition-field-groups";
import { getConditionValueOptions } from "./utils";

const t = ((key: string) => key) as unknown as TFunction;

/**
 * The rule editor's first selector (ENG-6969 T6): its list groups the fields as Questions, Hidden
 * fields, Embedded Data and Survey info. The shared pickers keep their own grouping.
 */
describe("toSentenceFieldGroups", () => {
  const groups = toSentenceFieldGroups(getConditionValueOptions(surveyFlowFixture, t, 4, true), t);
  const values = (label: string) =>
    groups.find((group) => group.label === label)?.options.map((option) => option.value);

  test("the groups come in the order the rule sentence reads them", () => {
    expect(groups.map((group) => group.label)).toEqual([
      "common.questions",
      "common.hidden_fields",
      "common.embedded_data",
      "workspace.surveys.edit.flow.survey_info",
    ]);
  });

  test("hidden fields (URL parameters) get their own group, apart from calculated Embedded Data", () => {
    expect(values("common.hidden_fields")).toEqual(
      expect.arrayContaining([ids.hiddenFields.panelId, ids.hiddenFields.seg])
    );
    expect(values("common.hidden_fields")).not.toContain(ids.variables.score);
    expect(values("common.embedded_data")).toEqual(
      expect.arrayContaining([ids.variables.score, ids.variables.segment])
    );
    expect(values("common.embedded_data")).not.toContain(ids.hiddenFields.panelId);
  });

  test("auto-captured fields read as Survey info", () => {
    expect(values("workspace.surveys.edit.flow.survey_info")).toContain("url");
  });

  test("every field the shared list offers is still offered, once", () => {
    const shared = getConditionValueOptions(surveyFlowFixture, t, 4, true).flatMap((group) =>
      group.options.map((option) => option.value)
    );
    const regrouped = groups.flatMap((group) => group.options.map((option) => option.value));

    expect(regrouped).toHaveLength(shared.length);
    expect(new Set(regrouped)).toEqual(new Set(shared));
  });

  test("an empty group is dropped", () => {
    const withoutHidden = toSentenceFieldGroups(
      getConditionValueOptions({ ...surveyFlowFixture, embeddedFields: [] }, t, 4, false),
      t
    );

    expect(withoutHidden.map((group) => group.label)).toEqual(["common.questions"]);
  });
});
