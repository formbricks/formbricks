import { describe, expect, test, vi } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { buildAnswerPlan, serializeAnswers } from "./answers";
import type { TV3ResponseAnswer } from "./resources";

vi.mock("server-only", () => ({}));

const i18n = (value: string, extra: Record<string, string> = {}) => ({ default: value, ...extra });

const element = (over: Record<string, unknown>): TSurveyElement =>
  ({ headline: i18n("Headline"), required: false, ...over }) as unknown as TSurveyElement;

const choice = (id: string, label: string) => ({ id, label: i18n(label) });

const toggle = (placeholder: string) => ({ show: true, required: false, placeholder: i18n(placeholder) });

/** One block holding every element under test, so positions come out of a real flatten. */
const planFor = (elements: TSurveyElement[], lookupKey = "default") =>
  buildAnswerPlan([{ id: "blk", name: "Block", elements } as unknown as TSurveyBlock], lookupKey);

const only = (elements: TSurveyElement[], data: Record<string, unknown>, ttc?: Record<string, number>) =>
  serializeAnswers(planFor(elements), data as never, ttc as never);

const answer = (elements: TSurveyElement[], data: Record<string, unknown>, ttc?: Record<string, number>) => {
  const { answers, unresolved } = only(elements, data, ttc);
  expect(unresolved, `unexpected unresolved: ${JSON.stringify(unresolved)}`).toEqual([]);
  return answers[0];
};

/**
 * Narrow the answer union to the variant carrying a given value field.
 *
 * `answers[0]` is the nine-member union, so `.selections` / `.fields` / `.rows` are not reachable on
 * it. `Extract<…, { elementType: "x" }>` does not work here: the grouped variants declare
 * `elementType` as a four-literal enum, so extracting on one literal yields `never` and every access
 * below it silently types as `never` while still compiling. The `in` operator narrows on the field
 * that actually distinguishes them.
 */
const withSelections = (answer: TV3ResponseAnswer) => {
  if (!("selections" in answer)) throw new Error(`expected a choice answer, got ${answer.elementType}`);
  return answer;
};

const withFields = (answer: TV3ResponseAnswer) => {
  if (!("fields" in answer)) throw new Error(`expected a composite answer, got ${answer.elementType}`);
  return answer;
};

const withRows = (answer: TV3ResponseAnswer) => {
  if (!("rows" in answer)) throw new Error(`expected a matrix answer, got ${answer.elementType}`);
  return answer;
};

describe("serializeAnswers — one branch per element type", () => {
  test("openText returns a string even when the input type is numeric", () => {
    const el = element({ id: "q1", type: "openText", inputType: "number" });

    expect(answer([el], { q1: "42" })).toMatchObject({
      elementType: "openText",
      valueText: "42",
      inputType: "number",
    });
  });

  /** `ZSurveyNPSElement` declares neither `range` nor `scale`; NPS is 0–10 by definition. */
  test("nps carries a hardcoded 0–10 range and no scale", () => {
    const el = element({ id: "q1", type: "nps" });
    const result = answer([el], { q1: 9 });

    expect(result).toMatchObject({ elementType: "nps", valueNumber: 9, range: { min: 0, max: 10 } });
    expect(result).not.toHaveProperty("scale");
  });

  test.each([
    ["rating", 7, "star"],
    ["csat", 5, "smiley"],
    ["ces", 7, "number"],
  ])("%s carries its own range and scale", (type, range, scale) => {
    const el = element({ id: "q1", type, range, scale });

    expect(answer([el], { q1: 4 })).toMatchObject({
      elementType: type,
      valueNumber: 4,
      range: { min: 1, max: range },
      scale,
    });
  });

  test.each([
    ["accepted", true],
    ["", false],
  ])("consent %s reads as %s and keeps the raw token", (raw, expected) => {
    const el = element({ id: "q1", type: "consent", label: i18n("I agree") });

    expect(answer([el], { q1: raw })).toMatchObject({ valueBoolean: expected, rawValue: raw });
  });

  /** `dismissed` is a real legacy token for a skipped CTA and must read as false, not as missing. */
  test.each([
    ["clicked", true],
    ["dismissed", false],
    ["", false],
  ])("cta %s reads as %s", (raw, expected) => {
    const el = element({ id: "q1", type: "cta" });

    expect(answer([el], { q1: raw })).toMatchObject({ valueBoolean: expected, rawValue: raw });
  });

  test("cal reports the booking and the raw token", () => {
    const el = element({ id: "q1", type: "cal", calUserName: "someone" });

    expect(answer([el], { q1: "booked" })).toMatchObject({ booked: true, rawValue: "booked" });
  });

  /** Older clients wrote the element's display format; reformatting without knowing which moves the date. */
  test.each(["2026-09-09", "09-09-2026"])("date %s is returned verbatim", (raw) => {
    const el = element({ id: "q1", type: "date", format: "d-M-y" });

    expect(answer([el], { q1: raw })).toMatchObject({ elementType: "date", valueDate: raw });
  });

  test("fileUpload reports the urls and their count", () => {
    const el = element({ id: "q1", type: "fileUpload", allowMultipleFiles: true });

    expect(answer([el], { q1: ["/a.png", "/b.pdf"] })).toMatchObject({
      fileUrls: ["/a.png", "/b.pdf"],
      fileCount: 2,
    });
  });
});

describe("composite answers keep every slot", () => {
  const address = element({
    id: "q1",
    type: "address",
    addressLine1: toggle("Street"),
    addressLine2: toggle("Apt"),
    city: toggle("City"),
    state: toggle("State"),
    zip: toggle("ZIP"),
    country: toggle("Country"),
  });

  /**
   * The trap this exists for: the stored value is a fixed-length positional array, so dropping a
   * blank shifts every later value onto the wrong field and makes the stored array unreconstructable.
   */
  test("address emits all six slots in storage order, blanks included", () => {
    const result = withFields(answer([address], { q1: ["Rua A", "", "Lisboa", "", "1000-001", "PT"] }));

    expect(result.fields.map((f: { fieldId: string }) => f.fieldId)).toEqual([
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "zip",
      "country",
    ]);
    expect(result.fields.map((f: { slot: number }) => f.slot)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.fields[1]).toMatchObject({ fieldId: "addressLine2", valueText: "" });
    expect(result.fields[5]).toMatchObject({ fieldId: "country", valueText: "PT" });
  });

  test("the sub-field label comes from the element's placeholder", () => {
    const result = withFields(answer([address], { q1: ["Rua A", "", "", "", "", ""] }));

    expect(result.fields[0]).toMatchObject({ fieldId: "addressLine1", fieldLabel: "Street" });
  });

  test("a short stored array still yields every slot, padded", () => {
    const result = withFields(answer([address], { q1: ["Rua A"] }));

    expect(result.fields).toHaveLength(6);
    expect(result.fields[3]).toMatchObject({ fieldId: "state", valueText: "" });
  });

  test("contactInfo uses its own five fields", () => {
    const el = element({
      id: "q1",
      type: "contactInfo",
      firstName: toggle("First"),
      lastName: toggle("Last"),
      email: toggle("Email"),
      phone: toggle("Phone"),
      company: toggle("Company"),
    });

    expect(
      withFields(answer([el], { q1: ["Ada", "L", "a@b.c", "", ""] })).fields.map((f) => f.fieldId)
    ).toEqual(["firstName", "lastName", "email", "phone", "company"]);
  });
});

describe("choice resolution follows id → label → other → unmatched", () => {
  const withOther = element({
    id: "q1",
    type: "multipleChoiceSingle",
    choices: [choice("c1", "Blue"), choice("c2", "Green"), choice("other", "Other")],
  });
  const withoutOther = element({
    id: "q1",
    type: "multipleChoiceSingle",
    choices: [choice("c1", "Blue"), choice("c2", "Green")],
  });

  test("a stored label resolves to its option", () => {
    expect(withSelections(answer([withOther], { q1: "Green" })).selections[0]).toMatchObject({
      optionId: "c2",
      optionLabel: "Green",
      match: "label",
    });
  });

  test("a stored id resolves exactly, and takes precedence over label matching", () => {
    expect(withSelections(answer([withOther], { q1: "c1" })).selections[0]).toMatchObject({
      optionId: "c1",
      optionLabel: "Blue",
      match: "exact",
    });
  });

  /**
   * The Other option is a real option with a real id, so a write-in names it. Returning nulls would
   * emit the exact payload the contract reserves for "nothing resolved" while `match` claims the
   * opposite — and a client branching on `optionId === null` would file every write-in as
   * unresolvable.
   */
  test("a write-in names the Other option rather than nulling it", () => {
    expect(withSelections(answer([withOther], { q1: "Teal" })).selections[0]).toMatchObject({
      optionId: "other",
      optionLabel: "Other",
      rawValue: "Teal",
      match: "other",
    });
  });

  /** The renderer stores `""` for Other-selected-but-blank; it is a selection, not a missing value. */
  test("a blank Other selection still names the Other option", () => {
    expect(withSelections(answer([withOther], { q1: "" })).selections[0]).toMatchObject({
      optionId: "other",
      rawValue: "",
      match: "other",
    });
  });

  /**
   * `"other"` is a behaviour id, not a value the renderer ever stores — it stores `""` for that.
   * So a stored `"other"` is a label reading "other", and matching it by id names the wrong choice.
   */
  test("a stored value equal to a reserved choice id is not matched by id", () => {
    const el = element({
      id: "q1",
      type: "multipleChoiceSingle",
      choices: [choice("c1", "Blue"), { id: "other", label: i18n("Other") }],
    });

    expect(withSelections(answer([el], { q1: "other" })).selections[0]).toMatchObject({
      optionId: "other",
      match: "other",
      rawValue: "other",
    });
  });

  /**
   * The distinction the contract is explicit about: a renamed option and a genuine write-in are
   * byte-identical as stored, so an element with no Other input must never claim one.
   */
  test("an unresolvable value on an element with no Other reports `unmatched`, not `other`", () => {
    expect(withSelections(answer([withoutOther], { q1: "Teal" })).selections[0]).toMatchObject({
      rawValue: "Teal",
      match: "unmatched",
      optionId: null,
    });
  });

  test("the value survives even when nothing resolves", () => {
    expect(withSelections(answer([withoutOther], { q1: "Teal" })).selections[0].rawValue).toBe("Teal");
  });

  test("multipleChoiceMulti resolves each entry independently", () => {
    const el = element({
      id: "q1",
      type: "multipleChoiceMulti",
      choices: [choice("c1", "Blue"), choice("other", "Other")],
    });
    const selections = withSelections(answer([el], { q1: ["Blue", "Chartreuse"] })).selections;

    expect(selections.map((s) => [s.match, s.optionId])).toEqual([
      ["label", "c1"],
      ["other", "other"],
    ]);
  });

  /** `ZSurveyPictureChoice` is `{id, imageUrl}` — no label to resolve, so ids match exactly. */
  test("pictureSelection matches on id and reports a null label", () => {
    const el = element({
      id: "q1",
      type: "pictureSelection",
      choices: [
        { id: "p1", imageUrl: "/a.png" },
        { id: "p2", imageUrl: "/b.png" },
      ],
    });

    expect(withSelections(answer([el], { q1: ["p2"] })).selections[0]).toMatchObject({
      optionId: "p2",
      optionLabel: null,
      match: "exact",
    });
  });

  test("ranking numbers its selections from one, in stored order", () => {
    const el = element({
      id: "q1",
      type: "ranking",
      choices: [choice("c1", "Speed"), choice("c2", "Price"), choice("c3", "Support")],
    });
    const selections = withSelections(answer([el], { q1: ["Support", "Speed", "Price"] })).selections;

    expect(selections.map((s) => [s.rank, s.optionId])).toEqual([
      [1, "c3"],
      [2, "c1"],
      [3, "c2"],
    ]);
  });

  test("no rank is emitted for non-ranking selections", () => {
    expect(withSelections(answer([withOther], { q1: "Blue" })).selections[0]).not.toHaveProperty("rank");
  });
});

describe("matrix is keyed by localized labels, never ids", () => {
  const el = element({
    id: "q1",
    type: "matrix",
    rows: [choice("r1", "Speed"), choice("r2", "Price")],
    columns: [choice("col1", "Good"), choice("col2", "Bad")],
  });

  test("resolves both sides and keeps the stored key verbatim", () => {
    const rows = withRows(answer([el], { q1: { Speed: "Good" } })).rows;

    expect(rows[0]).toMatchObject({
      rawKey: "Speed",
      rowId: "r1",
      rowLabel: "Speed",
      columnId: "col1",
      columnLabel: "Good",
      rawValue: "Good",
      match: "label",
    });
  });

  test("a row that no longer resolves falls back to the stored key and nulls the ids", () => {
    const rows = withRows(answer([el], { q1: { Reliability: "Excellent" } })).rows;

    expect(rows[0]).toMatchObject({
      rawKey: "Reliability",
      rowId: null,
      rowLabel: "Reliability",
      columnId: null,
      columnLabel: null,
      match: "unmatched",
    });
  });
});

describe("unreadable values become unresolved rather than throwing or guessing", () => {
  test.each([
    ["openText holding an array", { id: "q1", type: "openText" }, ["a"]],
    ["nps holding a string", { id: "q1", type: "nps" }, "9"],
    ["matrix holding a string", { id: "q1", type: "matrix", rows: [], columns: [] }, "Good"],
    ["fileUpload holding a string", { id: "q1", type: "fileUpload", allowMultipleFiles: false }, "/a.png"],
    ["address holding an object", { id: "q1", type: "address" }, { city: "Lisboa" }],
  ])("%s", (_label, el, raw) => {
    const { answers, unresolved } = only([element(el)], { q1: raw });

    expect(answers).toEqual([]);
    expect(unresolved).toEqual([{ key: "q1", rawValue: raw, reason: "valueShapeMismatch" }]);
  });

  test("a key with no element in the current definition is reported, not dropped", () => {
    const { answers, unresolved } = only([element({ id: "q1", type: "openText" })], {
      q1: "kept",
      gone: "also kept",
    });

    expect(answers).toHaveLength(1);
    expect(unresolved).toEqual([{ key: "gone", rawValue: "also kept", reason: "elementNotInSurvey" }]);
  });

  test("one bad value does not stop the others", () => {
    const { answers, unresolved } = only(
      [element({ id: "q1", type: "openText" }), element({ id: "q2", type: "nps" })],
      { q1: ["bad"], q2: 10 }
    );

    expect(answers).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
  });
});

describe("position, order and timing", () => {
  const els = [
    element({ id: "q1", type: "openText" }),
    element({ id: "q2", type: "openText" }),
    element({ id: "q3", type: "openText" }),
  ];

  test("answers come back in survey order regardless of the stored key order", () => {
    const { answers } = only(els, { q3: "c", q1: "a", q2: "b" });

    expect(answers.map((a) => a.elementId)).toEqual(["q1", "q2", "q3"]);
    expect(answers.map((a) => a.position)).toEqual([1, 2, 3]);
  });

  test("timing converts to seconds", () => {
    expect(answer(els, { q1: "a" }, { q1: 4321.6 })).toMatchObject({ durationSeconds: 4.322 });
  });

  test("an element with no timing carries no duration at all", () => {
    expect(answer(els, { q1: "a" }, { q2: 1000 })).not.toHaveProperty("durationSeconds");
  });

  /**
   * The stored ttc is deliberately unbounded so pre-clamp rows still parse, and the contract
   * publishes `0 <= durationSeconds <= 86400`. Without clamping on read, a real historical row makes
   * the API violate its own schema.
   */
  test.each([
    ["a tab left open for days", 200_000_000, 86_400],
    ["a negative reading", -5_000, 0],
  ])("%s is clamped into the published range", (_label, ms, expected) => {
    expect(answer(els, { q1: "a" }, { q1: ms })).toMatchObject({ durationSeconds: expected });
  });
});

describe("labels resolve in the response's language", () => {
  test("the element label is the localized headline", () => {
    const el = element({
      id: "q1",
      type: "openText",
      headline: i18n("How satisfied?", { de: "Wie zufrieden?" }),
    });
    const { answers } = serializeAnswers(planFor([el], "de"), { q1: "sehr" } as never, undefined);

    expect(answers[0].elementLabel).toBe("Wie zufrieden?");
  });

  /** The ENG-2001 fallback: a blank translation must not blank the label. */
  test("an untranslated headline falls back to the default rather than going empty", () => {
    const el = element({ id: "q1", type: "openText", headline: i18n("How satisfied?", { de: "" }) });
    const { answers } = serializeAnswers(planFor([el], "de"), { q1: "x" } as never, undefined);

    expect(answers[0].elementLabel).toBe("How satisfied?");
  });

  test("choice matching uses the same language as the labels", () => {
    const el = element({
      id: "q1",
      type: "multipleChoiceSingle",
      choices: [{ id: "c1", label: i18n("Blue", { de: "Blau" }) }],
    });
    const { answers } = serializeAnswers(planFor([el], "de"), { q1: "Blau" } as never, undefined);
    expect(withSelections(answers[0]).selections[0]).toMatchObject({ optionId: "c1", match: "label" });
  });
});
