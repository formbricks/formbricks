import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ZSurveyElement } from "@formbricks/types/surveys/elements";
import { QsfIdRegistry } from "./id-registry";
import { type TQsfMappedElement, mapQsfQuestion } from "./map-question";
import { parseQsf } from "./parse-qsf";
import type { TQsfQuestion, TQsfSurvey } from "./types";

const FIXTURES = join(__dirname, "__fixtures__");

function load(name: string): TQsfSurvey {
  const result = parseQsf(readFileSync(join(FIXTURES, name)));
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

const question = (model: TQsfSurvey, qid: string): TQsfQuestion => {
  const found = model.questions.get(qid);
  if (!found) throw new Error(`${qid} missing`);
  return found;
};

const ctxFor = (model: TQsfSurvey) => ({
  defaultLanguageCode: model.defaultLanguageCode,
  languageCodes: model.languageCodes,
  idRegistry: new QsfIdRegistry(),
});

/** Public locale maps → the internal `default`-keyed maps the element schemas validate. */
function toInternal(value: unknown, defaultLanguage: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => toInternal(entry, defaultLanguage));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, defaultLanguage) && Object.values(record).every((v) => typeof v === "string")) {
    const { [defaultLanguage]: def, ...rest } = record;
    return { default: def, ...rest };
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, toInternal(entry, defaultLanguage)])
  );
}

function expectValidElements(elements: TQsfMappedElement[], defaultLanguage: string): void {
  for (const element of elements) {
    const parsed = ZSurveyElement.safeParse(toInternal(element, defaultLanguage));
    expect(parsed.success, `${element.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
  }
}

describe("mapQsfQuestion — simple.qsf", () => {
  const model = load("simple.qsf");

  test("single select with an 'other' choice, required, ids from export tags", () => {
    const { elements, issues, choiceIdMap } = mapQsfQuestion(question(model, "QID1"), ctxFor(model));

    expect(issues).toEqual([]);
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({
      id: "Q1",
      type: "multipleChoiceSingle",
      required: true,
      headline: { "en-US": "How did you hear about us?" },
      otherOptionPlaceholder: { "en-US": "Please specify" },
    });
    expect(
      (elements[0].choices as { id: string; label: Record<string, string> }[]).map((choice) => [
        choice.id,
        choice.label["en-US"],
      ])
    ).toEqual([
      ["choice_1", "Search engine"],
      ["choice_2", "A friend"],
      ["other", "Other"],
    ]);
    expect(choiceIdMap).toEqual({ "1": "choice_1", "2": "choice_2", "3": "other" });
    expectValidElements(elements, "en-US");
  });

  test("NPS, long text, email input, multi select with shuffle", () => {
    const ctx = ctxFor(model);
    const nps = mapQsfQuestion(question(model, "QID2"), ctx).elements[0];
    expect(nps).toMatchObject({ type: "nps", required: true });
    expect(nps).not.toHaveProperty("choices");

    const long = mapQsfQuestion(question(model, "QID3"), ctx).elements[0];
    expect(long).toMatchObject({
      type: "openText",
      longAnswer: true,
      required: false,
      headline: { "en-US": "What should we improve?" },
    });

    const email = mapQsfQuestion(question(model, "QID4"), ctx).elements[0];
    expect(email).toMatchObject({ type: "openText", inputType: "email", required: false });

    const multi = mapQsfQuestion(question(model, "QID5"), ctx).elements[0];
    expect(multi).toMatchObject({ type: "multipleChoiceMulti", shuffleOption: "all" });
    expectValidElements([nps, long, email, multi], "en-US");
  });
});

describe("mapQsfQuestion — multilang-en-de.qsf", () => {
  const model = load("multilang-en-de.qsf");

  test("fills every declared language on headline, choices, rows and columns", () => {
    const ctx = ctxFor(model);
    const single = mapQsfQuestion(question(model, "QID1"), ctx);
    expect(single.issues).toEqual([]);
    expect(single.elements[0].headline).toEqual({
      "en-US": "How satisfied are you?",
      "de-DE": "Wie zufrieden sind Sie?",
    });
    expect((single.elements[0].choices as { label: Record<string, string> }[])[0].label).toEqual({
      "en-US": "Very satisfied",
      "de-DE": "Sehr zufrieden",
    });

    const matrix = mapQsfQuestion(question(model, "QID3"), ctx);
    expect(matrix.elements[0]).toMatchObject({ type: "matrix" });
    expect(
      (matrix.elements[0].rows as { id: string; label: Record<string, string> }[]).map((row) => [
        row.id,
        row.label["de-DE"],
      ])
    ).toEqual([
      ["row_1", "Einfach zu bedienen"],
      ["row_2", "Gutes Preis-Leistungs-Verhältnis"],
    ]);
    expect((matrix.elements[0].columns as { id: string }[]).map((column) => column.id)).toEqual([
      "column_1",
      "column_2",
      "column_3",
    ]);
    expectValidElements([...single.elements, ...matrix.elements], "en-US");
  });

  test("a missing translation becomes an empty string plus one translation_missing note", () => {
    const withoutGerman = { ...question(model, "QID2"), translations: {} };
    const { elements, issues } = mapQsfQuestion(withoutGerman, ctxFor(model));

    expect(elements[0].headline).toEqual({ "en-US": "Anything else?", "de-DE": "" });
    expect(issues).toEqual([
      expect.objectContaining({
        code: "translation_missing",
        sourceRef: "QID2",
        vars: expect.objectContaining({ code: "de-DE" }),
      }),
    ]);
  });
});

describe("mapQsfQuestion — matrix-slider-ranking.qsf", () => {
  const model = load("matrix-slider-ranking.qsf");
  const map = (qid: string) => mapQsfQuestion(question(model, qid), ctxFor(model));

  test("Likert single answer → matrix; multiple answer → unsupported", () => {
    expect(map("QID1").elements[0]).toMatchObject({ type: "matrix", required: true });
    const multi = map("QID2");
    expect(multi.elements).toEqual([]);
    expect(multi.issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "unsupported_question_type",
        sourceRef: "QID2",
        vars: expect.objectContaining({ type: "Matrix/Likert/MultipleAnswer" }),
      }),
    ]);
  });

  test("slider with two statements → two number ratings, clamped and approximated; star → star rating", () => {
    const slider = map("QID3");
    expect(slider.elements).toHaveLength(2);
    expect(slider.elements[0]).toMatchObject({
      id: "Q3_1",
      type: "rating",
      scale: "number",
      range: 10,
      headline: { "en-US": "The product is fast" },
    });
    expect(slider.elements[1]).toMatchObject({
      id: "Q3_2",
      headline: { "en-US": "The product is stable" },
      subheader: { "en-US": "How much do you agree?" },
    });
    expect(slider.issues).toEqual([]);

    const star = map("QID4");
    expect(star.elements[0]).toMatchObject({ type: "rating", scale: "star", range: 5 });

    const clamped = mapQsfQuestion(
      {
        ...question(model, "QID4"),
        selector: "HSLIDER",
        configuration: { ...question(model, "QID4").configuration, sliderMax: 8 },
      },
      ctxFor(model)
    );
    expect(clamped.elements[0]).toMatchObject({ scale: "number", range: 7 });
    expect(clamped.issues).toEqual([expect.objectContaining({ code: "type_approximated" })]);
    expectValidElements([...slider.elements, ...star.elements, ...clamped.elements], "en-US");
  });

  test("rank order → ranking; 26 options are cut to 25 with a warning", () => {
    expect(map("QID5").elements[0]).toMatchObject({ type: "ranking" });
    const big = map("QID12");
    expect((big.elements[0].choices as unknown[]).length).toBe(25);
    expect(big.issues).toEqual([
      expect.objectContaining({ code: "choices_truncated", vars: expect.objectContaining({ max: 25 }) }),
    ]);
    expectValidElements([...map("QID5").elements, ...big.elements], "en-US");
  });

  test("descriptive text → optional CTA with stripped HTML; file upload; FORM → one element per field", () => {
    const cta = map("QID6");
    expect(cta.elements[0]).toMatchObject({
      type: "cta",
      required: false,
      buttonExternal: false,
      headline: { "en-US": "Welcome to the advanced section. Item" },
      ctaButtonLabel: { "en-US": "Next" },
    });

    expect(map("QID7").elements[0]).toMatchObject({ type: "fileUpload", allowMultipleFiles: false });

    const form = map("QID8");
    expect(form.elements.map((element) => [element.id, element.headline["en-US"]])).toEqual([
      ["Q8_1", "First name"],
      ["Q8_2", "Last name"],
      ["Q8_3", "Company"],
    ]);
    expect(form.elements[0].subheader).toEqual({ "en-US": "Contact details" });
    expectValidElements([...cta.elements, ...map("QID7").elements, ...form.elements], "en-US");
  });

  test("timing, constant sum and side-by-side are dropped with a named issue", () => {
    for (const [qid, label] of [
      ["QID9", "Timing"],
      ["QID10", "Constant sum"],
      ["QID11", "Side by side"],
    ] as const) {
      const result = map(qid);
      expect(result.elements).toEqual([]);
      expect(result.issues[0]).toMatchObject({
        code: "unsupported_question_type",
        sourceRef: qid,
        vars: { sourceRef: qid, type: label },
      });
    }
  });
});

describe("mapQsfQuestion — edge cases", () => {
  const model = load("simple.qsf");

  test("a long question text is split into headline and subheader with a note", () => {
    const long = {
      ...question(model, "QID3"),
      text: `${"First sentence that is long enough to keep."} ${"more ".repeat(120)}`,
    };
    const { elements, issues } = mapQsfQuestion(long, ctxFor(model));
    expect(elements[0].headline["en-US"]).toBe("First sentence that is long enough to keep.");
    expect((elements[0].subheader as Record<string, string>)["en-US"].startsWith("more")).toBe(true);
    expect(issues).toEqual([expect.objectContaining({ code: "text_truncated" })]);
  });

  test("a choice question with a single option is approximated to open text", () => {
    const one = { ...question(model, "QID1"), choices: question(model, "QID1").choices.slice(0, 1) };
    const { elements, issues } = mapQsfQuestion(one, ctxFor(model));
    expect(elements[0]).toMatchObject({ type: "openText" });
    expect(issues).toEqual([expect.objectContaining({ code: "type_approximated" })]);
  });

  test("an unknown MC selector still maps, with a note; ids never collide", () => {
    const ctx = ctxFor(model);
    const weird = { ...question(model, "QID1"), selector: "XYZ" };
    const first = mapQsfQuestion(weird, ctx);
    const second = mapQsfQuestion(weird, ctx);
    expect(first.issues).toEqual([expect.objectContaining({ code: "type_approximated" })]);
    expect(first.elements[0].id).toBe("Q1");
    expect(second.elements[0].id).toBe("QID1");
  });

  test("char limits map onto charLimit", () => {
    const limited = {
      ...question(model, "QID4"),
      validation: { ...question(model, "QID4").validation, contentType: null, minChars: 10, maxChars: 200 },
    };
    const { elements } = mapQsfQuestion(limited, ctxFor(model));
    expect(elements[0]).toMatchObject({ inputType: "text", charLimit: { enabled: true, min: 10, max: 200 } });
    expectValidElements(elements, "en-US");
  });
});
