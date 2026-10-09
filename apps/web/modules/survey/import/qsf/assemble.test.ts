import { describe, expect, test } from "vitest";
import deDE from "@/locales/de-DE.json";
import { cpuMsSince } from "./__fixtures__/cpu-time";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate } from "./__fixtures__/recorded-plans";
import { planQsfImport } from "./ai-plan";
import { type TQsfDraftElement, assembleQsfDraft, buildHiddenFields, disambiguateLabels } from "./assemble";
import { checkQsfDraft } from "./final-gate";
import { isObjectMemberName } from "./id-registry";
import type { TQsfCheckedPlan } from "./plan-checks";
import type { TQsfIssue, TQsfSurvey } from "./qsf-model";
import { readQsf } from "./read-qsf";
import { sanitizeQsfTexts } from "./sanitize-text";

const WORKSPACE_ID = "clxx1234567890123456789012";

const assembleFixture = async (
  fixture: string,
  options: {
    allowExternalUrls?: boolean;
    excludedRefs?: Set<string>;
    editSurvey?: (survey: TQsfSurvey) => void;
    editPlan?: (plan: TQsfCheckedPlan) => void;
  } = {}
) => {
  const survey = readQsf(loadQsfFixture(fixture));
  options.editSurvey?.(survey);
  const texts = await sanitizeQsfTexts(survey, new AbortController().signal);
  const { plan } = await planQsfImport({
    survey,
    texts,
    generate: recordedGenerate(loadRecordedPlan(fixture)),
    signal: new AbortController().signal,
    deadline: performance.now() + 120_000,
  });
  options.editPlan?.(plan);
  const assembly = await assembleQsfDraft({
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

  test("gives a file with no end message the editor's default ending, and says so", async () => {
    const { document, issues } = await assembleFixture("pages-and-blocks.qsf");

    expect(document.endings).toEqual([
      {
        id: expect.any(String),
        type: "endScreen",
        headline: { "en-US": "Thank you!" },
        subheader: { "en-US": "We appreciate your feedback." },
      },
    ]);
    expect(issues).toContainEqual({ code: "ending_added", severity: "info", params: { subject: "ending" } });
    expect(checkQsfDraft(document)).toEqual([]);
  });

  test("writes the default ending in each language Formbricks has strings for", async () => {
    const { document, issues } = await assembleFixture("multilang-en-de.qsf");

    expect(document.endings).toMatchObject([
      {
        headline: { "en-US": "Thank you!", "de-DE": deDE.templates.default_ending_card_headline },
        subheader: {
          "en-US": "We appreciate your feedback.",
          "de-DE": deDE.templates.default_ending_card_subheader,
        },
      },
    ]);
    expect(document.languages.every((language) => language.enabled)).toBe(true);
    expect(issues.some((issue) => issue.code === "translation_missing")).toBe(false);
  });

  test("leaves the default ending empty in a language Formbricks has no strings for, and turns it off", async () => {
    const withLanguage = (code: string) =>
      assembleFixture("pages-and-blocks.qsf", { editSurvey: (survey) => survey.languages.push(code) });
    const missingIn = (issues: TQsfIssue[]) =>
      Number(issues.find((issue) => issue.code === "translation_missing")?.params?.count);
    const norwegian = await withLanguage("nb-NO");
    const austrian = await withLanguage("de-AT");

    expect(norwegian.document.endings).toMatchObject([
      { headline: { "nb-NO": "" }, subheader: { "nb-NO": "" } },
    ]);
    expect(norwegian.document.languages.find((language) => language.code === "nb-NO")?.enabled).toBe(false);
    // The file's own texts are missing in both languages; only Norwegian also misses the ending's two.
    expect(missingIn(norwegian.issues)).toBe(missingIn(austrian.issues) + 2);
  });

  test("copies every language, leaving a missing translation empty and its language turned off", async () => {
    const { document, issues } = await assembleFixture("labels-and-languages.qsf");
    const q2 = element(document, "Q2");

    expect(document.languages.map((language) => language.code)).toEqual([
      "en-US",
      "de-DE",
      "zh-Hans-CN",
      "zh-Hant-TW",
    ]);
    expect(q2.headline["en-US"]).toBe("Rate each drink");
    expect(q2.headline["zh-Hant-TW"]).toBe("");
    expect(document.languages.find((language) => language.code === "en-US")?.enabled).toBe(true);
    expect(document.languages.find((language) => language.code === "zh-Hant-TW")?.enabled).toBe(false);
    expect(issues).toContainEqual({
      code: "translation_missing",
      severity: "warning",
      params: { language: "zh-Hant-TW", count: 7 },
    });
    expect(checkQsfDraft(document)).toEqual([]);
  });

  test("names the options the AI left out", async () => {
    const { issues } = await assembleFixture("labels-and-languages.qsf", {
      editPlan: (plan) => {
        const q1 = plan.questions.get("QID1");
        // Its two "N/A" choices, the way a plan that left them out would list them.
        if (q1) q1.leftOut = q1.choices.filter((_, index) => index % 2 === 1).map((choice) => choice.key);
      },
    });

    expect(issues).toContainEqual({
      code: "options_left_out",
      severity: "warning",
      questionTag: "Q1",
      questionRef: "QID1",
      params: { count: 2, options: "N/A, N/A" },
    });
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
    expect(issues).toContainEqual({
      code: "choice_label_renamed",
      severity: "info",
      questionTag: "Q1",
      questionRef: "QID1",
    });
  });

  test("numbers a duplicate past any label already taken, until every label is unique", () => {
    const items = ["N/A", "N/A", "N/A (2)", "N/A"].map((text, index) => ({
      id: String(index),
      label: { "en-US": text },
    }));
    const languages = [
      {
        language: {
          id: "en",
          code: "en-US",
          alias: null,
          workspaceId: WORKSPACE_ID,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        default: true,
        enabled: true,
      },
    ];

    expect(disambiguateLabels(items, ["en-US"], languages)).toBe(true);
    const labels = items.map((item) => item.label["en-US"]);
    expect(labels).toEqual(["N/A", "N/A (3)", "N/A (2)", "N/A (4)"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("numbers two hundred repeats of one label in linear time", () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      id: String(index),
      label: { "en-US": index % 2 === 0 ? "Same" : `Same (${index + 2})` },
    }));
    const languages = [
      {
        language: {
          id: "en",
          code: "en-US",
          alias: null,
          workspaceId: WORKSPACE_ID,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        default: true,
        enabled: true,
      },
    ];
    const startedAt = process.cpuUsage();

    expect(disambiguateLabels(items, ["en-US"], languages)).toBe(true);

    expect(cpuMsSince(startedAt)).toBeLessThan(100);
    const labels = items.map((item) => item.label["en-US"]);
    expect(new Set(labels).size).toBe(200);
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
      questionRef: "QID3",
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
      questionRef: "QID5",
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
    // Page p3's branch is reported with its page, on the page's first question.
    expect(lines.map((issue) => issue.questionTag)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q4", "Q6"]);
    expect(lines.find((issue) => issue.questionTag === "Q2")?.params).toBeUndefined();
    expect(JSON.stringify(lines)).not.toContain("Invented rule");
  });

  test("still reports a page's rules when none of its questions was imported", async () => {
    const { issues } = await assembleFixture("logic-skip-display-branch.qsf", {
      // QID4 is page p3's only question, behind the EU branch.
      editPlan: (plan) => plan.questions.delete("QID4"),
    });

    const lines = issues.filter((issue) => issue.code === "logic_not_imported");
    expect(lines.map((issue) => issue.questionTag)).toEqual(["Q1", "Q2", "Q3", "Q6", undefined]);
    expect(lines.at(-1)).toEqual({
      code: "logic_not_imported",
      severity: "warning",
      params: {
        description: "Shown only to respondents who chose 'EU' for 'Which region are you in?'.",
        block: "Compliance",
      },
    });
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

describe("buildHiddenFields", () => {
  const isSafeFieldId = (id: string) => /^[a-z][a-z0-9_]{0,63}$/.test(id);

  test("renames eleven long names sharing their first 56 characters, without spinning", () => {
    // Each is over 64 characters, so each is renamed from the same 56-character stem; the eleventh
    // needs `_field_10`, which used to make every candidate too long to accept.
    const names = Array.from({ length: 11 }, (_, index) => `${"a".repeat(56)}_${"x".repeat(10)}${index}`);
    const startedAt = process.cpuUsage();

    const { fieldIds, issues } = buildHiddenFields(names);

    expect(cpuMsSince(startedAt)).toBeLessThan(100);
    expect(fieldIds.slice(0, 3)).toEqual([
      "a".repeat(56),
      `${"a".repeat(56)}_field`,
      `${"a".repeat(56)}_field_2`,
    ]);
    expect(fieldIds[10]).toBe(`${"a".repeat(55)}_field_10`);
    expect(new Set(fieldIds).size).toBe(11);
    expect(fieldIds.every(isSafeFieldId)).toBe(true);
    expect(issues).toHaveLength(11);
  });

  test("gives two hundred colliding names distinct, valid ids, quickly", () => {
    const names = Array.from({ length: 200 }, (_, index) => `${"Б".repeat(3)}${"b".repeat(70)}${index}`);
    const startedAt = process.cpuUsage();

    const { fieldIds, idByName } = buildHiddenFields(names);

    expect(cpuMsSince(startedAt)).toBeLessThan(200);
    expect(new Set(fieldIds.map((id) => id.toLowerCase())).size).toBe(200);
    expect(fieldIds.every(isSafeFieldId)).toBe(true);
    expect(names.every((name) => idByName.has(name))).toBe(true);
  });

  test("falls back to numbered field ids for names with nothing safe in them", () => {
    const { fieldIds } = buildHiddenFields(["Ωμέγα", "Привет", "field_2"]);

    expect(fieldIds).toEqual(["field_1", "field_2", "field_2_field"]);
  });
});
