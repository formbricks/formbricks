import { describe, expect, test } from "vitest";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  copyOptionsAgain,
  countOptionsToCopyAgain,
  getCopiedOptionsSource,
  getCopySourceCandidates,
  linkCopiedOptions,
  unlinkCopiedOptions,
} from "./copied-options-editing";

/**
 * "Options copied from" on the Flow tab (ENG-6938). The fixture's blocks: 0 services (`services`,
 * multi select), 4 overall (`fav` single select, `apple_reason`, `bundle` single select, `email`),
 * 5 profile (…, `brand_rank` ranking 3, `ad_pick` picture 4, …, `recommend` 12, copied from services).
 */

type TChoice = {
  id: string;
  code?: string;
  label?: Record<string, string>;
  showIf?: unknown;
  hidden?: boolean;
};
type TRecord = Record<string, unknown> & { choices: TChoice[] };

let sequence = 0;
const createId = () => {
  sequence += 1;
  return `copyedit${String(sequence).padStart(16, "0")}`;
};

const elementAt = (survey: TSurvey, blockIdx: number, elementIdx: number) =>
  survey.blocks[blockIdx].elements[elementIdx] as unknown as TRecord;

const withServicesGaining = (choice: TChoice): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  elementAt(survey, 0, 0).choices.push(choice);
  return survey;
};

describe("which questions options can be copied from", () => {
  test("choice questions above it: earlier blocks and above it on the same page", () => {
    const ids = getCopySourceCandidates(surveyFlowFixture, { blockIdx: 5, elementIdx: 12 }).map((e) => e.id);

    expect(ids).toEqual(["services", "fav", "bundle", "brand_rank"]);
  });

  test("a picture question only copies from picture questions", () => {
    expect(getCopySourceCandidates(surveyFlowFixture, { blockIdx: 5, elementIdx: 4 })).toEqual([]);
  });
});

describe("linking and unlinking", () => {
  test("a first copy replaces the question's own options with the source's, each shown if picked there", () => {
    const survey = linkCopiedOptions(surveyFlowFixture, { blockIdx: 4, elementIdx: 2 }, "services", {
      createId,
    });
    const bundle = elementAt(survey, 4, 2);

    expect(bundle.optionsCopiedFrom).toBe("services");
    expect(bundle.choices.map((choice) => [choice.id, choice.code])).toEqual([
      ["netflix", "1"],
      ["disney", "2"],
      ["prime", "3"],
      ["apple", "4"],
    ]);
    expect(bundle.choices[0].showIf).toMatchObject({
      conditions: [
        {
          leftOperand: { type: "element", value: "services" },
          operator: "includesOneOf",
          rightOperand: { type: "static", value: ["netflix"] },
        },
      ],
    });
  });

  test("on a published survey, options that existed at launch stay as fixed options", () => {
    const survey = linkCopiedOptions(surveyFlowFixture, { blockIdx: 4, elementIdx: 2 }, "services", {
      createId,
      keepOptionId: (id) => id === "no_bundle",
    });

    expect(elementAt(survey, 4, 2).choices.map((choice) => choice.id)).toEqual([
      "netflix",
      "disney",
      "prime",
      "apple",
      "no_bundle",
    ]);
  });

  test("unlinking keeps the options and their show-if, and drops the link", () => {
    const survey = unlinkCopiedOptions(surveyFlowFixture, { blockIdx: 5, elementIdx: 12 });
    const recommend = elementAt(survey, 5, 12);

    expect("optionsCopiedFrom" in recommend).toBe(false);
    expect(recommend.choices).toEqual(elementAt(surveyFlowFixture, 5, 12).choices);
  });
});

describe("copy again", () => {
  const hulu: TChoice = { id: "hulu", code: "6", label: { default: "Hulu" } };

  test("counts the options the source gained since the last copy", () => {
    expect(countOptionsToCopyAgain(surveyFlowFixture, { blockIdx: 5, elementIdx: 12 })).toBe(0);
    expect(countOptionsToCopyAgain(withServicesGaining(hulu), { blockIdx: 5, elementIdx: 12 })).toBe(1);
  });

  test("brings them in with their ids and codes, before the fixed options", () => {
    const survey = copyOptionsAgain(withServicesGaining(hulu), { blockIdx: 5, elementIdx: 12 }, { createId });

    expect(elementAt(survey, 5, 12).choices.map((choice) => [choice.id, choice.code])).toEqual([
      ["netflix", "1"],
      ["disney", "2"],
      ["prime", "3"],
      ["apple", "4"],
      ["hulu", "6"],
      ["none", "5"],
    ]);
  });
});

describe("codes of copied options in the Recode section", () => {
  test("names the source and which options are copies", () => {
    const recommend = surveyFlowFixture.blocks[5].elements[12];
    const copied = getCopiedOptionsSource(surveyFlowFixture, recommend);

    expect(copied?.source.id).toBe("services");
    expect([...(copied?.copiedIds ?? [])]).toEqual(["netflix", "disney", "prime", "apple"]);
  });

  test("a question that copies nothing has no source", () => {
    expect(getCopiedOptionsSource(surveyFlowFixture, surveyFlowFixture.blocks[4].elements[0])).toBeNull();
  });
});
