import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { normalizeQualtricsLanguageCode } from "./language-codes";
import { parseQsf } from "./parse-qsf";
import type { TQsfSurvey } from "./types";

const FIXTURES = join(__dirname, "__fixtures__");
const read = (name: string) => readFileSync(join(FIXTURES, name));

/** The model with its `Map` flattened, so it can be compared to a committed golden file. */
const toGolden = (model: TQsfSurvey) => ({
  ...model,
  questions: Object.fromEntries(model.questions),
});

function parseFixture(name: string): TQsfSurvey {
  const result = parseQsf(read(name));
  if (!result.ok) throw new Error(`${name} failed to parse: ${JSON.stringify(result.error)}`);
  return result.data;
}

const GOLDEN_FIXTURES = [
  "simple.qsf",
  "multilang-en-de.qsf",
  "logic-skip-display-branch.qsf",
  "matrix-slider-ranking.qsf",
  "pages-and-blocks.qsf",
  "embedded-data.qsf",
  "legacy-object-payload.qsf",
];

describe("parseQsf", () => {
  test.each(GOLDEN_FIXTURES)("%s parses to its golden model", async (name) => {
    const model = parseFixture(name);
    await expect(JSON.stringify(toGolden(model), null, 2)).toMatchFileSnapshot(
      join(FIXTURES, name.replace(/\.qsf$/, ".expected.json"))
    );
  });

  test("reads questions, choices in order, validation, configuration and translations", () => {
    const model = parseFixture("simple.qsf");

    expect(model.name).toBe("Customer feedback");
    expect(model.defaultLanguageCode).toBe("en-US");
    expect(model.languageCodes).toEqual([]);
    expect([...model.questions.keys()]).toEqual(["QID1", "QID2", "QID3", "QID4", "QID5"]);

    const first = model.questions.get("QID1")!;
    expect(first).toMatchObject({ type: "MC", selector: "SAVR", subSelector: "TX", exportTag: "Q1" });
    expect(first.validation.forceResponse).toBe("ON");
    expect(first.choices.map((choice) => [choice.id, choice.display, choice.textEntry])).toEqual([
      ["1", "Search engine", false],
      ["2", "A friend", false],
      ["3", "Other", true],
    ]);

    const email = model.questions.get("QID4")!;
    expect(email.validation).toEqual({
      forceResponse: "REQUEST",
      contentType: "ValidEmail",
      minChars: null,
      maxChars: null,
    });
    expect(model.questions.get("QID5")!.randomization).toMatchObject({ type: "All" });
    expect(model.options.eosMessage).toBe("Thank you for your feedback!");
    expect(model.options.eosRedirectUrl).toBeNull();
    expect(model.blocks).toHaveLength(1);
    expect(model.flow.map((node) => node.type)).toEqual(["Block", "EndSurvey"]);
  });

  test("normalizes translation codes and lists the extra languages", () => {
    const model = parseFixture("multilang-en-de.qsf");

    expect(model.languageCodes).toEqual(["de-DE"]);
    const matrix = model.questions.get("QID3")!;
    expect(matrix.translations["de-DE"]).toEqual({
      text: "Bewerten Sie diese Aussagen",
      choices: { "1": "Einfach zu bedienen", "2": "Gutes Preis-Leistungs-Verhältnis" },
      answers: { "1": "Stimme zu", "2": "Neutral", "3": "Stimme nicht zu" },
    });
    expect(matrix.answers.map((answer) => answer.display)).toEqual(["Agree", "Neutral", "Disagree"]);
  });

  test("keeps raw skip, display and branch logic for the describer", () => {
    const model = parseFixture("logic-skip-display-branch.qsf");

    expect(model.questions.get("QID1")!.skipLogic).toEqual([
      expect.objectContaining({ Condition: "Selected", SkipToDestination: "ENDOFSURVEY" }),
    ]);
    expect(model.questions.get("QID2")!.displayLogic).toMatchObject({ Type: "BooleanExpression" });
    const branch = model.flow.find((node) => node.type === "Branch");
    expect(branch).toMatchObject({
      type: "Branch",
      description: "EU branch",
      children: [{ type: "Block", id: "BL_2" }],
    });
    expect(model.embeddedDataFields).toEqual(["region"]);
  });

  test("reads pages, block types and flow order; a Trash block is kept for the mapper to skip", () => {
    const model = parseFixture("pages-and-blocks.qsf");

    expect(model.blocks.map((block) => [block.id, block.type, block.elements.length])).toEqual([
      ["BL_a", "Default", 3],
      ["BL_b", "Standard", 1],
      ["BL_orphan", "Standard", 1],
      ["BL_trash", "Trash", 1],
    ]);
    expect(model.blocks[0].elements[1]).toEqual({ kind: "pageBreak" });
    expect(model.flow.map((node) => node.type)).toEqual(["Block", "BlockRandomizer", "EndSurvey"]);
    expect(model.options).toMatchObject({
      nextButtonLabel: "Continue",
      previousButtonLabel: "Back",
      backButton: true,
      progressBar: "Text",
    });
  });

  test("collects embedded data fields from the flow", () => {
    const model = parseFixture("embedded-data.qsf");
    expect(model.embeddedDataFields).toEqual(["firstName", "Store-Name", "userId", "plan tier"]);
  });

  test("handles the legacy object-keyed BL payload and lists unknown elements without failing", () => {
    const model = parseFixture("legacy-object-payload.qsf");

    expect(model.defaultLanguageCode).toBe("de-DE");
    expect(model.blocks).toEqual([
      expect.objectContaining({
        id: "BL_1",
        elements: [
          { kind: "question", qid: "QID1" },
          { kind: "question", qid: "QID2" },
        ],
      }),
    ]);
    expect(model.flow.map((node) => node.type)).toEqual(["Block", "Unknown", "EndSurvey"]);
    expect(model.issues.map((issue) => [issue.code, issue.vars?.type])).toEqual([
      ["unknown_element", "WebService"],
      ["unknown_element", "XYZ"],
    ]);
    expect(model.issues.every((issue) => issue.severity === "info")).toBe(true);
  });

  test("returns issues, not a throw, for broken JSON and for JSON that is not a QSF", () => {
    const broken = parseQsf(read("invalid.qsf"));
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error[0]).toMatchObject({ severity: "error", code: "invalid_document" });

    const notQsf = parseQsf(read("not-a-qsf.json"));
    expect(notQsf.ok).toBe(false);
    if (!notQsf.ok) expect(notQsf.error[0].message).toContain("SurveyEntry");

    expect(parseQsf(`\uFEFF${read("simple.qsf").toString("utf8")}`).ok).toBe(true);
  });

  test("parses the 150-question fixture in under 200 ms", () => {
    const bytes = read("large-150.qsf");
    const started = performance.now();
    const model = parseFixture("large-150.qsf");
    const elapsed = performance.now() - started;

    expect(model.questions.size).toBe(150);
    expect(model.blocks).toHaveLength(10);
    expect(bytes.byteLength).toBeGreaterThan(100_000);
    expect(elapsed).toBeLessThan(200);
  });
});

describe("normalizeQualtricsLanguageCode", () => {
  test.each([
    ["EN", "en-US"],
    ["en", "en-US"],
    ["EN-GB", "en-GB"],
    ["DE", "de-DE"],
    ["FR-CA", "fr-CA"],
    ["ES-419", "es-419"],
    ["PT-BR", "pt-BR"],
    ["ZH-S", "zh-Hans-CN"],
    ["ZH-T", "zh-Hant-TW"],
    ["JA", "ja-JP"],
    ["pt_BR", "pt-BR"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeQualtricsLanguageCode(raw)).toEqual({ ok: true, code: expected });
  });

  test("unknown codes are reported, not guessed", () => {
    expect(normalizeQualtricsLanguageCode("XX")).toEqual({ ok: false, raw: "XX" });
    expect(normalizeQualtricsLanguageCode("  ")).toEqual({ ok: false, raw: "  " });
  });
});
