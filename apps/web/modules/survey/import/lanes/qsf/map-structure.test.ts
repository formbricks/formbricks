import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { mapEmbeddedDataFieldName } from "./embedded-data";
import { QsfIdRegistry } from "./id-registry";
import { type TQsfQuestionMapping, mapQsfQuestion } from "./map-question";
import { buildQsfDocument } from "./map-structure";
import { parseQsf } from "./parse-qsf";
import type { TQsfSurvey } from "./types";

const FIXTURES = join(__dirname, "__fixtures__");
const WORKSPACE_ID = "clxx1234567890123456789012";

function load(name: string): TQsfSurvey {
  const result = parseQsf(readFileSync(join(FIXTURES, name)));
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

function build(model: TQsfSurvey) {
  const ctx = { defaultLanguageCode: model.defaultLanguageCode, languageCodes: model.languageCodes };
  const registry = new QsfIdRegistry(
    model.embeddedDataFields.map((field) => mapEmbeddedDataFieldName(field).fieldId)
  );
  const mapped = new Map<string, TQsfQuestionMapping>();
  for (const [qid, question] of model.questions) {
    mapped.set(qid, mapQsfQuestion(question, { ...ctx, idRegistry: registry }));
  }
  return buildQsfDocument(model, mapped, ctx);
}

/** Ids are random per build; strip them so the golden compares structure, not cuids. */
function stable(document: Record<string, unknown> | null): unknown {
  return JSON.parse(
    JSON.stringify(document, (key, value: unknown) =>
      key === "id" && typeof value === "string" && /^[a-z0-9]{24}$/.test(value) ? "<cuid>" : value
    )
  );
}

const blocksOf = (document: Record<string, unknown> | null) =>
  (document?.blocks ?? []) as {
    id: string;
    name: string;
    elements: { id: string }[];
    buttonLabel?: Record<string, string>;
  }[];

describe("buildQsfDocument", () => {
  test.each([
    "simple.qsf",
    "multilang-en-de.qsf",
    "pages-and-blocks.qsf",
    "embedded-data.qsf",
    "matrix-slider-ranking.qsf",
    "logic-skip-display-branch.qsf",
  ])("%s builds its golden document", async (name) => {
    const result = build(load(name));
    await expect(
      JSON.stringify({ document: stable(result.document), issues: result.issues }, null, 2)
    ).toMatchFileSnapshot(join(FIXTURES, name.replace(/\.qsf$/, ".document.snap")));
  });

  test("pages become blocks, the flow order wins, randomizers flatten, orphans append, Trash is skipped", () => {
    const result = build(load("pages-and-blocks.qsf"));
    const blocks = blocksOf(result.document);

    expect(blocks.map((block) => block.name)).toEqual([
      "Block B",
      "Block A · Page 1",
      "Block A · Page 2",
      "Not in flow",
    ]);
    expect(blocks.flatMap((block) => block.elements.map((element) => element.id))).toEqual([
      "Q3",
      "Q1",
      "Q2",
      "Q5",
    ]);
    expect(result.qidToBlockId.get("QID4")).toBeUndefined();
    expect(result.issues.map((issue) => issue.code).sort()).toEqual([
      "block_not_in_flow",
      "randomizer_flattened",
      "setting_not_imported",
    ]);
    expect(blocks[0].buttonLabel).toEqual({ "en-US": "Continue" });
    expect(result.issues.find((issue) => issue.code === "setting_not_imported")?.vars).toMatchObject({
      setting: "ProgressBarDisplay",
    });
  });

  test("embedded data becomes hidden fields with normalized ids; reserved names are suffixed", () => {
    const result = build(load("embedded-data.qsf"));

    expect(result.document?.hiddenFields).toEqual({
      enabled: true,
      fieldIds: ["firstname", "store_name", "userid_imported", "plan_tier"],
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "embedded_data_name_refused",
        vars: expect.objectContaining({ name: "userId", renamed: "userid_imported" }),
      })
    );
    expect(result.issues.filter((issue) => issue.code === "field_renamed")).toHaveLength(3);
  });

  test("two languages are declared and every text carries both", () => {
    const result = build(load("multilang-en-de.qsf"));

    expect(result.document?.defaultLanguage).toBe("en-US");
    expect(result.document?.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect((result.document?.metadata as { title: Record<string, string> }).title).toEqual({
      "en-US": "Produktfeedback",
      "de-DE": "Produktfeedback",
    });
    expect((result.document?.endings as { headline: Record<string, string> }[])[0].headline).toEqual({
      "en-US": "Danke! / Thank you!",
      "de-DE": "Danke! / Thank you!",
    });
    expect(prepareV3SurveyCreateInput({ workspaceId: WORKSPACE_ID, ...result.document }).ok).toBe(true);
  });

  test("a leading descriptive text becomes the welcome card and a redirect URL becomes the ending", () => {
    const result = build(load("matrix-slider-ranking.qsf"));

    expect(result.document?.welcomeCard).toMatchObject({
      enabled: true,
      headline: { "en-US": "Welcome to the advanced section. Item" },
    });
    expect(result.document?.endings).toEqual([
      {
        id: result.endingId,
        type: "redirectToUrl",
        url: "https://example.com/thanks",
        label: "Thanks for your feedback",
      },
    ]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "welcome_card_from_descriptive_text", sourceRef: "QID6" })
    );
    expect(blocksOf(result.document)[0].elements.map((element) => element.id)).toEqual(["Q1"]);
    expect(blocksOf(result.document)).toHaveLength(3);
  });

  test("the ending headline comes from the EOS message and validates as a create body", () => {
    const result = build(load("simple.qsf"));

    expect((result.document?.endings as { headline: Record<string, string> }[])[0].headline).toEqual({
      "en-US": "Thank you for your feedback!",
    });
    const preparation = prepareV3SurveyCreateInput({ workspaceId: WORKSPACE_ID, ...result.document });
    expect(preparation.ok, JSON.stringify(preparation.ok ? null : preparation.validation.invalidParams)).toBe(
      true
    );
  });

  test("large-150.qsf builds in under 500 ms and validates", () => {
    const model = load("large-150.qsf");
    const started = performance.now();
    const result = build(model);
    const elapsed = performance.now() - started;

    expect(result.document).not.toBeNull();
    expect(blocksOf(result.document)).toHaveLength(30);
    expect(blocksOf(result.document).flatMap((block) => block.elements).length).toBeGreaterThanOrEqual(135);
    expect(elapsed).toBeLessThan(500);
    expect(prepareV3SurveyCreateInput({ workspaceId: WORKSPACE_ID, ...result.document }).ok).toBe(true);
  });

  test("a file with nothing importable is a fatal nothing_extracted", () => {
    const model = load("simple.qsf");
    const mapped = new Map<string, TQsfQuestionMapping>();
    for (const qid of model.questions.keys()) mapped.set(qid, { elements: [], issues: [], choiceIdMap: {} });

    const result = buildQsfDocument(model, mapped, { defaultLanguageCode: "en-US", languageCodes: [] });
    expect(result.document).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "nothing_extracted" })
    );
  });
});

describe("mapEmbeddedDataFieldName", () => {
  test.each([
    ["firstName", "firstname", false],
    ["Store-Name", "store_name", false],
    ["plan tier", "plan_tier", false],
    ["  __weird__  ", "weird", false],
    ["2024_cohort", "f_2024_cohort", false],
    ["userId", "userid_imported", true],
    ["END", "end_imported", true],
    ["", "field", false],
  ])("%j → %j (refused: %s)", (source, fieldId, refused) => {
    expect(mapEmbeddedDataFieldName(source)).toMatchObject({ fieldId, refused });
  });
});
