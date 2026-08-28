import { describe, expect, test } from "vitest";
import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import { EMPTY_AI_DRAFT, groupAiDraftByBlock, mergeAiDraftSnapshot } from "./ai-draft-reducer";

const snapshot = (questions: unknown[], name?: string): TSurveyGenerationDraftSnapshot =>
  ({ name, blocks: [{ name: "Block", questions }] }) as TSurveyGenerationDraftSnapshot;

describe("mergeAiDraftSnapshot", () => {
  test("adds a row as soon as the model commits to a type", () => {
    const state = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, snapshot([{ type: "openText" }]));

    expect(state.questions).toHaveLength(1);
    expect(state.questions[0]).toMatchObject({ key: "0:0", type: "openText" });
  });

  test("ignores a question with neither type nor headline", () => {
    // Nothing to show yet; a placeholder row would appear and then jump.
    expect(mergeAiDraftSnapshot(EMPTY_AI_DRAFT, snapshot([{}])).questions).toHaveLength(0);
  });

  test("fills in a headline as it streams", () => {
    const first = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, snapshot([{ type: "openText", headline: "How " }]));
    const second = mergeAiDraftSnapshot(first, snapshot([{ type: "openText", headline: "How was it?" }]));

    expect(second.questions[0].headline).toBe("How was it?");
  });

  test("records the option count once choices arrive", () => {
    const state = mergeAiDraftSnapshot(
      EMPTY_AI_DRAFT,
      snapshot([{ type: "multipleChoiceSingle", headline: "Pick", choices: ["a", "b", "c"] }])
    );

    expect(state.questions[0].choiceCount).toBe(3);
  });

  test("never shrinks when a snapshot arrives with fewer questions", () => {
    const two = mergeAiDraftSnapshot(
      EMPTY_AI_DRAFT,
      snapshot([
        { type: "openText", headline: "One" },
        { type: "openText", headline: "Two" },
      ])
    );

    const after = mergeAiDraftSnapshot(two, snapshot([{ type: "openText", headline: "One" }]));

    expect(after.questions).toHaveLength(2);
    expect(after.questions[1].headline).toBe("Two");
  });

  test("never clears a field that a later snapshot blanked", () => {
    const withHeadline = mergeAiDraftSnapshot(
      EMPTY_AI_DRAFT,
      snapshot([{ type: "openText", headline: "How was it?" }])
    );

    const after = mergeAiDraftSnapshot(withHeadline, snapshot([{ type: "openText" }]));

    expect(after.questions[0].headline).toBe("How was it?");
  });

  test("returns the identical object reference for an unchanged question", () => {
    // The memo contract. Losing this makes every row re-render several times a second.
    const first = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, snapshot([{ type: "openText", headline: "One" }]));
    const second = mergeAiDraftSnapshot(
      first,
      snapshot([
        { type: "openText", headline: "One" },
        { type: "rating", headline: "Two" },
      ])
    );

    expect(second.questions[0]).toBe(first.questions[0]);
    expect(second.questions[1]).not.toBe(first.questions[0]);
  });

  test("returns the identical state when the snapshot changed nothing", () => {
    const first = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, snapshot([{ type: "openText", headline: "One" }]));
    const second = mergeAiDraftSnapshot(first, snapshot([{ type: "openText", headline: "One" }]));

    expect(second).toBe(first);
  });

  test("keeps keys stable across blocks so rows never re-mount", () => {
    const state = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, {
      blocks: [
        { name: "A", questions: [{ type: "openText", headline: "One" }] },
        { name: "B", questions: [{ type: "rating", headline: "Two" }] },
      ],
    } as TSurveyGenerationDraftSnapshot);

    expect(state.questions.map((question) => question.key)).toEqual(["0:0", "1:0"]);
  });

  test("picks up the survey name once it lands", () => {
    const state = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, snapshot([{ type: "openText" }], "Onboarding"));

    expect(state.name).toBe("Onboarding");
  });
});

describe("mergeAiDraftSnapshot — keyed matching", () => {
  test("a question filled in later does not duplicate a key", () => {
    // The model can leave question 0 untouched while writing question 1, so the flattened array
    // shifts. Matching by index would align "0:1" with "0:0" and emit "0:1" twice, which React
    // renders as duplicate keys and a shuffled list.
    const secondOnly = mergeAiDraftSnapshot(
      EMPTY_AI_DRAFT,
      snapshot([{}, { type: "rating", headline: "Second" }])
    );
    expect(secondOnly.questions.map((question) => question.key)).toEqual(["0:1"]);

    const bothPresent = mergeAiDraftSnapshot(
      secondOnly,
      snapshot([
        { type: "openText", headline: "First" },
        { type: "rating", headline: "Second" },
      ])
    );

    const keys = bothPresent.questions.map((question) => question.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("0:0");
    expect(keys).toContain("0:1");
    expect(bothPresent.questions.find((q) => q.key === "0:0")?.headline).toBe("First");
    expect(bothPresent.questions.find((q) => q.key === "0:1")?.headline).toBe("Second");
  });

  test("keeps identity for an untouched question when another one fills in", () => {
    const first = mergeAiDraftSnapshot(
      EMPTY_AI_DRAFT,
      snapshot([{}, { type: "rating", headline: "Second" }])
    );
    const second = mergeAiDraftSnapshot(
      first,
      snapshot([
        { type: "openText", headline: "First" },
        { type: "rating", headline: "Second" },
      ])
    );

    expect(second.questions.find((q) => q.key === "0:1")).toBe(first.questions[0]);
  });
});

describe("block structure", () => {
  const twoBlocks = {
    name: "Onboarding",
    blocks: [
      { name: "Signup", questions: [{ type: "openText", headline: "How was signup?" }] },
      {
        name: "Setup",
        questions: [
          { type: "rating", headline: "Rate setup" },
          { type: "openText", headline: "Anything else?" },
        ],
      },
    ],
  } as TSurveyGenerationDraftSnapshot;

  test("keeps the name the model gave each block", () => {
    // The prompt asks for "a short, meaningful name" per block; flattening threw that away.
    const state = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, twoBlocks);

    expect(state.questions.map((q) => q.blockName)).toEqual(["Signup", "Setup", "Setup"]);
  });

  test("groups the flat rows back into the blocks, in order", () => {
    const state = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, twoBlocks);

    const blocks = groupAiDraftByBlock(state.questions);

    expect(blocks.map((b) => [b.name, b.questions.length])).toEqual([
      ["Signup", 1],
      ["Setup", 2],
    ]);
  });

  test("a block name that streams in later still lands on its questions", () => {
    const unnamed = mergeAiDraftSnapshot(EMPTY_AI_DRAFT, {
      blocks: [{ questions: [{ type: "openText", headline: "How was signup?" }] }],
    } as TSurveyGenerationDraftSnapshot);
    expect(unnamed.questions[0].blockName).toBeUndefined();

    const named = mergeAiDraftSnapshot(unnamed, {
      blocks: [{ name: "Signup", questions: [{ type: "openText", headline: "How was signup?" }] }],
    } as TSurveyGenerationDraftSnapshot);

    expect(named.questions[0].blockName).toBe("Signup");
  });

  test("survives an empty draft", () => {
    expect(groupAiDraftByBlock([])).toEqual([]);
  });
});
