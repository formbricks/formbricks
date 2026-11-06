import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getHideToggle, getHideToggleToast, setOptionHiddenById } from "./option-hide-toggle";

/** Returns the key, so a test reads which message was picked. */
const t = ((key: string) => key) as unknown as TFunction;

const findChoice = (survey: TSurvey, elementId: string, choiceId: string) => {
  const element = survey.blocks.flatMap((block) => block.elements).find((e) => e.id === elementId);
  if (!element || !("choices" in element)) throw new Error(`${elementId} has no choices`);
  return (element.choices as { id: string; hidden?: boolean }[]).find((choice) => choice.id === choiceId);
};

describe("getHideToggle: the Hide quick action's state and tooltip", () => {
  test("a shown option offers to hide it from all respondents", () => {
    expect(getHideToggle({}, "choices", t)).toEqual({
      isHidden: false,
      nextHidden: true,
      tooltip: "workspace.surveys.edit.hide_option_tooltip",
    });
  });

  test("a Hidden option says so and how to show it again", () => {
    expect(getHideToggle({ hidden: true }, "choices", t)).toEqual({
      isHidden: true,
      nextHidden: false,
      tooltip: "workspace.surveys.edit.hidden_option_tooltip",
    });
  });

  test("matrix rows and columns are named as such", () => {
    expect(getHideToggle({}, "rows", t).tooltip).toBe("workspace.surveys.edit.hide_row_tooltip");
    expect(getHideToggle({ hidden: true }, "columns", t).tooltip).toBe(
      "workspace.surveys.edit.hidden_column_tooltip"
    );
  });
});

describe("getHideToggleToast: the toast confirms the new state", () => {
  test.each([
    ["choices", true, "workspace.surveys.edit.option_hidden_toast"],
    ["choices", false, "workspace.surveys.edit.option_shown_toast"],
    ["rows", true, "workspace.surveys.edit.row_hidden_toast"],
    ["rows", false, "workspace.surveys.edit.row_shown_toast"],
    ["columns", true, "workspace.surveys.edit.column_hidden_toast"],
    ["columns", false, "workspace.surveys.edit.column_shown_toast"],
  ] as const)("%s hidden=%s", (listKey, hidden, key) => {
    expect(getHideToggleToast(listKey, hidden, t)).toBe(key);
  });
});

describe("setOptionHiddenById: the toggle writes the Flow tab's Hidden flag", () => {
  test("hiding sets `hidden: true` on that option only", () => {
    const next = setOptionHiddenById(surveyFlowFixture, "fav", "choices", "prime", true);

    expect(findChoice(next, "fav", "prime")?.hidden).toBe(true);
    expect(findChoice(next, "fav", "netflix")?.hidden).toBeUndefined();
    // The same option id on another question is left alone.
    expect(findChoice(next, "services", "prime")?.hidden).toBeUndefined();
  });

  test("showing again drops the key, so the survey compares equal to the saved one", () => {
    const hidden = setOptionHiddenById(surveyFlowFixture, "fav", "choices", "prime", true);

    expect(setOptionHiddenById(hidden, "fav", "choices", "prime", false)).toEqual(surveyFlowFixture);
  });

  test("a Hidden option keeps its show-if when shown again", () => {
    const next = setOptionHiddenById(surveyFlowFixture, "bundle", "choices", "netflix_apple", false);
    const option = findChoice(next, "bundle", "netflix_apple") as { hidden?: boolean; showIf?: unknown };

    expect(option.hidden).toBeUndefined();
    expect(option.showIf).toBeDefined();
  });

  test("a matrix row or column is hidden in its own list", () => {
    const matrix = surveyFlowFixture.blocks
      .flatMap((block) => block.elements)
      .find((element) => element.type === TSurveyElementTypeEnum.Matrix);
    if (matrix?.type !== TSurveyElementTypeEnum.Matrix) throw new Error("fixture has a matrix");
    const rowId = matrix.rows[0].id;
    const columnId = matrix.columns[0].id;

    const next = setOptionHiddenById(
      setOptionHiddenById(surveyFlowFixture, matrix.id, "rows", rowId, true),
      matrix.id,
      "columns",
      columnId,
      true
    );
    const nextMatrix = next.blocks.flatMap((block) => block.elements).find((e) => e.id === matrix.id);
    if (nextMatrix?.type !== TSurveyElementTypeEnum.Matrix) throw new Error("still a matrix");

    expect(nextMatrix.rows[0]).toMatchObject({ id: rowId, hidden: true });
    expect(nextMatrix.columns[0]).toMatchObject({ id: columnId, hidden: true });
    expect(nextMatrix.rows[1]?.hidden).toBeUndefined();
  });

  test("an element or option that's gone leaves the survey as it is", () => {
    expect(setOptionHiddenById(surveyFlowFixture, "missing", "choices", "prime", true)).toBe(
      surveyFlowFixture
    );
    expect(setOptionHiddenById(surveyFlowFixture, "fav", "choices", "missing", true)).toBe(surveyFlowFixture);
  });
});
