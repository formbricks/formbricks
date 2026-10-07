import { describe, expect, test } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan } from "./__fixtures__/recorded-plans";
import {
  QSF_MAX_NOTE_CHARS,
  type TQsfPlannedBlock,
  checkPlanResponses,
  checkQuestionRoles,
  cleanNote,
  mergeCheckedPlans,
  orderBlocks,
} from "./plan-checks";
import type { TQsfPlanQuestion } from "./plan-schema";
import { readQsf } from "./read-qsf";

const simple = readQsf(loadQsfFixture("simple.qsf"));
const advanced = readQsf(loadQsfFixture("matrix-slider-ranking.qsf"));
const logic = readQsf(loadQsfFixture("logic-skip-display-branch.qsf"));

const entry = (ref: string, type: string, fields: Partial<TQsfPlanQuestion> = {}): TQsfPlanQuestion => ({
  ref,
  type,
  required: false,
  choicesFrom: null,
  rowsFrom: null,
  columnsFrom: null,
  otherChoiceKey: null,
  noneChoiceKey: null,
  labelKey: null,
  excludedKeys: [],
  contactFields: [],
  inputType: null,
  scale: null,
  range: null,
  format: null,
  logicNotes: [],
  ...fields,
});

const question = (survey: typeof simple, ref: string) => {
  const found = survey.questions.get(ref);
  if (!found) throw new Error(`No ${ref}`);
  return found;
};

const failureOf = (result: ReturnType<typeof checkQuestionRoles>) => (result.ok ? [] : result.reasons);

describe("checkQuestionRoles", () => {
  test("accepts a multiple choice question with its other and none options", () => {
    const result = checkQuestionRoles(
      question(simple, "QID5"),
      entry("QID5", "multipleChoiceMulti", { choicesFrom: "choices", noneChoiceKey: "c18" })
    );

    expect(result.ok && result.question.choices).toEqual([
      { key: "c15" },
      { key: "c16" },
      { key: "c17" },
      { key: "c18", special: "none" },
    ]);
  });

  test.each(["pictureSelection", "cal", "address", "consent2", ""])("refuses the type %j", (type) => {
    expect(failureOf(checkQuestionRoles(question(simple, "QID1"), entry("QID1", type)))).toEqual([
      "type_not_allowed",
    ]);
  });

  test("refuses a key that belongs to another question", () => {
    // c4 is QID2's.
    const result = checkQuestionRoles(
      question(simple, "QID1"),
      entry("QID1", "multipleChoiceSingle", { choicesFrom: "choices", otherChoiceKey: "c4" })
    );

    expect(failureOf(result)).toEqual(["foreign_key"]);
  });

  test("refuses a key used for two roles", () => {
    const result = checkQuestionRoles(
      question(simple, "QID1"),
      entry("QID1", "multipleChoiceSingle", {
        choicesFrom: "choices",
        otherChoiceKey: "c3",
        excludedKeys: ["c3"],
      })
    );

    expect(failureOf(result)).toEqual(["key_reused"]);
  });

  test("refuses an other option the question's choice list does not hold", () => {
    const matrix = question(advanced, "QID1");
    const result = checkQuestionRoles(
      matrix,
      entry("QID1", "multipleChoiceSingle", { choicesFrom: "choices", otherChoiceKey: "a1" })
    );

    expect(failureOf(result)).toEqual(["foreign_key"]);
  });

  test.each([
    ["a choice type without a choice list", "QID1", entry("QID1", "multipleChoiceSingle"), "missing_role"],
    [
      "a role its type does not use",
      "QID3",
      entry("QID3", "openText", { choicesFrom: "choices" }),
      "role_not_for_type",
    ],
    [
      "a none option on a single choice",
      "QID1",
      entry("QID1", "multipleChoiceSingle", { choicesFrom: "choices", noneChoiceKey: "c2" }),
      "role_not_for_type",
    ],
    [
      "fewer than two choices left",
      "QID1",
      entry("QID1", "multipleChoiceSingle", { choicesFrom: "choices", excludedKeys: ["c1", "c2"] }),
      "too_few_options",
    ],
    ["a rating without a scale", "QID2", entry("QID2", "rating", { range: "5" }), "missing_scale"],
    [
      "a rating range Formbricks has no scale for",
      "QID2",
      entry("QID2", "rating", { scale: "number", range: null }),
      "invalid_range",
    ],
    [
      "a CSAT that is not out of 5",
      "QID2",
      entry("QID2", "csat", { scale: "number", range: "7" }),
      "invalid_range",
    ],
    ["a CES out of 10", "QID2", entry("QID2", "ces", { scale: "number", range: "10" }), "invalid_range"],
    ["a date without a format", "QID3", entry("QID3", "date"), "missing_format"],
  ])("refuses %s", (_case, ref, planEntry, reason) => {
    expect(failureOf(checkQuestionRoles(question(simple, ref), planEntry))).toContain(reason);
  });

  test("checks a matrix's rows and columns come from two different lists", () => {
    const matrix = question(advanced, "QID1");

    expect(
      checkQuestionRoles(matrix, entry("QID1", "matrix", { rowsFrom: "choices", columnsFrom: "answers" })).ok
    ).toBe(true);
    expect(
      failureOf(
        checkQuestionRoles(matrix, entry("QID1", "matrix", { rowsFrom: "choices", columnsFrom: "choices" }))
      )
    ).toEqual(["missing_role"]);
  });

  test("caps a ranking at 25 options", () => {
    const ranking = question(advanced, "QID12");

    expect(
      failureOf(checkQuestionRoles(ranking, entry("QID12", "ranking", { choicesFrom: "choices" })))
    ).toEqual(["too_many_options"]);
    expect(
      checkQuestionRoles(
        ranking,
        entry("QID12", "ranking", { choicesFrom: "choices", excludedKeys: ["c41"] })
      ).ok
    ).toBe(true);
  });

  test("checks contact fields name the question's own choices, once each", () => {
    const form = question(advanced, "QID8");

    expect(
      checkQuestionRoles(
        form,
        entry("QID8", "contactInfo", { contactFields: [{ field: "firstName", key: "c11" }] })
      ).ok
    ).toBe(true);
    expect(
      failureOf(
        checkQuestionRoles(
          form,
          entry("QID8", "contactInfo", {
            contactFields: [
              { field: "firstName", key: "c11" },
              { field: "firstName", key: "c12" },
            ],
          })
        )
      )
    ).toEqual(["missing_role"]);
  });

  test("defaults an open text's input type and cleans its notes", () => {
    const result = checkQuestionRoles(
      question(simple, "QID3"),
      entry("QID3", "openText", { logicNotes: ["  Shown if  'X' is\n'Y'. ", ""] })
    );

    expect(result.ok && result.question).toMatchObject({
      inputType: "text",
      notes: ["Shown if 'X' is 'Y'."],
    });
  });
});

describe("cleanNote", () => {
  test("replaces anything that looks like a link", () => {
    expect(cleanNote("Go to https://evil.example/a or www.evil.example, javascript:alert(1)")).toBe(
      "Go to … or … …"
    );
  });

  test("drops control characters, bidi overrides and markup characters", () => {
    expect(cleanNote("a\u0007b\u202ec<script>")).toBe("a b cscript");
  });

  test("caps the length", () => {
    const note = cleanNote("x".repeat(5_000));

    expect(note).toHaveLength(QSF_MAX_NOTE_CHARS);
    expect(note.endsWith("…")).toBe(true);
  });
});

describe("checkPlanResponses", () => {
  const allRefs = new Set(["QID1", "QID2", "QID3", "QID4", "QID5"]);

  test("accepts the recorded plan whole", () => {
    const plan = checkPlanResponses(simple, [{ refs: allRefs, object: loadRecordedPlan("simple.qsf") }]);

    expect([...plan.questions.keys()]).toEqual(["QID1", "QID2", "QID3", "QID4", "QID5"]);
    expect(plan.failures.size).toBe(0);
    expect(plan.blocks).toEqual([{ pageId: "p1", refs: [...allRefs], notes: [] }]);
  });

  test("drops, neutralizes or caps every part of a hostile plan", () => {
    const plan = checkPlanResponses(simple, [{ refs: allRefs, object: loadRecordedPlan("hostile") }]);

    expect(Object.fromEntries(plan.failures)).toEqual({
      QID1: ["placed_and_skipped"],
      QID2: ["type_not_allowed"],
      QID3: ["foreign_key"],
      QID4: ["duplicate_ref"],
      QID5: ["key_reused"],
    });
    expect(plan.questions.size).toBe(0);
    expect(plan.skipped.size).toBe(0);
    // Refs outside the call — an unknown QID, `__proto__`, `constructor` — are ignored, not placed.
    expect(plan.blocks).toEqual([]);
  });

  test("ignores refs another call was asked about", () => {
    const recorded = loadRecordedPlan("simple.qsf");

    const plan = checkPlanResponses(simple, [
      { refs: new Set(["QID1", "QID2"]), object: recorded },
      { refs: new Set(["QID3", "QID4", "QID5"]), object: { blocks: [], questions: [], skipped: [] } },
    ]);

    expect([...plan.questions.keys()]).toEqual(["QID1", "QID2"]);
    expect(Object.fromEntries(plan.failures)).toEqual({
      QID3: ["missing"],
      QID4: ["missing"],
      QID5: ["missing"],
    });
  });

  test("fails every question of a response it cannot read", () => {
    const plan = checkPlanResponses(simple, [{ refs: new Set(["QID1"]), object: "not a plan" }]);

    expect(Object.fromEntries(plan.failures)).toEqual({ QID1: ["invalid_output"] });
  });

  test("fails the questions of a block that mixes pages", () => {
    const recorded = loadRecordedPlan("logic-skip-display-branch.qsf");
    const refs = new Set(["QID1", "QID2", "QID3", "QID4", "QID5", "QID6"]);

    const plan = checkPlanResponses(logic, [
      { refs, object: { ...recorded, blocks: [{ refs: [...refs], logicNotes: [] }] } },
    ]);

    expect([...plan.failures.values()].every((reasons) => reasons.includes("block_mixes_pages"))).toBe(true);
    expect(plan.questions.size).toBe(0);
  });

  test("puts a block's questions in survey order whatever order the model used", () => {
    const recorded = loadRecordedPlan("simple.qsf");

    const plan = checkPlanResponses(simple, [
      {
        refs: allRefs,
        object: { ...recorded, blocks: [{ refs: ["QID5", "QID1", "QID3", "QID2", "QID4"], logicNotes: [] }] },
      },
    ]);

    expect(plan.blocks[0].refs).toEqual(["QID1", "QID2", "QID3", "QID4", "QID5"]);
  });

  test("keeps a skip with its cleaned reason", () => {
    const plan = checkPlanResponses(simple, [
      {
        refs: new Set(["QID1"]),
        object: {
          blocks: [],
          questions: [],
          skipped: [{ ref: "QID1", reason: "Not supported, see https://x.y" }],
        },
      },
    ]);

    expect(Object.fromEntries(plan.skipped)).toEqual({ QID1: "Not supported, see …" });
  });
});

describe("orderBlocks and mergeCheckedPlans", () => {
  const block = (pageId: string, refs: string[]): TQsfPlannedBlock => ({ pageId, refs, notes: [] });

  test("merges a retried question back into the block it fell inside", () => {
    expect(orderBlocks(simple, [block("p1", ["QID1", "QID3"]), block("p1", ["QID2"])])).toEqual([
      block("p1", ["QID1", "QID2", "QID3"]),
    ]);
  });

  test("keeps the model's split of a page when it does not interleave", () => {
    expect(orderBlocks(simple, [block("p1", ["QID4", "QID5"]), block("p1", ["QID1", "QID2"])])).toEqual([
      block("p1", ["QID1", "QID2"]),
      block("p1", ["QID4", "QID5"]),
    ]);
  });

  test("a retry's results replace the first round's failures", () => {
    const first = checkPlanResponses(simple, [
      { refs: allRefsOf(simple), object: loadRecordedPlan("hostile") },
    ]);
    const retry = checkPlanResponses(simple, [
      { refs: new Set(first.failures.keys()), object: loadRecordedPlan("simple.qsf") },
    ]);

    const merged = mergeCheckedPlans(simple, first, retry);

    expect(merged.failures.size).toBe(0);
    expect(merged.blocks).toEqual([block("p1", ["QID1", "QID2", "QID3", "QID4", "QID5"])]);
  });
});

function allRefsOf(survey: typeof simple): Set<string> {
  return new Set(survey.questions.keys());
}
