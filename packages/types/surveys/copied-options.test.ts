import { describe, expect, test } from "vitest";
import {
  copyOptionsFrom,
  getCopiedOptionIds,
  getOptionsCopiedFrom,
  getPickedInSourceShowIf,
  withoutOptionsCopiedFrom,
} from "./copied-options";
import { fillMissingCodes } from "./fill-missing-codes";
import { surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * Copied options (ENG-6938, json-shapes §3, decision A / P18, T26): a question copies an earlier
 * question's options, keeping their option ids and answer codes, and each copied option carries an
 * ordinary show-if "picked in the source".
 *
 * Fixture blocks: 0 services (`services`, multi select), 4 overall (`fav` single select,
 * `apple_reason` open text, …), 5 profile (…, `brand_rank` 3, `ad_pick` picture 4, …, `recommend` 12,
 * which copies from `services`).
 */

type TElementRecord = Record<string, unknown>;

const withSurvey = (patch: (survey: TSurvey) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  patch(survey);
  return survey;
};

const element = (survey: TSurvey, blockIdx: number, elementIdx: number) =>
  survey.blocks[blockIdx].elements[elementIdx] as unknown as TElementRecord;

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));

const COPIED_FROM = (blockIdx: number, elementIdx: number) => [
  "blocks",
  blockIdx,
  "elements",
  elementIdx,
  "optionsCopiedFrom",
];

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return `copiedid${String(sequence).padStart(16, "0")}`;
};

describe("copied options in the fixture survey", () => {
  test("a question copies its options from an earlier one and the survey stays valid", () => {
    const recommend = element(surveyFlowFixture, 5, 12);

    expect(recommend.optionsCopiedFrom).toBe("services");
    expect([...getCopiedOptionIds(element(surveyFlowFixture, 0, 0), recommend)]).toEqual([
      "netflix",
      "disney",
      "prime",
      "apple",
    ]);
    expect(issuesOf(surveyFlowFixture)).toEqual([]);
  });
});

describe("the copied-options source", () => {
  test("must exist", () => {
    const survey = withSurvey((draft) => {
      element(draft, 5, 12).optionsCopiedFrom = "gone";
    });

    expect(issuesOf(survey)).toEqual([
      {
        path: COPIED_FROM(5, 12),
        message:
          'Copied options: question 13 of block 6 copies its options from "gone", which does not exist',
      },
    ]);
  });

  test("may not be the question itself", () => {
    const survey = withSurvey((draft) => {
      element(draft, 5, 12).optionsCopiedFrom = "recommend";
    });

    expect(issuesOf(survey).map((issue) => issue.path)).toEqual([COPIED_FROM(5, 12)]);
  });

  test("must come earlier: a later block or below on the same page is refused", () => {
    const survey = withSurvey((draft) => {
      element(draft, 4, 0).optionsCopiedFrom = "recommend";
      element(draft, 5, 3).optionsCopiedFrom = "recommend";
    });

    expect(issuesOf(survey)).toEqual([
      {
        path: COPIED_FROM(4, 0),
        message:
          'Copied options: question 1 of block 5 copies its options from "recommend", which is not above it. Options can be copied from earlier blocks and from questions above it on the same page',
      },
      expect.objectContaining({ path: COPIED_FROM(5, 3) }),
    ]);
  });

  test("may sit above the question on the same page", () => {
    const survey = withSurvey((draft) => {
      element(draft, 5, 12).optionsCopiedFrom = "brand_rank";
    });

    expect(issuesOf(survey)).toEqual([]);
  });

  test("must have options of a compatible kind: choices from choices, pictures from pictures", () => {
    const survey = withSurvey((draft) => {
      element(draft, 5, 12).optionsCopiedFrom = "ad_pick";
      element(draft, 5, 4).optionsCopiedFrom = "services";
      element(draft, 4, 2).optionsCopiedFrom = "apple_reason";
    });

    expect(issuesOf(survey)).toEqual([
      {
        path: COPIED_FROM(4, 2),
        message:
          'Copied options: question 3 of block 5 copies its options from "apple_reason", which has no options to copy',
      },
      {
        path: COPIED_FROM(5, 4),
        message:
          'Copied options: question 5 of block 6 copies its options from "services", but pictures can only be copied from a picture selection',
      },
      {
        path: COPIED_FROM(5, 12),
        message:
          'Copied options: question 13 of block 6 copies its options from "ad_pick", but choices can only be copied from a single select, multi select or ranking',
      },
    ]);
  });
});

const sourceMulti = {
  id: "brands",
  type: "multipleChoiceMulti",
  choices: [
    { id: "acme", label: { default: "Acme", de: "Acme DE" }, code: "1" },
    { id: "globex", label: { default: "Globex", de: "Globex DE" }, code: "2", hidden: true },
    { id: "other", label: { default: "Other" }, code: "3" },
    { id: "none", label: { default: "None" }, code: "4" },
  ],
};

const anyId: unknown = expect.any(String);
const pickedIn = (operator: string, value: string | string[]) => ({
  id: anyId,
  connector: "and",
  conditions: [
    {
      id: anyId,
      leftOperand: { type: "element", value: "brands" },
      operator,
      rightOperand: { type: "static", value },
    },
  ],
});

describe("copying options", () => {
  test("gives the target the source's options with their ids, codes and a picked-in-source show-if", () => {
    const target = { id: "fav_brand", type: "multipleChoiceSingle", choices: [] };

    expect(copyOptionsFrom(sourceMulti, target, { createId: nextId })).toEqual([
      {
        id: "acme",
        label: { default: "Acme", de: "Acme DE" },
        code: "1",
        showIf: pickedIn("includesOneOf", ["acme"]),
      },
      {
        id: "globex",
        label: { default: "Globex", de: "Globex DE" },
        code: "2",
        showIf: pickedIn("includesOneOf", ["globex"]),
      },
    ]);
  });

  test("a single-select source is matched with equals, a ranking with includes", () => {
    expect(getPickedInSourceShowIf({ id: "brands", type: "multipleChoiceSingle" }, "acme", nextId)).toEqual(
      pickedIn("equals", "acme")
    );
    expect(getPickedInSourceShowIf({ id: "brands", type: "ranking" }, "acme", nextId)).toEqual(
      pickedIn("includesOneOf", ["acme"])
    );
  });

  test("pictures copy their image and alt text", () => {
    const pictures = {
      id: "brands",
      type: "pictureSelection",
      choices: [
        { id: "p1", code: "1", imageUrl: "https://example.com/1.png", imageAltText: { default: "One" } },
        { id: "p2", code: "2", imageUrl: "https://example.com/2.png" },
      ],
    };
    const target = { id: "pick", type: "pictureSelection", choices: [] };

    expect(copyOptionsFrom(pictures, target, { createId: nextId })).toEqual([
      {
        id: "p1",
        code: "1",
        imageUrl: "https://example.com/1.png",
        imageAltText: { default: "One" },
        showIf: pickedIn("includesOneOf", ["p1"]),
      },
      {
        id: "p2",
        code: "2",
        imageUrl: "https://example.com/2.png",
        showIf: pickedIn("includesOneOf", ["p2"]),
      },
    ]);
  });

  test("keeps fixed options after the copies, and drops the target's own options a first copy replaces", () => {
    const target = {
      id: "fav_brand",
      type: "multipleChoiceMulti",
      choices: [
        { id: "draft1", label: { default: "Option 1" } },
        { id: "launched", label: { default: "Kept at launch" }, code: "7" },
        { id: "none", label: { default: "None of these" }, code: "9" },
      ],
    };

    const ids = copyOptionsFrom(sourceMulti, target, {
      createId: nextId,
      keepOptionId: (id) => id === "launched",
    }).map((option) => option.id);

    expect(ids).toEqual(["acme", "globex", "launched", "none"]);
  });

  test("copy again adds options the source gained, keeps the target's Hidden flag, and refreshes the rest", () => {
    const linked = {
      id: "fav_brand",
      type: "multipleChoiceMulti",
      optionsCopiedFrom: "brands",
      choices: [
        {
          id: "acme",
          label: { default: "Old Acme" },
          code: "1",
          hidden: true,
          showIf: getPickedInSourceShowIf(sourceMulti, "acme", nextId),
        },
        { id: "none", label: { default: "None of these" }, code: "9" },
      ],
    };

    const copied = copyOptionsFrom(sourceMulti, linked, { createId: nextId });

    expect(
      copied.map((option) => [option.id, option.code, (option.label as { default: string }).default])
    ).toEqual([
      ["acme", "1", "Acme"],
      ["globex", "2", "Globex"],
      ["none", "9", "None of these"],
    ]);
    expect(copied[0].hidden).toBe(true);
    expect(copied[0].showIf).toEqual(linked.choices[0].showIf);
  });
});

describe("codes of copied options", () => {
  const blocksWith = (target: TElementRecord, source: TElementRecord = sourceMulti) => [
    { id: "b1", elements: [{ ...source, code: "brands" }] },
    { id: "b2", elements: [{ code: "fav_brand", ...target }] },
  ];
  const codesOf = (blocks: { elements: TElementRecord[] }[], blockIdx: number) =>
    (blocks[blockIdx].elements[0].choices as { id: string; code?: string }[]).map((option) => [
      option.id,
      option.code,
    ]);

  test("copied options take the source's code, even one typed over in the target", () => {
    const blocks = fillMissingCodes(
      blocksWith({
        id: "fav_brand",
        type: "multipleChoiceMulti",
        optionsCopiedFrom: "brands",
        choices: [
          { id: "acme", label: { default: "Acme" } },
          { id: "globex", label: { default: "Globex" }, code: "77" },
        ],
      }),
      []
    );

    expect(codesOf(blocks, 1)).toEqual([
      ["acme", "1"],
      ["globex", "2"],
    ]);
  });

  test("a fixed option takes the next code free in both questions, and the source's next one skips it", () => {
    const filled = fillMissingCodes(
      blocksWith({
        id: "fav_brand",
        type: "multipleChoiceMulti",
        optionsCopiedFrom: "brands",
        choices: [
          { id: "acme", label: { default: "Acme" }, code: "1" },
          { id: "dontknow", label: { default: "Don't know" } },
        ],
      }),
      []
    );
    expect(codesOf(filled, 1)).toEqual([
      ["acme", "1"],
      ["dontknow", "5"],
    ]);

    // The source gains an option: it must not take 5, which "Don't know" holds in the copy.
    const sourceElement = filled[0].elements[0] as TElementRecord;
    const grown = [
      {
        ...filled[0],
        elements: [
          {
            ...sourceElement,
            choices: [
              ...(sourceElement.choices as unknown[]),
              { id: "initech", label: { default: "Initech" } },
            ],
          },
        ],
      },
      filled[1],
    ];
    const grownCodes = codesOf(fillMissingCodes(grown, []), 0);
    expect(grownCodes[grownCodes.length - 1]).toEqual(["initech", "6"]);
  });

  test("a new source option takes the lowest code free in every linked question, not the highest plus one", () => {
    // The copy's fixed "None of these" holds 99. The source's next option is the lowest number free in
    // both questions (ENG-4024), not 100.
    const sourceCodes = codesOf(blocksWith({}), 0);
    const nextFree = sourceCodes.length + 1;
    const blocks = fillMissingCodes(
      blocksWith(
        {
          id: "fav_brand",
          type: "multipleChoiceMulti",
          optionsCopiedFrom: "brands",
          choices: [{ id: "none", label: { default: "None of these" }, code: "99" }],
        },
        {
          ...sourceMulti,
          choices: [...(sourceMulti.choices as unknown[]), { id: "initech", label: { default: "Initech" } }],
        }
      ),
      []
    );

    const filledSource = codesOf(blocks, 0);
    expect(filledSource[filledSource.length - 1]).toEqual(["initech", String(nextFree)]);
    expect(codesOf(blocks, 1)).toEqual([["none", "99"]]);
  });

  test("codes travel through every hop", () => {
    const blocks = fillMissingCodes(
      [
        ...blocksWith(
          {
            id: "fav_brand",
            type: "multipleChoiceMulti",
            optionsCopiedFrom: "brands",
            choices: [{ id: "acme", label: { default: "Acme" } }],
          },
          { ...sourceMulti, choices: [{ id: "acme", label: { default: "Acme" }, code: "7" }] }
        ),
        {
          id: "b3",
          elements: [
            {
              id: "rank_brand",
              type: "ranking",
              optionsCopiedFrom: "fav_brand",
              choices: [{ id: "acme", label: { default: "Acme" } }],
            },
          ],
        },
      ],
      []
    );

    expect(codesOf(blocks, 2)).toEqual([["acme", "7"]]);
  });
});

describe("typed access to optionsCopiedFrom", () => {
  test("reads the link off any element, and drops it without touching the rest", () => {
    const linked = { id: "fav", type: "multipleChoiceSingle", optionsCopiedFrom: "services" };
    expect(getOptionsCopiedFrom(linked)).toBe("services");
    expect(getOptionsCopiedFrom({ id: "q", type: "openText" })).toBeUndefined();
    expect(getOptionsCopiedFrom(undefined)).toBeUndefined();
    expect(withoutOptionsCopiedFrom(linked)).toEqual({ id: "fav", type: "multipleChoiceSingle" });
    const plain = { id: "q", type: "openText" };
    expect(withoutOptionsCopiedFrom(plain)).toBe(plain);
  });
});
