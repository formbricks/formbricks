import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getBlockShowIfSection, getQuestionShowIfSections } from "./questions-tab-show-if";

/**
 * The show-if sections of the Questions tab's Settings tabs (ENG-6949). The fixture's blocks: 0 services
 * (`services`), 1 ratings, 2 heavy users (`hours`, block show-if), 3 concept, 4 overall (`fav` with an
 * option show-if, `apple_reason` with a show-if, `bundle` with a Hidden option, `email`), 5 profile.
 */

/** The fixture with no hidden fields, so only questions can be referenced. */
const withoutHiddenFields = (survey: TSurvey): TSurvey => ({
  ...survey,
  hiddenFields: { enabled: true, fieldIds: [] },
});

const elementIdxOf = (survey: TSurvey, blockIdx: number, elementId: string) =>
  survey.blocks[blockIdx].elements.findIndex((element) => element.id === elementId);

/** A condition the Questions tab can show but not edit: a left operand the conditions editor lacks. */
const unsupportedGroup = (): TConditionGroup =>
  ({
    id: "unsupported",
    connector: "and",
    conditions: [
      {
        id: "unsupported-condition",
        leftOperand: { type: "unknownOperand", value: "x" },
        operator: "isSet",
      },
    ],
  }) as unknown as TConditionGroup;

describe("getBlockShowIfSection: the block's Settings tab reads its show-if like the Flow tab", () => {
  test("a block with a show-if shows it, editable", () => {
    const section = getBlockShowIfSection(surveyFlowFixture, 2);

    expect(section.state).toBe("set");
    expect(section.state === "set" && section.conditions).toEqual(surveyFlowFixture.blocks[2].showIf);
    expect(section.state === "set" && section.editable).toBe(true);
  });

  test("a block without one offers to add one when something earlier can be read", () => {
    expect(getBlockShowIfSection(surveyFlowFixture, 3)).toEqual({ state: "add" });
  });

  test("the first block offers none when there is no hidden field either", () => {
    expect(getBlockShowIfSection(withoutHiddenFields(surveyFlowFixture), 0)).toEqual({
      state: "unavailable",
    });
  });

  test("a show-if the conditions editor can't show is read-only", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks[3].showIf = unsupportedGroup();

    const section = getBlockShowIfSection(survey, 3);

    expect(section.state === "set" && section.editable).toBe(false);
  });

  test("a block that's gone shows nothing to add", () => {
    expect(getBlockShowIfSection(surveyFlowFixture, 99)).toEqual({ state: "unavailable" });
  });
});

describe("getQuestionShowIfSections: which sections a question's Settings tab shows", () => {
  test("a question with a show-if shows it; one without options has no options section", () => {
    const elementIdx = elementIdxOf(surveyFlowFixture, 4, "apple_reason");

    const sections = getQuestionShowIfSections(surveyFlowFixture, 4, elementIdx);

    expect(sections.question.state).toBe("set");
    expect(sections.question.state === "set" && sections.question.conditions).toEqual(
      surveyFlowFixture.blocks[4].elements[elementIdx].showIf
    );
    expect(sections.options).toBeNull();
  });

  test("a question with options gets the options section, with the Flow tab's counts", () => {
    const sections = getQuestionShowIfSections(
      surveyFlowFixture,
      4,
      elementIdxOf(surveyFlowFixture, 4, "fav")
    );

    expect(sections.question).toEqual({ state: "add" });
    expect(sections.options).toEqual({
      state: "set",
      showIfCount: 1,
      hiddenCount: 0,
      editable: true,
      optionLists: ["choices"],
    });
  });

  test("a Hidden option counts as hidden, not as conditional", () => {
    const sections = getQuestionShowIfSections(
      surveyFlowFixture,
      4,
      elementIdxOf(surveyFlowFixture, 4, "bundle")
    );

    expect(sections.options).toMatchObject({ state: "set", showIfCount: 0, hiddenCount: 1 });
  });

  test("a matrix edits its rows and columns", () => {
    const blockIdx = surveyFlowFixture.blocks.findIndex((block) =>
      block.elements.some((element) => element.type === TSurveyElementTypeEnum.Matrix)
    );
    const elementIdx = surveyFlowFixture.blocks[blockIdx].elements.findIndex(
      (element) => element.type === TSurveyElementTypeEnum.Matrix
    );

    const sections = getQuestionShowIfSections(surveyFlowFixture, blockIdx, elementIdx);

    expect(sections.options?.optionLists).toEqual(["rows", "columns"]);
  });

  test.each([TSurveyElementTypeEnum.Ranking, TSurveyElementTypeEnum.PictureSelection])(
    "a %s question has an options section",
    (type) => {
      const blockIdx = surveyFlowFixture.blocks.findIndex((block) =>
        block.elements.some((element) => element.type === type)
      );
      const elementIdx = surveyFlowFixture.blocks[blockIdx].elements.findIndex(
        (element) => element.type === type
      );

      expect(getQuestionShowIfSections(surveyFlowFixture, blockIdx, elementIdx).options?.optionLists).toEqual(
        ["choices"]
      );
    }
  );

  test("the first question with nothing before it offers neither section a way in", () => {
    const sections = getQuestionShowIfSections(withoutHiddenFields(surveyFlowFixture), 0, 0);

    expect(sections.question).toEqual({ state: "unavailable" });
    expect(sections.options).toEqual({ state: "unavailable", optionLists: ["choices"] });
  });

  test("options already hidden or conditional stay editable even with nothing before them", () => {
    const survey = withoutHiddenFields(structuredClone(surveyFlowFixture));
    const services = survey.blocks[0].elements[0];
    if (!("choices" in services)) throw new Error("services has choices");
    services.choices[0] = { ...services.choices[0], hidden: true };

    expect(getQuestionShowIfSections(survey, 0, 0).options).toMatchObject({ state: "set", hiddenCount: 1 });
  });

  test("an option show-if the conditions editor can't show makes the options section read-only", () => {
    const survey = structuredClone(surveyFlowFixture);
    const elementIdx = elementIdxOf(survey, 4, "fav");
    const fav = survey.blocks[4].elements[elementIdx];
    if (!("choices" in fav)) throw new Error("fav has choices");
    fav.choices[0] = { ...fav.choices[0], showIf: unsupportedGroup() };

    expect(getQuestionShowIfSections(survey, 4, elementIdx).options).toMatchObject({
      state: "set",
      editable: false,
    });
  });

  test("a question that's gone shows nothing", () => {
    expect(getQuestionShowIfSections(surveyFlowFixture, 4, 99)).toEqual({
      question: { state: "unavailable" },
      options: null,
    });
  });
});
