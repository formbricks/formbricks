import { describe, expect, test } from "vitest";
import { TSurveyElementChoice, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { getChoiceTypeSwitchUpdate } from "./element-type-switch";

const choices = [
  { id: "c1", label: { default: "Yes" }, code: "1" },
  { id: "c2", label: { default: "No" }, code: "2" },
] as TSurveyElementChoice[];

const { MultipleChoiceSingle, MultipleChoiceMulti, Ranking, OpenText } = TSurveyElementTypeEnum;

describe("getChoiceTypeSwitchUpdate", () => {
  test.each([
    [MultipleChoiceSingle, MultipleChoiceMulti],
    [MultipleChoiceMulti, MultipleChoiceSingle],
    [MultipleChoiceMulti, Ranking],
    [Ranking, MultipleChoiceSingle],
  ])("%s to %s keeps the options with their codes and leaves the question code alone", (from, to) => {
    const update = getChoiceTypeSwitchUpdate({ type: from, choices }, to);
    expect(update).toEqual({ choices, type: to, logic: undefined, validation: undefined });
    expect(update).not.toHaveProperty("code");
  });

  test("is null for a switch that is not between choice types", () => {
    expect(getChoiceTypeSwitchUpdate({ type: MultipleChoiceSingle, choices }, OpenText)).toBeNull();
  });
});
