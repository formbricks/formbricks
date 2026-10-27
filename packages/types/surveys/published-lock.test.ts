import { describe, expect, test } from "vitest";
import {
  PUBLISHED_SURVEY_LOCKED_ERROR_CODE,
  describePublishedLockViolations,
  getPublishedLockViolations,
  parsePublishedLockErrorMessage,
} from "./published-lock";

type TestElement = Record<string, unknown> & { id: string; type: string };

const block = (id: string, ...elements: TestElement[]) => ({ id, name: id, elements });

const option = (id: string, label: Record<string, string>, code?: string) => ({
  id,
  label,
  ...(code === undefined ? {} : { code }),
});

const apple = option("a", { default: "Apple", de: "Apfel" }, "1");
const banana = option("b", { default: "Banana", de: "Banane" }, "2");
const row1 = option("r1", { default: "Row" }, "1");
const row2 = option("r2", { default: "Row 2" }, "2");
const col1 = option("c1", { default: "Col" }, "1");
const col2 = option("c2", { default: "Col 2" }, "2");

const single = (overrides: Record<string, unknown> = {}): TestElement => ({
  id: "q1",
  type: "multipleChoiceSingle",
  headline: { default: "Pick one" },
  required: true,
  code: "q1",
  choices: [apple, banana],
  ...overrides,
});

const matrix = (overrides: Record<string, unknown> = {}): TestElement => ({
  id: "m1",
  type: "matrix",
  headline: { default: "Rate" },
  required: true,
  code: "m1",
  rows: [row1, row2],
  columns: [col1, col2],
  ...overrides,
});

const survey = (status: string, ...elements: TestElement[]) => ({
  status,
  blocks: [block("b1", ...elements)],
});

const kinds = (stored: ReturnType<typeof survey>, next: ReturnType<typeof survey>) =>
  getPublishedLockViolations(stored, next).map((violation) => violation.kind);

describe("getPublishedLockViolations: when the lock applies", () => {
  test("a draft stays fully editable", () => {
    const stored = survey("draft", single());
    const next = survey(
      "draft",
      single({ code: "other", type: "multipleChoiceMulti", choices: [option("a", { default: "X" }, "9")] })
    );
    expect(getPublishedLockViolations(stored, next)).toEqual([]);
  });

  test.each(["inProgress", "paused", "completed"])("%s is published", (status) => {
    expect(kinds(survey(status, single()), survey(status, single({ code: "renamed" })))).toEqual([
      "question_code_changed",
    ]);
  });

  test("a scheduled survey (paused with a publish date) counts as published", () => {
    const stored = { ...survey("paused", single()), publishOn: new Date("2030-01-01") };
    expect(kinds(stored, survey("paused", single({ code: "renamed" })))).toEqual(["question_code_changed"]);
  });

  test("the stored status decides, not the incoming one", () => {
    expect(kinds(survey("inProgress", single()), survey("draft", single({ code: "renamed" })))).toEqual([
      "question_code_changed",
    ]);
  });

  test("an unchanged survey has no violations", () => {
    expect(
      getPublishedLockViolations(survey("inProgress", single()), survey("inProgress", single()))
    ).toEqual([]);
  });
});

describe("getPublishedLockViolations: rejected edits", () => {
  const stored = survey("inProgress", single(), matrix());

  test("changing a question code", () => {
    const [violation] = getPublishedLockViolations(
      stored,
      survey("inProgress", single({ code: "age" }), matrix())
    );
    expect(violation).toMatchObject({
      kind: "question_code_changed",
      elementId: "q1",
      path: ["blocks", 0, "elements", 0, "code"],
    });
    expect(violation.message).toContain("q1");
  });

  test("changing an answer code, on choices, rows and columns", () => {
    const next = survey(
      "inProgress",
      single({ choices: [option("a", { default: "Apple", de: "Apfel" }, "7"), banana] }),
      matrix({
        rows: [option("r1", { default: "Row" }, "9"), row2],
        columns: [col1, option("c2", { default: "Col 2" }, "8")],
      })
    );
    const violations = getPublishedLockViolations(stored, next);
    expect(violations.map((v) => v.kind)).toEqual([
      "answer_code_changed",
      "answer_code_changed",
      "answer_code_changed",
    ]);
    expect(violations.map((v) => v.path)).toEqual([
      ["blocks", 0, "elements", 0, "choices", 0, "code"],
      ["blocks", 0, "elements", 1, "rows", 0, "code"],
      ["blocks", 0, "elements", 1, "columns", 1, "code"],
    ]);
    expect(violations[0]).toMatchObject({ optionId: "a", elementId: "q1" });
  });

  test("changing a question type, without piling on option violations", () => {
    const next = survey(
      "inProgress",
      single({ type: "multipleChoiceMulti", choices: [option("zzz", { default: "New" }, "1")] }),
      matrix()
    );
    expect(kinds(stored, next)).toEqual(["question_type_changed"]);
  });

  test("changing option text in the default language", () => {
    const next = survey(
      "inProgress",
      single({ choices: [option("a", { default: "Apples", de: "Apfel" }, "1"), banana] }),
      matrix()
    );
    expect(getPublishedLockViolations(stored, next)).toMatchObject([
      {
        kind: "option_text_changed",
        optionId: "a",
        languageCode: "default",
        path: ["blocks", 0, "elements", 0, "choices", 0, "label", "default"],
      },
    ]);
  });

  test("changing option text in another language", () => {
    const next = survey(
      "inProgress",
      single({ choices: [option("a", { default: "Apple", de: "Apfel!" }, "1"), banana] }),
      matrix()
    );
    expect(getPublishedLockViolations(stored, next)).toMatchObject([
      { kind: "option_text_changed", languageCode: "de" },
    ]);
  });

  test("dropping a translation that existed at launch", () => {
    const next = survey(
      "inProgress",
      single({ choices: [option("a", { default: "Apple" }, "1"), banana] }),
      matrix()
    );
    expect(kinds(stored, next)).toEqual(["option_text_changed"]);
  });

  test("changing matrix row and column text", () => {
    const next = survey(
      "inProgress",
      single(),
      matrix({
        rows: [option("r1", { default: "Renamed" }, "1"), row2],
        columns: [col1, option("c2", { default: "Renamed" }, "2")],
      })
    );
    expect(getPublishedLockViolations(stored, next).map((v) => v.path)).toEqual([
      ["blocks", 0, "elements", 1, "rows", 0, "label", "default"],
      ["blocks", 0, "elements", 1, "columns", 1, "label", "default"],
    ]);
  });

  test("deleting an option that existed at launch, pointing at the list", () => {
    const next = survey("inProgress", single({ choices: [apple] }), matrix());
    expect(getPublishedLockViolations(stored, next)).toMatchObject([
      {
        kind: "option_deleted",
        elementId: "q1",
        optionId: "b",
        path: ["blocks", 0, "elements", 0, "choices"],
      },
    ]);
  });

  test("deleting a matrix row or column that existed at launch", () => {
    const next = survey("inProgress", single(), matrix({ rows: [row1], columns: [col2] }));
    expect(getPublishedLockViolations(stored, next).map((v) => [v.kind, v.optionId])).toEqual([
      ["option_deleted", "r2"],
      ["option_deleted", "c1"],
    ]);
  });

  test("deleting a picture option that existed at launch", () => {
    const picture = (ids: string[]): TestElement => ({
      id: "p1",
      type: "pictureSelection",
      headline: { default: "Pick" },
      required: true,
      choices: ids.map((id) => ({ id, imageUrl: `https://x/${id}.png` })),
    });
    expect(kinds(survey("paused", picture(["a", "b"])), survey("paused", picture(["a"])))).toEqual([
      "option_deleted",
    ]);
  });

  test("replacing an option (new id, new text) reports the deletion", () => {
    const next = survey(
      "inProgress",
      single({ choices: [apple, option("fresh", { default: "Cherry" }, "3")] }),
      matrix()
    );
    expect(kinds(stored, next)).toEqual(["option_deleted"]);
  });

  test("matches by id, not position: a reordered survey is not a violation", () => {
    const next = survey("inProgress", single({ choices: [banana, apple] }), matrix());
    expect(getPublishedLockViolations(stored, next)).toEqual([]);
  });

  test("an element moved to another block is matched by id", () => {
    const next = {
      status: "inProgress",
      blocks: [block("b1", matrix()), block("b2", single({ code: "moved" }))],
    };
    expect(getPublishedLockViolations(stored, next)).toMatchObject([
      { kind: "question_code_changed", path: ["blocks", 1, "elements", 0, "code"] },
    ]);
  });

  test("the client isDraft flag does not unlock a stored element", () => {
    const next = survey("inProgress", single({ isDraft: true, code: "renamed", choices: [apple] }), matrix());
    expect(kinds(stored, next)).toEqual(["question_code_changed", "option_deleted"]);
  });
});

describe("getPublishedLockViolations: allowed edits", () => {
  const stored = survey("inProgress", single(), matrix());

  test("adding a question", () => {
    const added = single({ id: "q2", code: "q2" });
    expect(getPublishedLockViolations(stored, survey("inProgress", single(), matrix(), added))).toEqual([]);
  });

  test("adding a question in a new block", () => {
    const next = {
      status: "inProgress",
      blocks: [...stored.blocks, block("b2", single({ id: "q2", code: undefined }))],
    };
    expect(getPublishedLockViolations(stored, next)).toEqual([]);
  });

  test("deleting a question", () => {
    expect(getPublishedLockViolations(stored, survey("inProgress", matrix()))).toEqual([]);
  });

  test("adding options, with or without a code, with any text", () => {
    const next = survey(
      "inProgress",
      single({
        choices: [apple, banana, option("c", { default: "Cherry" }, "3"), option("d", { default: "Date" })],
      }),
      matrix({
        rows: [row1, row2, option("r3", { default: "Row 3" }, "3")],
        columns: [col1, col2, option("c3", { default: "Col 3" })],
      })
    );
    expect(getPublishedLockViolations(stored, next)).toEqual([]);
  });

  test("adding a translation the option did not have, or filling an empty one", () => {
    const base = survey("inProgress", single({ choices: [option("a", { default: "Apple", fr: "" }, "1")] }));
    const next = survey(
      "inProgress",
      single({ choices: [option("a", { default: "Apple", fr: "Pomme", es: "Manzana" }, "1")] })
    );
    expect(getPublishedLockViolations(base, next)).toEqual([]);
  });

  test("re-sending an element or option without its code (older clients; the write path carries it over)", () => {
    const next = survey(
      "inProgress",
      single({ code: undefined, choices: [option("a", { default: "Apple", de: "Apfel" }), banana] }),
      matrix()
    );
    expect(getPublishedLockViolations(stored, next)).toEqual([]);
  });

  test("assigning a code to an element or option stored without one (surveys from before codes)", () => {
    const base = survey(
      "inProgress",
      single({ code: undefined, choices: [option("a", { default: "Apple" })] })
    );
    const next = survey(
      "inProgress",
      single({ code: "q1", choices: [option("a", { default: "Apple" }, "1")] })
    );
    expect(getPublishedLockViolations(base, next)).toEqual([]);
  });

  test("editing everything that is not a code, a type or option text", () => {
    const next = survey(
      "inProgress",
      single({ headline: { default: "New headline" }, required: false, shuffleOption: "all" }),
      matrix({ headline: { default: "Other" } })
    );
    expect(getPublishedLockViolations(stored, next)).toEqual([]);
  });

  test("elements without options (open text, CTA) can change freely", () => {
    const open: TestElement = {
      id: "o1",
      type: "openText",
      headline: { default: "Why" },
      required: false,
      code: "why",
    };
    const cta: TestElement = { id: "c1", type: "cta", headline: { default: "Go" }, required: false };
    expect(
      getPublishedLockViolations(
        survey("completed", open, cta),
        survey(
          "completed",
          { ...open, headline: { default: "Why?" } },
          { ...cta, headline: { default: "Now" } }
        )
      )
    ).toEqual([]);
  });

  test("tolerates malformed input instead of throwing", () => {
    expect(
      getPublishedLockViolations({ status: "inProgress", blocks: [null, { elements: "x" }] }, { blocks: [] })
    ).toEqual([]);
  });
});

describe("refusal message", () => {
  test("round-trips through the marker so the editor can recognise it", () => {
    const violations = getPublishedLockViolations(
      survey("inProgress", single()),
      survey("inProgress", single({ code: "renamed" }))
    );
    const message = describePublishedLockViolations(violations);

    expect(message.startsWith(`${PUBLISHED_SURVEY_LOCKED_ERROR_CODE}: `)).toBe(true);
    expect(parsePublishedLockErrorMessage(message)).toBe(violations[0].message);
  });

  test("ignores any other error message", () => {
    expect(parsePublishedLockErrorMessage("This survey is archived.")).toBeNull();
  });
});
