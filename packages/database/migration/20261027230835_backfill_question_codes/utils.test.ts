import { describe, expect, test } from "vitest";
import { fillMissingCodes as sharedFillMissingCodes } from "@formbricks/types/surveys/fill-missing-codes";
import { type TSurveyCodesRow, fillMissingCodes, planSurveyCodes, takenNamesOf } from "./utils";

type El = Record<string, unknown> & { id: string; type: string };
const block = (id: string, ...elements: El[]) => ({ id, name: id, elements });
const open = (id: string, extra: Record<string, unknown> = {}): El => ({ id, type: "openText", ...extra });
const opt = (id: string, code?: string) => ({ id, label: { default: id }, ...(code ? { code } : {}) });
const pic = (id: string, code?: string) => ({
  id,
  imageUrl: `https://x/${id}.png`,
  ...(code ? { code } : {}),
});
const single = (id: string, choices: ReturnType<typeof opt>[], extra: Record<string, unknown> = {}): El => ({
  id,
  type: "multipleChoiceSingle",
  choices,
  ...extra,
});

const row = (overrides: Partial<TSurveyCodesRow> = {}): TSurveyCodesRow => ({
  id: "srv_1",
  updatedAt: "2026-01-01 00:00:00.000",
  blocks: [],
  questions: [],
  variables: [],
  hiddenFields: { enabled: false },
  linkedNames: null,
  ...overrides,
});

const elementsOf = (blocks: unknown[]) =>
  (blocks as { elements: Record<string, unknown>[] }[]).flatMap((b) => b.elements);
const codesOf = (blocks: unknown[]) => elementsOf(blocks).map((e) => e.code);
const optionCodes = (element: Record<string, unknown>, key = "choices") =>
  (element[key] as { code?: string }[]).map((o) => o.code);

const updated = (plan: ReturnType<typeof planSurveyCodes>) => {
  if (plan.status !== "update") throw new Error("expected an update");
  return plan;
};

describe("planSurveyCodes: blocks-shaped surveys", () => {
  test("codes an uncoded survey q1..qn in block order, then element order", () => {
    const plan = updated(
      planSurveyCodes(row({ blocks: [block("b1", open("a"), open("b")), block("b2", open("c"))] }))
    );
    expect(plan.column).toBe("blocks");
    expect(codesOf(plan.value)).toEqual(["q1", "q2", "q3"]);
  });

  test("fills only what is missing in a partially coded survey and never renumbers", () => {
    const plan = updated(
      planSurveyCodes(
        row({
          blocks: [
            block(
              "b1",
              open("a", { code: "age" }),
              single("b", [opt("x", "7"), opt("y"), opt("z")], { code: "q3" }),
              open("c")
            ),
          ],
        })
      )
    );
    const [a, b, c] = elementsOf(plan.value);
    expect(a.code).toBe("age");
    expect(b.code).toBe("q3");
    expect(optionCodes(b)).toEqual(["7", "8", "9"]);
    expect(c.code).toBe("q4");
  });

  test("a survey that is fully coded is unchanged", () => {
    const blocks = [block("b1", open("a", { code: "q1" }), single("b", [opt("x", "1")], { code: "q2" }))];
    expect(planSurveyCodes(row({ blocks }))).toEqual({ status: "unchanged" });
  });

  test("a survey without questions is unchanged", () => {
    expect(planSurveyCodes(row())).toEqual({ status: "unchanged" });
    expect(planSurveyCodes(row({ blocks: [block("b1")] }))).toEqual({ status: "unchanged" });
  });

  test("a CTA gets no code and takes no q number", () => {
    const plan = updated(
      planSurveyCodes(row({ blocks: [block("b1", { id: "c", type: "cta" }, open("a"))] }))
    );
    const [cta, a] = elementsOf(plan.value);
    expect(cta).not.toHaveProperty("code");
    expect(a.code).toBe("q1");
  });

  test("a CTA without a code does not make a coded survey change", () => {
    const blocks = [block("b1", { id: "c", type: "cta" }, open("a", { code: "q1" }))];
    expect(planSurveyCodes(row({ blocks }))).toEqual({ status: "unchanged" });
  });

  test("single and multi choice get 1..n by position, other and none last", () => {
    const choices = [opt("a"), opt("b"), opt("other"), opt("none")];
    const plan = updated(
      planSurveyCodes(
        row({
          blocks: [
            block("b1", single("q", choices), { ...single("m", choices), type: "multipleChoiceMulti" }),
          ],
        })
      )
    );
    for (const element of elementsOf(plan.value)) expect(optionCodes(element)).toEqual(["1", "2", "3", "4"]);
  });

  test("ranking gets answer codes by position", () => {
    const plan = updated(
      planSurveyCodes(
        row({ blocks: [block("b1", { id: "r", type: "ranking", choices: [opt("a"), opt("b"), opt("c")] })] })
      )
    );
    expect(optionCodes(elementsOf(plan.value)[0])).toEqual(["1", "2", "3"]);
  });

  test("picture selection codes its picture choices", () => {
    const plan = updated(
      planSurveyCodes(
        row({ blocks: [block("b1", { id: "p", type: "pictureSelection", choices: [pic("a"), pic("b")] })] })
      )
    );
    expect(optionCodes(elementsOf(plan.value)[0])).toEqual(["1", "2"]);
  });

  test("matrix rows and columns are separate lists, each 1..n", () => {
    const plan = updated(
      planSurveyCodes(
        row({
          blocks: [
            block("b1", {
              id: "m",
              type: "matrix",
              rows: [opt("r1"), opt("r2"), opt("r3")],
              columns: [opt("c1"), opt("c2")],
            }),
          ],
        })
      )
    );
    const [matrix] = elementsOf(plan.value);
    expect(optionCodes(matrix, "rows")).toEqual(["1", "2", "3"]);
    expect(optionCodes(matrix, "columns")).toEqual(["1", "2"]);
  });

  test("an element without choices (nps, rating, empty choice list) only gets a question code", () => {
    const plan = updated(
      planSurveyCodes(
        row({
          blocks: [
            block("b1", { id: "n", type: "nps" }, { id: "r", type: "rating", range: 5 }, single("empty", [])),
          ],
        })
      )
    );
    const [nps, rating, empty] = elementsOf(plan.value);
    expect([nps.code, rating.code, empty.code]).toEqual(["q1", "q2", "q3"]);
    expect(nps).not.toHaveProperty("choices");
    expect(empty.choices).toEqual([]);
  });

  test("a question with answer codes already but no question code only gets the question code", () => {
    const plan = updated(
      planSurveyCodes(row({ blocks: [block("b1", single("a", [opt("x", "1"), opt("y", "2")]))] }))
    );
    expect(codesOf(plan.value)).toEqual(["q1"]);
    expect(optionCodes(elementsOf(plan.value)[0])).toEqual(["1", "2"]);
  });

  test("an option list that is only missing answer codes is still planned", () => {
    const plan = updated(
      planSurveyCodes(row({ blocks: [block("b1", single("a", [opt("x", "1"), opt("y")], { code: "q1" }))] }))
    );
    expect(optionCodes(elementsOf(plan.value)[0])).toEqual(["1", "2"]);
  });

  test("keeps every other property of blocks and elements untouched", () => {
    const original = block("b1", open("a", { headline: { default: "Hi" }, required: true }));
    const plan = updated(planSurveyCodes(row({ blocks: [{ ...original, logic: [1] }] })));
    expect(plan.value[0]).toEqual({
      ...original,
      logic: [1],
      elements: [{ ...original.elements[0], code: "q1" }],
    });
  });
});

describe("planSurveyCodes: legacy questions-shaped surveys", () => {
  test("fills questions when blocks is empty and questions is not", () => {
    const plan = updated(
      planSurveyCodes(
        row({
          questions: [
            open("a"),
            { id: "b", type: "multipleChoiceSingle", choices: [opt("x"), opt("y")] },
            { id: "c", type: "cta" },
          ],
        })
      )
    );
    expect(plan.column).toBe("questions");
    const [a, b, c] = plan.value as Record<string, unknown>[];
    expect(a.code).toBe("q1");
    expect(b.code).toBe("q2");
    expect(optionCodes(b)).toEqual(["1", "2"]);
    expect(c).not.toHaveProperty("code");
  });

  test("blocks win: questions are left alone when blocks exist", () => {
    const plan = updated(
      planSurveyCodes(row({ blocks: [block("b1", open("a"))], questions: [open("old")] }))
    );
    expect(plan.column).toBe("blocks");
  });

  test("a coded legacy survey is unchanged and a non-array questions value is ignored", () => {
    expect(planSurveyCodes(row({ questions: [open("a", { code: "q1" })] }))).toEqual({ status: "unchanged" });
    expect(planSurveyCodes(row({ questions: { weird: true } }))).toEqual({ status: "unchanged" });
    expect(planSurveyCodes(row({ blocks: null, questions: null }))).toEqual({ status: "unchanged" });
  });
});

describe("takenNamesOf and name clashes", () => {
  test("uses the Embedded Data rows when the survey has links, ignoring the legacy columns", () => {
    const names = takenNamesOf(
      row({
        linkedNames: ["q1", "plan"],
        variables: [{ name: "legacy" }],
        hiddenFields: { enabled: true, fieldIds: ["old"] },
      })
    );
    expect(names).toEqual(["q1", "plan"]);
  });

  test("falls back to variables and hidden fields when there are no links", () => {
    const names = takenNamesOf(
      row({
        variables: [{ name: "score" }, { name: "q2" }],
        hiddenFields: { enabled: true, fieldIds: ["utm"] },
      })
    );
    expect(names).toEqual(["score", "q2", "utm"]);
  });

  test("tolerates malformed legacy columns", () => {
    expect(takenNamesOf(row({ variables: "x", hiddenFields: null }))).toEqual([]);
    expect(
      takenNamesOf(row({ variables: [null, { name: 3 }, { name: "ok" }], hiddenFields: { fieldIds: "z" } }))
    ).toEqual(["ok"]);
  });

  test("a hidden field called q1 pushes the first question to q2", () => {
    const plan = updated(
      planSurveyCodes(
        row({
          blocks: [block("b1", open("a"), open("b"))],
          hiddenFields: { enabled: true, fieldIds: ["q1"] },
        })
      )
    );
    expect(codesOf(plan.value)).toEqual(["q2", "q3"]);
  });

  test("an Embedded Data row called Q2 (any case) is skipped, and the legacy columns are not read", () => {
    const plan = updated(
      planSurveyCodes(
        row({
          blocks: [block("b1", open("a"), open("b"))],
          linkedNames: ["Q2"],
          hiddenFields: { enabled: true, fieldIds: ["q1"] },
        })
      )
    );
    expect(codesOf(plan.value)).toEqual(["q1", "q3"]);
  });

  test("another question's Question ID q1 is skipped as a code for the first question", () => {
    const plan = updated(planSurveyCodes(row({ blocks: [block("b1", open("x"), open("q1"))] })));
    expect(codesOf(plan.value)).toEqual(["q2", "q3"]);
  });
});

describe("the migration's own rules stay in sync with fillMissingCodes in @formbricks/types", () => {
  const fixtures: { name: string; blocks: unknown[]; taken: string[] }[] = [
    { name: "uncoded", blocks: [block("b1", open("a"), open("b")), block("b2", open("c"))], taken: [] },
    {
      name: "partial codes and gaps",
      blocks: [
        block("b1", open("a", { code: "q1" }), open("b"), open("c", { code: "q4" })),
        block("b2", single("d", [opt("x", "3"), opt("y"), opt("z", "1")])),
      ],
      taken: [],
    },
    {
      name: "cta, nps, rating",
      blocks: [block("b1", { id: "c", type: "cta" }, { id: "n", type: "nps" }, { id: "r", type: "rating" })],
      taken: [],
    },
    {
      name: "choices, ranking, picture, matrix",
      blocks: [
        block(
          "b1",
          single("s", [opt("a"), opt("other"), opt("none")]),
          { id: "m", type: "multipleChoiceMulti", choices: [opt("a"), opt("b", "5"), opt("c")] },
          { id: "r", type: "ranking", choices: [opt("a"), opt("b")] },
          { id: "p", type: "pictureSelection", choices: [pic("a"), pic("b")] },
          { id: "x", type: "matrix", rows: [opt("r1"), opt("r2")], columns: [opt("c1"), opt("c2", "9")] }
        ),
      ],
      taken: [],
    },
    {
      name: "taken names and id clashes",
      blocks: [block("b1", open("q1"), open("Q3"), open("z"), open("w", { code: "Q5" }))],
      taken: ["q2", "Q4", "x"],
    },
    {
      name: "duplicated question ids and duplicate codes",
      blocks: [block("b1", open("a", { code: "dup" }), open("b", { code: "DUP" }), open("a"))],
      taken: [],
    },
    { name: "empty", blocks: [], taken: ["q1"] },
    { name: "empty block", blocks: [block("b1")], taken: [] },
  ];

  test.each(fixtures)("$name", ({ blocks, taken }) => {
    expect(fillMissingCodes(blocks, taken)).toEqual(sharedFillMissingCodes(blocks, taken));
  });
});
