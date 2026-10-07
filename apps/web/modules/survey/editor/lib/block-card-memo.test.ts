import { describe, expect, test } from "vitest";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { updateElementInBlock } from "@/modules/survey/editor/lib/blocks";
import { TBlockCardMemoProps, areBlockCardPropsEqual, getReferencedElementIds } from "./block-card-memo";

const element = (id: string, headline: string) => ({
  id,
  type: "openText",
  headline: { default: headline },
  required: true,
});

const block = (id: string, elements: ReturnType<typeof element>[], extra: Record<string, unknown> = {}) =>
  ({ id, name: `Block ${id}`, elements, ...extra }) as unknown as TSurveyBlock;

const logicOn = (elementId: string) => [
  {
    id: "logic1",
    conditions: {
      id: "group1",
      connector: "and",
      conditions: [
        { id: "cond1", leftOperand: { type: "element", value: elementId }, operator: "isSubmitted" },
      ],
    },
    actions: [{ id: "action1", objective: "jumpToBlock", target: "c" }],
  },
];

const makeSurvey = (blocks: TSurveyBlock[], endings: unknown[] = []) =>
  ({
    id: "survey",
    languages: [],
    variables: [],
    hiddenFields: { enabled: true },
    endings,
    blocks,
  }) as unknown as TSurvey;

const onInteract = () => undefined;

const propsFor = (
  survey: TSurvey,
  blockId: string,
  overrides: Partial<TBlockCardMemoProps & { onInteract: () => void }> = {}
) => ({
  localSurvey: survey,
  block: survey.blocks.find((b) => b.id === blockId) as TSurveyBlock,
  activeElementId: null,
  invalidElements: undefined,
  isLastInteracted: false,
  onInteract,
  ...overrides,
});

const typeHeadline = (survey: TSurvey, blockId: string, elementId: string, text: string): TSurvey => {
  const result = updateElementInBlock(survey, blockId, elementId, { headline: { default: text } });
  if (!result.ok) throw result.error;
  return result.data;
};

describe("areBlockCardPropsEqual", () => {
  const base = makeSurvey([
    block("a", [element("qa1", "Name?"), element("qa2", "Age?")]),
    block("b", [element("qb1", "Colour?")]),
    block("c", [element("qc1", "Why?")]),
  ]);

  test("skips a block when an unreferenced element in another block is edited", () => {
    const next = typeHeadline(base, "a", "qa1", "Name please?");

    expect(areBlockCardPropsEqual(propsFor(base, "b"), propsFor(next, "b"))).toBe(true);
  });

  test("re-renders the block whose element was edited", () => {
    const next = typeHeadline(base, "a", "qa1", "Name please?");

    expect(areBlockCardPropsEqual(propsFor(base, "a"), propsFor(next, "a"))).toBe(false);
  });

  test("re-renders a block whose logic references the edited element", () => {
    const survey = makeSurvey([
      base.blocks[0],
      block("b", [element("qb1", "Colour?")], { logic: logicOn("qa1") }),
    ]);
    const next = typeHeadline(survey, "a", "qa1", "Name please?");

    expect(areBlockCardPropsEqual(propsFor(survey, "b"), propsFor(next, "b"))).toBe(false);
  });

  test("re-renders a block that recalls the edited element, following recalls transitively", () => {
    const survey = makeSurvey([
      block("a", [element("qa1", "Name?"), element("qa2", "Hi #recall:qa1/fallback:you#")]),
      block("b", [element("qb1", "So #recall:qa2/fallback:x#, why?")]),
    ]);
    const next = typeHeadline(survey, "a", "qa1", "Full name?");

    expect(getReferencedElementIds(survey, survey.blocks[1])).toEqual(expect.arrayContaining(["qa1", "qa2"]));
    expect(areBlockCardPropsEqual(propsFor(survey, "b"), propsFor(next, "b"))).toBe(false);
  });

  test("re-renders every block when an ending card recalls the edited element", () => {
    const survey = makeSurvey(base.blocks, [
      { id: "end", headline: { default: "Thanks #recall:qa1/fallback:x#" } },
    ]);
    const next = typeHeadline(survey, "a", "qa1", "Name please?");

    expect(areBlockCardPropsEqual(propsFor(survey, "c"), propsFor(next, "c"))).toBe(false);
  });

  test("re-renders when survey-level data, block names or element order change", () => {
    const withVariable = { ...base, variables: [{ id: "v", name: "score", type: "number", value: 0 }] };
    const renamed = { ...base, blocks: [{ ...base.blocks[0], name: "Intro" }, ...base.blocks.slice(1)] };
    const reordered = {
      ...base,
      blocks: [
        { ...base.blocks[0], elements: [...base.blocks[0].elements].reverse() },
        ...base.blocks.slice(1),
      ],
    };

    for (const next of [withVariable, renamed, reordered] as TSurvey[]) {
      expect(areBlockCardPropsEqual(propsFor(base, "b"), propsFor(next, "b"))).toBe(false);
    }
  });

  test("re-renders the active and the last-interacted block on any survey change", () => {
    const next = typeHeadline(base, "a", "qa1", "Name please?");

    expect(
      areBlockCardPropsEqual(
        propsFor(base, "b", { activeElementId: "qb1" }),
        propsFor(next, "b", { activeElementId: "qb1" })
      )
    ).toBe(false);
    expect(
      areBlockCardPropsEqual(
        propsFor(base, "b", { isLastInteracted: true }),
        propsFor(next, "b", { isLastInteracted: true })
      )
    ).toBe(false);
  });

  test("re-renders only the blocks the active element moves between", () => {
    const from = { activeElementId: "qa1" };
    const to = { activeElementId: "qc1" };

    expect(areBlockCardPropsEqual(propsFor(base, "a", from), propsFor(base, "a", to))).toBe(false);
    expect(areBlockCardPropsEqual(propsFor(base, "c", from), propsFor(base, "c", to))).toBe(false);
    expect(areBlockCardPropsEqual(propsFor(base, "b", from), propsFor(base, "b", to))).toBe(true);
  });

  test("re-renders on the block's own invalid ids, including a repeated validation pass", () => {
    const unrelated = propsFor(base, "b", { invalidElements: ["qa1"] });

    expect(areBlockCardPropsEqual(propsFor(base, "b"), unrelated)).toBe(true);
    expect(areBlockCardPropsEqual(unrelated, propsFor(base, "b", { invalidElements: ["qa1", "qb1"] }))).toBe(
      false
    );
    expect(
      areBlockCardPropsEqual(
        propsFor(base, "b", { invalidElements: ["qb1"] }),
        propsFor(base, "b", { invalidElements: ["qb1"] })
      )
    ).toBe(false);
  });

  test("re-renders when any other prop changes identity", () => {
    expect(
      areBlockCardPropsEqual(propsFor(base, "b"), propsFor(base, "b", { onInteract: () => undefined }))
    ).toBe(false);
  });
});
