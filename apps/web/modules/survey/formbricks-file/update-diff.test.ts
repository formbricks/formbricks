import { describe, expect, test } from "vitest";
import { getFormbricksFileRemovals } from "./update-diff";

/** A survey's stored blocks, as `TSurvey.blocks` holds them: texts under `default`. */
const storedBlocks = [
  {
    id: "block1",
    elements: [
      {
        id: "color",
        type: "multipleChoiceSingle",
        headline: { default: "<p>Which <b>color</b>?</p>", de: "Welche Farbe?" },
        choices: [
          { id: "red", label: { default: "Red" } },
          { id: "blue", label: { default: "Blue" } },
          { id: "green", label: { default: "Green" } },
        ],
      },
      {
        id: "grid",
        type: "matrix",
        headline: { default: "Rate these" },
        rows: [
          { id: "speed", label: { default: "Speed" } },
          { id: "price", label: { default: "Price" } },
        ],
        columns: [
          { id: "good", label: { default: "Good" } },
          { id: "bad", label: { default: "Bad" } },
        ],
      },
    ],
  },
  {
    id: "block2",
    elements: [
      {
        id: "feedback",
        type: "openText",
        headline: { default: "Anything else?" },
      },
      {
        id: "pick",
        type: "pictureSelection",
        headline: { default: "Pick one" },
        choices: [
          { id: "pic1", imageUrl: "https://example.com/1.png" },
          { id: "pic2", imageUrl: "https://example.com/2.png" },
        ],
      },
    ],
  },
];

/** The same survey as a Formbricks file's draft carries it: locale-keyed, in any block order. */
const draftBlocks = (blocks: unknown[]) => blocks;

describe("getFormbricksFileRemovals", () => {
  test("says nothing when the file keeps every question and option, wherever it moved them", () => {
    const moved = [
      {
        id: "other",
        elements: [
          { id: "pick", choices: [{ id: "pic2" }, { id: "pic1" }] },
          {
            id: "color",
            choices: [{ id: "green" }, { id: "red" }, { id: "blue" }, { id: "yellow" }],
          },
        ],
      },
      {
        id: "block1",
        elements: [
          { id: "feedback" },
          { id: "grid", rows: [{ id: "price" }, { id: "speed" }], columns: [{ id: "good" }, { id: "bad" }] },
        ],
      },
    ];

    expect(getFormbricksFileRemovals(storedBlocks, draftBlocks(moved))).toEqual([]);
  });

  test("warns once per question the file leaves out, named by its id and plain-text headline", () => {
    const withoutTwo = [
      {
        id: "block1",
        elements: [
          { id: "grid", rows: [{ id: "speed" }, { id: "price" }], columns: [{ id: "good" }, { id: "bad" }] },
          { id: "pick", choices: [{ id: "pic1" }, { id: "pic2" }] },
        ],
      },
    ];

    expect(getFormbricksFileRemovals(storedBlocks, draftBlocks(withoutTwo))).toEqual([
      {
        code: "question_removed",
        severity: "warning",
        questionTag: "color",
        params: { headline: "Which color?" },
      },
      {
        code: "question_removed",
        severity: "warning",
        questionTag: "feedback",
        params: { headline: "Anything else?" },
      },
    ]);
  });

  test("warns once per option, matrix row or column a kept question loses, and not for a removed question's", () => {
    const fewerOptions = [
      {
        id: "block1",
        elements: [
          { id: "color", choices: [{ id: "blue" }, { id: "yellow" }] },
          { id: "grid", rows: [{ id: "price" }], columns: [{ id: "bad" }] },
          { id: "pick", choices: [{ id: "pic1" }, { id: "pic3" }] },
        ],
      },
    ];

    expect(getFormbricksFileRemovals(storedBlocks, draftBlocks(fewerOptions))).toEqual([
      { code: "option_removed", severity: "warning", questionTag: "color", params: { option: "Red" } },
      { code: "option_removed", severity: "warning", questionTag: "color", params: { option: "Green" } },
      { code: "option_removed", severity: "warning", questionTag: "grid", params: { option: "Speed" } },
      { code: "option_removed", severity: "warning", questionTag: "grid", params: { option: "Good" } },
      {
        code: "question_removed",
        severity: "warning",
        questionTag: "feedback",
        params: { headline: "Anything else?" },
      },
      // A picture has no label: its id stands in.
      { code: "option_removed", severity: "warning", questionTag: "pick", params: { option: "pic2" } },
    ]);
  });

  test("reads a draft that is not the shape it expects as having none of the survey's content", () => {
    expect(getFormbricksFileRemovals(storedBlocks, "not blocks").map((issue) => issue.questionTag)).toEqual([
      "color",
      "grid",
      "feedback",
      "pick",
    ]);
  });
});
