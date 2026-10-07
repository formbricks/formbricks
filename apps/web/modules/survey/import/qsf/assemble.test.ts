import { describe, expect, test } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate } from "./__fixtures__/recorded-plans";
import { planQsfImport } from "./ai-plan";
import { type TQsfDraftElement, assembleQsfDraft } from "./assemble";
import { checkQsfDraft } from "./final-gate";
import { isObjectMemberName } from "./id-registry";
import type { TQsfCheckedPlan } from "./plan-checks";
import { readQsf } from "./read-qsf";
import { sanitizeQsfTexts } from "./sanitize-text";

const WORKSPACE_ID = "clxx1234567890123456789012";

const assembleFixture = async (
  fixture: string,
  options: {
    allowExternalUrls?: boolean;
    excludedRefs?: Set<string>;
    editPlan?: (plan: TQsfCheckedPlan) => void;
  } = {}
) => {
  const survey = readQsf(loadQsfFixture(fixture));
  const texts = await sanitizeQsfTexts(survey, new AbortController().signal);
  const { plan } = await planQsfImport({
    survey,
    texts,
    generate: recordedGenerate(loadRecordedPlan(fixture)),
    signal: new AbortController().signal,
    deadline: performance.now() + 120_000,
  });
  options.editPlan?.(plan);
  const assembly = assembleQsfDraft({
    survey,
    texts,
    plan,
    workspaceId: WORKSPACE_ID,
    allowExternalUrls: options.allowExternalUrls ?? true,
    excludedRefs: options.excludedRefs,
  });
  return { survey, ...assembly };
};

const elements = (document: { blocks: { elements: TQsfDraftElement[] }[] }) =>
  document.blocks.flatMap((block) => block.elements);

const element = (document: { blocks: { elements: TQsfDraftElement[] }[] }, id: string) => {
  const found = elements(document).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No element ${id}`);
  return found;
};

describe("assembleQsfDraft", () => {
  test("builds the locale-keyed draft the create takes, ids from export tags", async () => {
    const { document } = await assembleFixture("simple.qsf");

    expect(document).toMatchObject({
      workspaceId: WORKSPACE_ID,
      name: "Customer feedback (imported)",
      type: "link",
      status: "draft",
      defaultLanguage: "en-US",
      languages: [{ code: "en-US", default: true, enabled: true }],
    });
    expect(elements(document).map((draft) => [draft.id, draft.type, draft.isDraft])).toEqual([
      ["Q1", "multipleChoiceSingle", true],
      ["Q2", "nps", true],
      ["Q3", "openText", true],
      ["Q4", "openText", true],
      ["Q5", "multipleChoiceMulti", true],
    ]);
    expect(element(document, "Q1").headline).toEqual({ "en-US": "How did you hear about us?" });
    expect(checkQsfDraft(document)).toEqual([]);
  });

  test("gives the other and none options their fixed ids, last, and generates every other id", async () => {
    const { document } = await assembleFixture("simple.qsf");
    const q1 = element(document, "Q1");
    const q5 = element(document, "Q5");

    if (q1.type !== "multipleChoiceSingle" || q5.type !== "multipleChoiceMulti") throw new Error("types");
    expect(q1.choices.map((choice) => choice.id).at(-1)).toBe("other");
    expect(q5.choices.map((choice) => choice.id).at(-1)).toBe("none");
    // Randomized in Qualtrics, with a special choice that has to stay last.
    expect(q5.shuffleOption).toBe("exceptLast");
    const generated = [...q1.choices, ...q5.choices].filter(
      (choice) => !["other", "none"].includes(choice.id)
    );
    expect(generated.every((choice) => /^[a-z0-9]{24,}$/.test(choice.id))).toBe(true);
  });

  test("copies every language, falling back to the default text where a translation is missing", async () => {
    const { document, issues } = await assembleFixture("labels-and-languages.qsf");
    const q2 = element(document, "Q2");

    expect(document.languages.map((language) => language.code)).toEqual([
      "en-US",
      "de-DE",
      "zh-Hans-CN",
      "zh-Hant-TW",
    ]);
    expect(q2.headline["zh-Hant-TW"]).toBe("Rate each drink");
    expect(issues).toContainEqual({
      code: "translation_fallback",
      severity: "warning",
      params: { language: "zh-Hant-TW", count: 7 },
    });
    expect(checkQsfDraft(document)).toEqual([]);
  });

  test("numbers duplicate labels per language, so the survey service accepts them", async () => {
    const { document, issues } = await assembleFixture("labels-and-languages.qsf");
    const q1 = element(document, "Q1");

    if (q1.type !== "multipleChoiceSingle") throw new Error("type");
    expect(q1.choices.map((choice) => choice.label["en-US"])).toEqual(["Tea", "N/A", "Coffee", "N/A (2)"]);
    expect(q1.choices.map((choice) => choice.label["de-DE"])).toEqual([
      "Tee",
      "k. A.",
      "Kaffee",
      "k. A. (2)",
    ]);
    // Distinct in Chinese already: left alone.
    expect(q1.choices.map((choice) => choice.label["zh-Hans-CN"])).toEqual(["茶", "不适用", "咖啡", "无"]);
    expect(issues).toContainEqual({ code: "choice_label_renamed", severity: "info", questionTag: "Q1" });
  });

  test("pipes earlier answers and hidden fields in as recall, and removes what has no equivalent", async () => {
    const { document, issues } = await assembleFixture("rich-text.qsf");

    expect(element(document, "Q_hello").headline["en-US"]).toContain("#recall:Q1/fallback:...#");
    // QID4 is later than QID3 and in the same block: removed, as is the `lm://` pipe. The recall token
    // the file wrote itself is broken up.
    expect(element(document, "Q3").headline["en-US"]).toBe(
      "\uFF1Cimg src=x onerror=alert(1)> is what you typed, # recall:QID1/fallback:x#"
    );
    expect(element(document, "Q4").headline["en-US"]).toBe(
      "Hello #recall:userid_field/fallback:...#, how are you?"
    );
    expect(issues).toContainEqual({
      code: "piped_text_removed",
      severity: "warning",
      questionTag: "Q3",
      params: { count: 2 },
    });
    expect(checkQsfDraft(document)).toEqual([]);
  });

  test("stands the export tag in for a headline left empty, and says so", async () => {
    const { document, issues } = await assembleFixture("rich-text.qsf");

    expect(element(document, "Q_image_only").headline).toEqual({ "en-US": "Q_image_only" });
    expect(issues).toContainEqual({
      code: "headline_fallback",
      severity: "warning",
      questionTag: "Q_image_only",
    });
  });

  test("keeps the redirect only when the organization may use external URLs", async () => {
    const allowed = await assembleFixture("rich-text.qsf", { allowExternalUrls: true });
    const refused = await assembleFixture("rich-text.qsf", { allowExternalUrls: false });

    expect(allowed.document.endings).toEqual([
      {
        id: expect.any(String),
        type: "redirectToUrl",
        url: "https://example.com/thanks",
        label: "example.com",
      },
    ]);
    // Without it, the message stands in, and the user is told the link went.
    expect(refused.document.endings).toEqual([
      { id: expect.any(String), type: "endScreen", headline: { "en-US": "<p>Thanks for taking part!</p>" } },
    ]);
    expect(refused.issues).toContainEqual({ code: "external_url_removed", severity: "warning" });
    expect(checkQsfDraft(refused.document)).toEqual([]);
  });

  test("renames embedded data names Formbricks refuses, and recalls them under the new name", async () => {
    const { document, issues } = await assembleFixture("embedded-data.qsf");

    expect(document.hiddenFields).toEqual({
      enabled: true,
      fieldIds: ["firstname", "store_name", "userid_field", "plan_tier"],
    });
    expect(issues).toContainEqual({
      code: "field_renamed",
      severity: "warning",
      params: { from: "userId", to: "userid_field" },
    });
    expect(element(document, "Q1").headline["en-US"]).toBe(
      "Hello #recall:firstname/fallback:...#, how was your visit to #recall:store_name/fallback:...#?"
    );
  });

  test("never hands out an Object.prototype name as an element or hidden field id", async () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort();

    const { document } = await assembleFixture("pollution.qsf");

    const ids = [...elements(document).map((draft) => draft.id), ...document.hiddenFields.fieldIds];
    expect(ids.filter((id) => isObjectMemberName(id))).toEqual([]);
    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
    expect(checkQsfDraft(document)).toEqual([]);
  });

  test("reports one line per logic rule: the AI can neither hide a rule nor add one", async () => {
    const { issues } = await assembleFixture("logic-skip-display-branch.qsf", {
      editPlan: (plan) => {
        // No note for QID2's rule, and an invented one on QID5, which has none.
        const qid2 = plan.questions.get("QID2");
        const qid5 = plan.questions.get("QID5");
        if (qid2) qid2.notes = [];
        if (qid5) qid5.notes = ["Invented rule"];
      },
    });

    const lines = issues.filter((issue) => issue.code === "logic_not_imported");
    expect(lines.map((issue) => issue.questionTag)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q6", "Q4"]);
    expect(lines.find((issue) => issue.questionTag === "Q2")?.params).toBeUndefined();
    expect(JSON.stringify(lines)).not.toContain("Invented rule");
  });

  test("leaves out questions the final gate refused", async () => {
    const { document, elementRefs } = await assembleFixture("simple.qsf", {
      excludedRefs: new Set(["QID2"]),
    });

    expect(elements(document).map((draft) => draft.id)).toEqual(["Q1", "Q3", "Q4", "Q5"]);
    expect(elementRefs).toEqual([["QID1", "QID3", "QID4", "QID5"]]);
  });

  test("builds a CTA without a button, and every element with only the keys its type allows", async () => {
    const { document } = await assembleFixture("matrix-slider-ranking.qsf");

    expect(element(document, "Q6")).toEqual({
      id: "Q6",
      type: "cta",
      headline: { "en-US": "<p>Welcome to the <em>advanced</em> section.</p><ul><li>Item</li></ul>" },
      required: false,
      isDraft: true,
      buttonExternal: false,
    });
    expect(element(document, "Q8")).toMatchObject({
      type: "contactInfo",
      firstName: { show: true, placeholder: { "en-US": "First name" } },
      email: { show: false, placeholder: { "en-US": "" } },
    });
    expect(checkQsfDraft(document)).toEqual([]);
  });
});
