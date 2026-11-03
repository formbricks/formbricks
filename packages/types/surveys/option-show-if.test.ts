import { describe, expect, test } from "vitest";
import type { TConditionGroup } from "./logic";
import { SURVEY_FLOW_FIXTURE_IDS as ids, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * Option show-if and Hidden (ENG-6937, json-shapes §2): the reference rule an option, a matrix row and
 * a matrix column follow is their element's (earlier blocks plus questions above the element on its
 * page), reported at the exact path of the offending condition.
 *
 * Fixture blocks: 0 services (`services`), 1 ratings, 2 heavy users (`hours`), 3 concept, 4 overall
 * (`fav`, `apple_reason`, `bundle`, `email`), 5 profile (`csat`, `ces`, `brand_grid`, `brand_rank`,
 * `ad_pick`, …).
 */

const submitted = (elementId: string): TConditionGroup => ({
  id: "optshowifgroup0000000001",
  connector: "and",
  conditions: [
    {
      id: "optshowifcond00000000001",
      leftOperand: { type: "element", value: elementId },
      operator: "isSubmitted",
    },
  ],
});

const withSurvey = (patch: (survey: TSurvey) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  patch(survey);
  return survey;
};

const issuePaths = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map((issue) => issue.path);

const element = <T>(survey: TSurvey, blockIdx: number, elementIdx: number) =>
  survey.blocks[blockIdx].elements[elementIdx] as T;

type TWithChoices = { choices: { showIf?: TConditionGroup; hidden?: boolean }[] };
type TWithMatrix = {
  rows: { showIf?: TConditionGroup; hidden?: boolean }[];
  columns: { showIf?: TConditionGroup; hidden?: boolean }[];
};

describe("option show-if in the fixture survey", () => {
  test("holds option show-if and Hidden on every kind of option, and stays valid", () => {
    const options = surveyFlowFixture.blocks.flatMap((block) =>
      block.elements.flatMap((el) => {
        const record = el as unknown as Record<string, unknown>;
        return ["choices", "rows", "columns"].flatMap((key) =>
          Array.isArray(record[key]) ? (record[key] as { showIf?: unknown; hidden?: boolean }[]) : []
        );
      })
    );

    expect(options.some((option) => option.showIf)).toBe(true);
    expect(options.some((option) => option.hidden === true)).toBe(true);
    expect(ZSurvey.safeParse(surveyFlowFixture).error?.issues ?? []).toEqual([]);
  });
});

describe("the option show-if reference rule", () => {
  test("an option may use an earlier block and a question above its question on the page", () => {
    const survey = withSurvey((draft) => {
      element<TWithChoices>(draft, 4, 2).choices[0].showIf = submitted("fav");
      element<TWithChoices>(draft, 4, 2).choices[1].showIf = submitted("hours");
    });

    expect(issuePaths(survey)).toEqual([]);
  });

  test("an option may not use its own question", () => {
    const survey = withSurvey((draft) => {
      element<TWithChoices>(draft, 4, 2).choices[1].showIf = submitted("bundle");
    });
    const issues = ZSurvey.safeParse(survey).error?.issues ?? [];

    expect(issues.map((issue) => issue.path)).toEqual([
      ["blocks", 4, "elements", 2, "choices", 1, "showIf", "conditions", 0],
    ]);
    expect(issues[0].message).toContain("itself");
  });

  test("an option may not use a question below its question on the page", () => {
    const survey = withSurvey((draft) => {
      element<TWithChoices>(draft, 4, 0).choices[0].showIf = submitted("email");
    });

    expect(issuePaths(survey)).toEqual([
      ["blocks", 4, "elements", 0, "choices", 0, "showIf", "conditions", 0],
    ]);
  });

  test("an option may not use a later block", () => {
    const survey = withSurvey((draft) => {
      element<TWithChoices>(draft, 0, 0).choices[2].showIf = submitted("hours");
    });

    expect(issuePaths(survey)).toEqual([
      ["blocks", 0, "elements", 0, "choices", 2, "showIf", "conditions", 0],
    ]);
  });

  test("matrix rows and columns follow the rule, each at its own path", () => {
    const survey = withSurvey((draft) => {
      element<TWithMatrix>(draft, 5, 2).rows[0].showIf = submitted("ad_pick");
      element<TWithMatrix>(draft, 5, 2).columns[1].showIf = submitted("brand_rank");
    });

    expect(issuePaths(survey)).toEqual([
      ["blocks", 5, "elements", 2, "rows", 0, "showIf", "conditions", 0],
      ["blocks", 5, "elements", 2, "columns", 1, "showIf", "conditions", 0],
    ]);
  });

  test("picture choices and ranking options follow the rule", () => {
    const survey = withSurvey((draft) => {
      element<TWithChoices>(draft, 5, 3).choices[0].showIf = submitted("ad_pick");
      element<TWithChoices>(draft, 5, 4).choices[0].showIf = submitted("ad_pick");
    });

    expect(issuePaths(survey)).toEqual([
      ["blocks", 5, "elements", 3, "choices", 0, "showIf", "conditions", 0],
      ["blocks", 5, "elements", 4, "choices", 0, "showIf", "conditions", 0],
    ]);
  });

  test("the operand checks of logic apply, at the option's show-if", () => {
    const survey = withSurvey((draft) => {
      element<TWithChoices>(draft, 4, 2).choices[0].showIf = submitted("no_such_question");
      element<TWithChoices>(draft, 4, 2).choices[1].showIf = {
        id: "optshowifgroup0000000002",
        connector: "and",
        conditions: [
          {
            id: "optshowifcond00000000002",
            leftOperand: { type: "variable", value: ids.variables.score },
            operator: "isGreaterThan",
            rightOperand: { type: "static", value: 3 },
          },
        ],
      };
    });

    expect(issuePaths(survey)).toEqual([["blocks", 4, "elements", 2, "choices", 0, "showIf"]]);
  });

  test("the reserved options `other` and `none` may carry a show-if and be Hidden", () => {
    const survey = withSurvey((draft) => {
      const services = element<{ choices: { id: string; label: unknown; hidden?: boolean }[] }>(draft, 0, 0);
      services.choices.push(
        { id: "other", label: { default: "Other" }, hidden: true },
        { id: "none", label: { default: "None of these" } }
      );
      element<TWithChoices>(draft, 4, 0).choices.push({
        id: "other",
        label: { default: "Other" },
        showIf: submitted("services"),
      } as never);
    });

    expect(issuePaths(survey)).toEqual([]);
  });
});

describe("ranking conditions on options (T21)", () => {
  test("a ranking may be compared with its options: 'show a brand only if it was ranked'", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[5].elements[4].showIf = {
        id: "optshowifgroup0000000003",
        connector: "and",
        conditions: [
          {
            id: "optshowifcond00000000003",
            leftOperand: { type: "element", value: "brand_rank" },
            operator: "includesOneOf",
            rightOperand: { type: "static", value: ["netflix"] },
          },
        ],
      };
    });

    expect(issuePaths(survey)).toEqual([]);
  });
});
