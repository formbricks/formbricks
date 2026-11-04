import { describe, expect, test } from "vitest";
import type { TSurveyImportDraft } from "../core/draft";
import { checkImportDraft } from "../core/final-gate";
import { SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION } from "../limits";
import { assembleDocumentDraft } from "./assemble";
import type {
  TDocumentLanguages,
  TDocumentPlannedEntry,
  TDocumentPlannedOption,
  TDocumentText,
} from "./plan-checks";
import type { TDocumentPlanRule } from "./plan-schema";

const WORKSPACE_ID = "clxx1234567890123456789012";

const languagesOf = (...codes: string[]): TDocumentLanguages => ({
  defaultLanguage: codes[0],
  codes,
  byPlanCode: new Map(codes.map((code) => [code, code])),
});
const ENGLISH = languagesOf("en-US");
const BILINGUAL = languagesOf("en-US", "de-DE");

/** A text in English, and in German when given. */
const text = (english: string, german?: string): TDocumentText =>
  new Map(
    german === undefined
      ? [["en-US", english]]
      : [
          ["en-US", english],
          ["de-DE", german],
        ]
  );

const option = (
  english: string,
  { code = null, isOther = false, german }: { code?: string | null; isOther?: boolean; german?: string } = {}
): TDocumentPlannedOption => ({ code, isOther, text: text(english, german) });

/** A checked entry as `plan-checks.ts` hands it over: an open question unless `fields` say otherwise. */
const entry = (ref: string, fields: Partial<TDocumentPlannedEntry> = {}): TDocumentPlannedEntry => ({
  ref,
  kind: "openText",
  label: null,
  section: null,
  required: false,
  headline: text(`Question on ${ref}`),
  subheader: null,
  options: [],
  columns: [],
  lowerLabel: null,
  upperLabel: null,
  dropdown: false,
  inputType: "text",
  scale: "number",
  range: null,
  format: "M-d-y",
  rules: [],
  notes: [],
  cells: new Set(),
  unsplitCell: null,
  ...fields,
});

const yesNo = (ref: string, label: string, fields: Partial<TDocumentPlannedEntry> = {}) =>
  entry(ref, {
    kind: "multipleChoiceSingle",
    label,
    options: [option("Yes", { code: "1" }), option("No", { code: "2" })],
    ...fields,
  });

const rule = (
  fields: Partial<TDocumentPlanRule> & Pick<TDocumentPlanRule, "question">
): TDocumentPlanRule => ({
  kind: "skipTo",
  operator: "equals",
  values: [],
  target: null,
  ...fields,
});

const assemble = (
  entries: TDocumentPlannedEntry[],
  params: Partial<Parameters<typeof assembleDocumentDraft>[0]> = {}
) =>
  assembleDocumentDraft({
    entries,
    languages: ENGLISH,
    name: "Visitor survey",
    workspaceId: WORKSPACE_ID,
    signal: new AbortController().signal,
    ...params,
  });

type TElement = Record<string, unknown> & { id: string; type: string };
type TChoice = { id: string; label: Record<string, string> };
type TCondition = {
  id: string;
  connector?: string;
  conditions?: TCondition[];
  leftOperand?: { value: string };
  operator?: string;
  rightOperand?: { value: unknown };
};

const elementsOf = (document: TSurveyImportDraft) =>
  document.blocks.flatMap((block) => block.elements) as unknown as TElement[];

const elementById = (document: TSurveyImportDraft, id: string): TElement => {
  const found = elementsOf(document).find((element) => element.id === id);
  if (!found) throw new Error(`No element ${id}`);
  return found;
};

/** Where a logic action jumps, or `undefined` for an action that does not jump. */
const jumpTarget = (action: { objective: string; target?: string }): string | undefined =>
  action.objective === "jumpToBlock" ? action.target : undefined;

const blockOf = (document: TSurveyImportDraft, id: string) => {
  const index = document.blocks.findIndex((block) => block.elements.some((element) => element.id === id));
  return { index, block: document.blocks[index] };
};

const choiceId = (document: TSurveyImportDraft, elementId: string, label: string): string | undefined =>
  (elementById(document, elementId).choices as TChoice[]).find((choice) => choice.label["en-US"] === label)
    ?.id;

/** A rule's conditions, flattened to `[element, operator, value]` (a nested group as a list of those). */
const conditionsOf = (logic: { conditions: unknown }): unknown[] =>
  ((logic.conditions as TCondition).conditions ?? []).map((condition) =>
    condition.conditions
      ? [
          condition.connector,
          condition.conditions.map((inner) => [inner.operator, inner.rightOperand?.value]),
        ]
      : [condition.leftOperand?.value, condition.operator, condition.rightOperand?.value]
  );

const issueCodes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

const logicIssues = (issues: { code: string; questionTag?: string }[]) =>
  issues
    .filter((issue) => issue.code === "logic_imported" || issue.code === "logic_not_imported")
    .map((issue) => [issue.questionTag, issue.code]);

describe("assembleDocumentDraft: texts", () => {
  test("copies every text in every language as the checked plan holds it, and the draft passes the create's checks", async () => {
    const { document, issues } = await assemble(
      [
        entry("R2", {
          kind: "multipleChoiceSingle",
          label: "Q1",
          headline: text("Which day did you visit?", "An welchem Tag waren Sie da?"),
          subheader: text("Pick one.", "Wählen Sie einen."),
          options: [option("Monday", { german: "Montag" }), option("Tuesday", { german: "Dienstag" })],
        }),
      ],
      { languages: BILINGUAL }
    );

    const element = elementById(document, "Q1");
    expect(element.headline).toEqual({
      "en-US": "Which day did you visit?",
      "de-DE": "An welchem Tag waren Sie da?",
    });
    expect(element.subheader).toEqual({ "en-US": "Pick one.", "de-DE": "Wählen Sie einen." });
    expect((element.choices as TChoice[]).map((choice) => choice.label)).toEqual([
      { "en-US": "Monday", "de-DE": "Montag" },
      { "en-US": "Tuesday", "de-DE": "Dienstag" },
    ]);
    expect(document.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(document).toMatchObject({
      name: "Visitor survey",
      workspaceId: WORKSPACE_ID,
      defaultLanguage: "en-US",
      type: "link",
      status: "draft",
    });
    expect(issueCodes(issues)).not.toContain("translation_missing");
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("a text missing in a language leaves it empty, turns the language off and counts it", async () => {
    const { document, issues } = await assemble(
      [
        entry("R2", { headline: text("How old are you?", "Wie alt sind Sie?") }),
        entry("R3", { headline: text("Anything else?") }),
        entry("R4", { headline: text("Your name?") }),
      ],
      { languages: BILINGUAL }
    );

    expect(elementsOf(document)[1].headline).toEqual({ "en-US": "Anything else?", "de-DE": "" });
    expect(document.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: false },
    ]);
    expect(issues).toContainEqual({
      code: "translation_missing",
      severity: "warning",
      params: { language: "de-DE", count: 2 },
    });
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("keeps at most the languages a survey can hold", async () => {
    const codes = Array.from({ length: 52 }, (_, index) => `x${index}`);
    const { document } = await assemble([entry("R2")], { languages: languagesOf(...codes) });

    expect(document.languages).toHaveLength(50);
    expect(document.languages.at(-1)?.code).toBe("x49");
  });

  test("reports a question whose cell could not be split, by its label", async () => {
    const { issues } = await assemble([entry("R2", { label: "Q1", unsplitCell: "B2" })]);

    expect(issues).toContainEqual({
      code: "text_not_split",
      severity: "warning",
      questionTag: "Q1",
      questionRef: "R2",
      params: { cell: "B2" },
    });
  });

  test("a script in a cell is dropped like any imported text's, reported by the question's label", async () => {
    const { document, issues } = await assemble([
      entry("R2", { label: "Q1", headline: text("Your name?<script>alert(1)</script>") }),
      entry("R3", { headline: text("Your age?<script>alert(2)</script>") }),
    ]);

    expect(elementsOf(document).map((element) => element.headline)).toEqual([
      { "en-US": "Your name?" },
      { "en-US": "Your age?" },
    ]);
    expect(issues.filter((issue) => issue.code === "script_dropped")).toEqual([
      { code: "script_dropped", severity: "warning", questionTag: "Q1", questionRef: "R2" },
      { code: "script_dropped", severity: "warning", questionTag: "R3", questionRef: "R3" },
    ]);
  });
});

describe("assembleDocumentDraft: elements", () => {
  test("each planned kind becomes its Formbricks element", async () => {
    const scale = { lowerLabel: text("Poor"), upperLabel: text("Excellent") };
    const { document } = await assemble([
      entry("R1", { label: "open", inputType: "email" }),
      entry("R2", { label: "long", inputType: "text" }),
      yesNo("R3", "single", { dropdown: true }),
      entry("R4", {
        kind: "multipleChoiceMulti",
        label: "multi",
        options: [option("Email"), option("SMS")],
      }),
      entry("R5", { kind: "ranking", label: "rank", options: [option("Price"), option("Speed")] }),
      entry("R6", {
        kind: "matrix",
        label: "grid",
        options: [option("Staff")],
        columns: [option("Poor"), option("Good")],
      }),
      entry("R7", { kind: "nps", label: "nps", ...scale }),
      entry("R8", { kind: "rating", label: "stars", scale: "star", range: 7, ...scale }),
      entry("R9", { kind: "csat", label: "csat", scale: "smiley", range: null }),
      entry("R10", { kind: "ces", label: "ces", range: 7 }),
      entry("R11", { kind: "date", label: "when", format: "y-M-d" }),
      entry("R12", { kind: "fileUpload", label: "file" }),
      entry("R13", { kind: "consent", label: "agree", subheader: text("I agree to the terms.") }),
      entry("R14", { kind: "consent", label: "agree2", headline: text("I agree.") }),
      entry("R15", { kind: "cta", label: "note" }),
    ]);

    const byId = new Map(elementsOf(document).map((element) => [element.id, element]));
    expect(byId.get("open")).toMatchObject({ type: "openText", inputType: "email", longAnswer: false });
    expect(byId.get("long")).toMatchObject({ type: "openText", inputType: "text", longAnswer: true });
    expect(byId.get("single")).toMatchObject({ type: "multipleChoiceSingle", displayType: "dropdown" });
    expect(byId.get("multi")).toMatchObject({ type: "multipleChoiceMulti", displayType: "list" });
    expect(byId.get("rank")).toMatchObject({ type: "ranking", shuffleOption: "none" });
    expect(byId.get("grid")).toMatchObject({
      type: "matrix",
      rows: [{ label: { "en-US": "Staff" } }],
      columns: [{ label: { "en-US": "Poor" } }, { label: { "en-US": "Good" } }],
    });
    expect(byId.get("nps")).toMatchObject({
      type: "nps",
      lowerLabel: { "en-US": "Poor" },
      upperLabel: { "en-US": "Excellent" },
    });
    expect(byId.get("stars")).toMatchObject({ type: "rating", scale: "star", range: 7 });
    // A scale with no range planned gets five points.
    expect(byId.get("csat")).toMatchObject({ type: "csat", scale: "smiley", range: 5 });
    expect(byId.get("csat")).not.toHaveProperty("lowerLabel");
    expect(byId.get("ces")).toMatchObject({ type: "ces", range: 7 });
    expect(byId.get("when")).toMatchObject({ type: "date", format: "y-M-d" });
    expect(byId.get("file")).toMatchObject({ type: "fileUpload", allowMultipleFiles: false });
    // The text to agree to is the checkbox's label, not a description above it as well.
    expect(byId.get("agree")).toMatchObject({ type: "consent", label: { "en-US": "I agree to the terms." } });
    expect(byId.get("agree")).not.toHaveProperty("subheader");
    expect(byId.get("agree2")).toMatchObject({ type: "consent", label: { "en-US": "I agree." } });
    expect(byId.get("note")).toMatchObject({ type: "cta", buttonExternal: false });
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("keeps a question's required flag, and names elements by the file's IDs, else in order", async () => {
    const { document, elementRefs } = await assemble([
      entry("R2", { label: "VIS01", required: true }),
      entry("R3"),
      entry("R4", { label: "VIS01" }),
    ]);

    const elements = elementsOf(document);
    expect(elements.map((element) => element.required)).toEqual([true, false, false]);
    expect(elements[0].id).toBe("VIS01");
    expect(elements[1].id).toBe("q2");
    expect(new Set(elements.map((element) => element.id)).size).toBe(3);
    expect(elementRefs.flat()).toEqual(["R2", "R3", "R4"]);
  });

  test("puts an 'Other' choice last under its fixed id, and routing still finds it by its place in the file", async () => {
    const { document, issues } = await assemble([
      entry("R2", {
        kind: "multipleChoiceSingle",
        label: "Q1",
        options: [option("Other", { isOther: true, code: "9" }), option("Red"), option("Blue")],
      }),
      entry("R3", { label: "Q2", rules: [rule({ question: "Q1", values: ["9"], target: "Q3" })] }),
      entry("R4", { label: "Q3" }),
    ]);

    const choices = elementById(document, "Q1").choices as TChoice[];
    expect(choices.map((choice) => [choice.id === "other", choice.label["en-US"]])).toEqual([
      [false, "Red"],
      [false, "Blue"],
      [true, "Other"],
    ]);
    const logic = blockOf(document, "Q2").block.logic ?? [];
    expect(conditionsOf(logic[0])).toEqual([["Q1", "equals", "other"]]);
    expect(logicIssues(issues)).toEqual([["Q2", "logic_imported"]]);
  });

  test("ranks keep no 'Other', and a choice question keeps at most the options one question takes", async () => {
    const many = Array.from({ length: SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION + 5 }, (_, index) =>
      option(`Option ${index + 1}`)
    );
    const { document } = await assemble([
      entry("R2", { kind: "multipleChoiceMulti", label: "many", options: many }),
      entry("R3", {
        kind: "ranking",
        label: "rank",
        options: [option("Other", { isOther: true }), option("Price")],
      }),
    ]);

    expect(elementById(document, "many").choices).toHaveLength(SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION);
    expect((elementById(document, "rank").choices as TChoice[]).map((choice) => choice.id)).not.toContain(
      "other"
    );
  });

  test("makes two choices with one label distinct, and says so", async () => {
    const { document, issues } = await assemble([
      entry("R2", { kind: "multipleChoiceSingle", label: "Q1", options: [option("Yes"), option("Yes")] }),
    ]);

    const labels = (elementById(document, "Q1").choices as TChoice[]).map((choice) => choice.label["en-US"]);
    expect(new Set(labels).size).toBe(2);
    expect(issues).toContainEqual({
      code: "choice_label_renamed",
      severity: "info",
      questionTag: "Q1",
      questionRef: "R2",
    });
  });

  test("leaves out the entries the final gate refused", async () => {
    const { document, elementRefs } = await assemble(
      [entry("R2", { label: "Q1" }), entry("R3", { label: "Q2" })],
      { excludedRefs: new Set(["R2"]) }
    );

    expect(elementsOf(document).map((element) => element.id)).toEqual(["Q2"]);
    expect(elementRefs).toEqual([["R3"]]);
  });
});

describe("assembleDocumentDraft: welcome and endings", () => {
  test("an introduction becomes the welcome card and closing texts the endings, in every language", async () => {
    const { document, issues } = await assemble(
      [
        entry("R1", {
          kind: "welcome",
          headline: text("Welcome", "Willkommen"),
          subheader: text("Hi", "Hallo"),
        }),
        entry("R2", { headline: text("How are you?", "Wie geht's?") }),
        entry("R3", {
          kind: "ending",
          headline: text("Thank you!", "Danke!"),
          subheader: text("Bye", "Tschüss"),
        }),
      ],
      { languages: BILINGUAL }
    );

    expect(document.welcomeCard).toEqual({
      enabled: true,
      headline: { "en-US": "Welcome", "de-DE": "Willkommen" },
      subheader: { "en-US": "Hi", "de-DE": "Hallo" },
    });
    expect(elementsOf(document)).toHaveLength(1);
    expect(document.endings).toEqual([
      {
        id: expect.any(String),
        type: "endScreen",
        headline: { "en-US": "Thank you!", "de-DE": "Danke!" },
        subheader: { "en-US": "Bye", "de-DE": "Tschüss" },
      },
    ]);
    expect(issueCodes(issues)).not.toContain("ending_added");
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("a file with no closing text gets the editor's default ending in each language, reported", async () => {
    const { document, issues } = await assemble(
      [entry("R2", { headline: text("How are you?", "Wie geht's?") })],
      {
        languages: BILINGUAL,
      }
    );

    expect(document).not.toHaveProperty("welcomeCard");
    expect(document.endings).toHaveLength(1);
    const [ending] = document.endings as {
      headline: Record<string, string>;
      subheader: Record<string, string>;
    }[];
    expect(ending.headline["en-US"]).not.toBe("");
    expect(ending.headline["de-DE"]).not.toBe("");
    expect(ending.headline["de-DE"]).not.toBe(ending.headline["en-US"]);
    expect(issues).toContainEqual({ code: "ending_added", severity: "info", params: { subject: "ending" } });
  });

  test("a default ending has no text in a language Formbricks has no strings for", async () => {
    const { document } = await assemble(
      [
        entry("R2", {
          headline: new Map([
            ["en-US", "Hi"],
            ["tlh", "nuqneH"],
          ]),
        }),
      ],
      {
        languages: languagesOf("en-US", "tlh"),
      }
    );

    const [ending] = document.endings as { headline: Record<string, string> }[];
    expect(ending.headline.tlh).toBe("");
    expect(ending.headline["en-US"]).not.toBe("");
  });
});

describe("assembleDocumentDraft: blocks", () => {
  test("consecutive questions of one section share a block named after it; others are blocks of their own", async () => {
    const { document } = await assemble([
      entry("R2", { label: "A1", section: "About you" }),
      entry("R3", { label: "A2", section: "About you" }),
      entry("R4", { label: "B1" }),
      entry("R5", { label: "B2" }),
      entry("R6", { label: "C1", section: "Visit" }),
    ]);

    expect(document.blocks.map((block) => [block.name, block.elements.map((element) => element.id)])).toEqual(
      [
        ["About you", ["A1", "A2"]],
        ["Block 2", ["B1"]],
        ["Block 3", ["B2"]],
        ["Visit", ["C1"]],
      ]
    );
  });

  test("a section split by routing keeps its name on every part, numbered", async () => {
    const { document } = await assemble([
      yesNo("R2", "J1", { section: "Journey" }),
      entry("R3", {
        label: "J2",
        section: "Journey",
        rules: [rule({ kind: "showIf", question: "J1", values: ["Yes"] })],
      }),
      entry("R4", { label: "J3", section: "Journey" }),
    ]);

    expect(document.blocks.map((block) => block.name)).toEqual(["Journey", "Journey (2)", "Journey (3)"]);
  });
});

describe("assembleDocumentDraft: skips", () => {
  const skipping = (sourceFields: Partial<TDocumentPlannedEntry>, skip: Partial<TDocumentPlanRule>) => [
    entry("R2", { label: "Q1", ...sourceFields }),
    entry("R3", {
      label: "Q2",
      rules: [rule({ question: "Q1", target: "Q4", ...skip })],
      notes: ["If No, go to Q4."],
    }),
    entry("R4", { label: "Q3" }),
    entry("R5", { label: "Q4" }),
  ];

  test("a jump becomes logic on its question's block, to the target's block, reported for checking", async () => {
    const { document, issues, ruleOwners } = await assemble(
      skipping(yesNo("R2", "Q1"), { values: ["No"] }) // by the option's text
    );

    const source = blockOf(document, "Q2");
    const target = blockOf(document, "Q4");
    expect(source.block.logic).toHaveLength(1);
    // The rule is Q2's: it goes with Q2 if the draft must be cut.
    expect(ruleOwners?.get(source.block.logic![0].id)).toEqual(["R3"]);
    expect(conditionsOf(source.block.logic![0])).toEqual([["Q1", "equals", choiceId(document, "Q1", "No")]]);
    expect(source.block.logic![0].actions).toEqual([
      { id: expect.any(String), objective: "jumpToBlock", target: target.block.id },
    ]);
    // The question jumped to starts its own block, so the jump skips only what lies between.
    expect(target.block.elements.map((element) => element.id)).toEqual(["Q4"]);
    expect(issues).toContainEqual({
      code: "logic_imported",
      severity: "warning",
      questionTag: "Q2",
      questionRef: "R3",
      params: { description: "If No, go to Q4." },
    });
    expect(checkImportDraft(document)).toEqual([]);
  });

  test.each([
    ["equals, by code", "multipleChoiceSingle", "equals", ["2"], [["Q1", "equals", ["No"]]]],
    [
      "isAnyOf, by code and text",
      "multipleChoiceSingle",
      "isAnyOf",
      ["1", "no"],
      [["Q1", "equalsOneOf", ["Yes", "No"]]],
    ],
    ["doesNotEqual one", "multipleChoiceSingle", "doesNotEqual", ["Yes"], [["Q1", "doesNotEqual", ["Yes"]]]],
    ["multi equals", "multipleChoiceMulti", "equals", ["Yes"], [["Q1", "includesOneOf", ["Yes"]]]],
    [
      "multi isAnyOf",
      "multipleChoiceMulti",
      "isAnyOf",
      ["Yes", "No"],
      [["Q1", "includesOneOf", ["Yes", "No"]]],
    ],
    [
      "multi doesNotEqual",
      "multipleChoiceMulti",
      "doesNotEqual",
      ["No"],
      [["Q1", "doesNotIncludeOneOf", ["No"]]],
    ],
  ] as const)(
    "a choice condition (%s) names the question's choices",
    async (_name, kind, operator, values, expected) => {
      const { document, issues } = await assemble(
        skipping(yesNo("R2", "Q1", { kind }), { operator, values: [...values] })
      );

      const ids = (labels: readonly string[]) => labels.map((label) => choiceId(document, "Q1", label));
      const [[element, op, labels]] = expected;
      const value = op === "equals" || op === "doesNotEqual" ? ids(labels)[0] : ids(labels);
      expect(conditionsOf(blockOf(document, "Q2").block.logic![0])).toEqual([[element, op, value]]);
      expect(logicIssues(issues)).toEqual([["Q2", "logic_imported"]]);
      expect(checkImportDraft(document)).toEqual([]);
    }
  );

  test.each([
    ["an answer the question does not have", "multipleChoiceSingle", "equals", ["Maybe"]],
    ["doesNotEqual of two answers", "multipleChoiceSingle", "doesNotEqual", ["Yes", "No"]],
    ["a comparison on a choice", "multipleChoiceSingle", "isGreaterThan", ["1"]],
    ["a comparison on several choices", "multipleChoiceMulti", "isLessThan", ["1"]],
    ["an unknown multi answer", "multipleChoiceMulti", "equals", ["Maybe"]],
  ] as const)("a choice condition on %s is reported, not imported", async (_name, kind, operator, values) => {
    const { document, issues } = await assemble(
      skipping(yesNo("R2", "Q1", { kind }), { operator, values: [...values] })
    );

    expect(document.blocks.every((block) => block.logic === undefined)).toBe(true);
    expect(logicIssues(issues)).toEqual([["Q2", "logic_not_imported"]]);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "logic_not_imported", params: { description: "If No, go to Q4." } })
    );
  });

  test.each([
    ["isAnyOf one score", "nps", "isAnyOf", ["10"], [["Q1", "equals", 10]]],
    [
      "isAnyOf scores",
      "rating",
      "isAnyOf",
      ["4", " 5 "],
      [
        [
          "or",
          [
            ["equals", 4],
            ["equals", 5],
          ],
        ],
      ],
    ],
    ["a comparison", "csat", "isGreaterThan", ["3"], [["Q1", "isGreaterThan", 3]]],
    ["equals", "ces", "equals", ["2"], [["Q1", "equals", 2]]],
    ["a number answer", "openText", "isLessThan", ["18"], [["Q1", "isLessThan", 18]]],
  ] as const)(
    "a numeric condition (%s) compares the answer with numbers",
    async (_name, kind, operator, values, expected) => {
      const { document, issues } = await assemble(
        skipping(
          { kind, inputType: "number", range: kind === "rating" ? 5 : null },
          { operator, values: [...values] }
        )
      );

      expect(conditionsOf(blockOf(document, "Q2").block.logic![0])).toEqual(expected);
      expect(logicIssues(issues)).toEqual([["Q2", "logic_imported"]]);
      expect(checkImportDraft(document)).toEqual([]);
    }
  );

  test.each([
    ["a value that is not a number", "nps", "number", "equals", ["high"]],
    ["no value", "nps", "number", "equals", []],
    ["a comparison with two numbers", "nps", "number", "isGreaterThan", ["3", "4"]],
    ["a text answer", "openText", "text", "equals", ["18"]],
    ["a question with no answer to compare", "date", "text", "equals", ["1"]],
  ] as const)(
    "a numeric condition on %s is reported, not imported",
    async (_name, kind, inputType, operator, values) => {
      const { document, issues } = await assemble(
        skipping({ kind, inputType }, { operator, values: [...values] })
      );

      expect(document.blocks.every((block) => block.logic === undefined)).toBe(true);
      expect(logicIssues(issues)).toEqual([["Q2", "logic_not_imported"]]);
    }
  );

  test("whether a question was answered is tested on any answerable question, never a skip of a required one", async () => {
    const answered = await assemble(skipping({}, { operator: "isSubmitted" }));
    expect(conditionsOf(blockOf(answered.document, "Q2").block.logic![0])).toEqual([
      ["Q1", "isSubmitted", undefined],
    ]);

    const skippedOptional = await assemble(skipping({}, { operator: "isSkipped" }));
    expect(conditionsOf(blockOf(skippedOptional.document, "Q2").block.logic![0])).toEqual([
      ["Q1", "isSkipped", undefined],
    ]);

    const skippedRequired = await assemble(skipping({ required: true }, { operator: "isSkipped" }));
    expect(logicIssues(skippedRequired.issues)).toEqual([["Q2", "logic_not_imported"]]);

    const unanswerable = await assemble(skipping({ kind: "cta" }, { operator: "isSubmitted" }));
    expect(logicIssues(unanswerable.issues)).toEqual([["Q2", "logic_not_imported"]]);
  });

  test("a jump to the end goes to the ending; one back, nowhere or to an unknown question is reported", async () => {
    const toEnd = await assemble([
      ...skipping(yesNo("R2", "Q1"), { values: ["No"], target: "END" }),
      entry("R9", { kind: "ending", headline: text("Thanks") }),
    ]);
    expect(blockOf(toEnd.document, "Q2").block.logic![0].actions[0]).toMatchObject({
      target: toEnd.document.endings[0].id,
    });
    expect(checkImportDraft(toEnd.document)).toEqual([]);

    for (const target of ["Q1", null, "Q99"]) {
      const { document, issues } = await assemble(skipping(yesNo("R2", "Q1"), { values: ["No"], target }));
      expect(document.blocks.every((block) => block.logic === undefined)).toBe(true);
      expect(logicIssues(issues)).toEqual([["Q2", "logic_not_imported"]]);
    }
  });

  test("a rule names its question by the file's ID or by the line it starts on, any case and spacing", async () => {
    const { document, issues } = await assemble([
      yesNo("R2", "VIS 01"),
      entry("R3", { label: "Q2", rules: [rule({ question: "vis  01", values: ["No"], target: "r5" })] }),
      entry("R4", { label: "Q3", rules: [rule({ question: "r2", values: ["Yes"], target: "R5" })] }),
      entry("R5", { label: "Q4" }),
    ]);

    expect(logicIssues(issues)).toEqual([
      ["Q2", "logic_imported"],
      ["Q3", "logic_imported"],
    ]);
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("a jump reads its own question's answer", async () => {
    const { document, issues } = await assemble([
      yesNo("R2", "Q1", { rules: [rule({ question: "Q1", values: ["No"], target: "Q3" })] }),
      entry("R3", { label: "Q2" }),
      entry("R4", { label: "Q3" }),
    ]);

    expect(conditionsOf(blockOf(document, "Q1").block.logic![0])).toEqual([
      ["Q1", "equals", choiceId(document, "Q1", "No")],
    ]);
    expect(logicIssues(issues)).toEqual([["Q1", "logic_imported"]]);
  });

  test("without logic, every rule is reported as not imported and the draft carries none", async () => {
    const { document, issues } = await assemble(skipping(yesNo("R2", "Q1"), { values: ["No"] }), {
      withoutLogic: true,
    });

    expect(document.blocks.every((block) => block.logic === undefined)).toBe(true);
    expect(logicIssues(issues)).toEqual([["Q2", "logic_not_imported"]]);
  });
});

describe("assembleDocumentDraft: questions asked only if", () => {
  const showIf = (question: string, values: string[]) => [rule({ kind: "showIf", question, values })];

  test("a conditional question is reached through the block before it, past it when the condition fails", async () => {
    const { document, issues } = await assemble([
      yesNo("R2", "Q1"),
      entry("R3", { label: "Q2", rules: showIf("Q1", ["Yes"]), notes: ["Ask if Q1 is Yes."] }),
      entry("R4", { label: "Q3" }),
    ]);

    const gated = blockOf(document, "Q2");
    const before = document.blocks[gated.index - 1];
    expect(gated.block.elements).toHaveLength(1);
    expect(before.logic?.map(conditionsOf)).toEqual([[["Q1", "equals", choiceId(document, "Q1", "Yes")]]]);
    expect(before.logic?.[0].actions[0]).toMatchObject({ target: gated.block.id });
    expect(before.logicFallback).toBe(blockOf(document, "Q3").block.id);
    expect(issues).toContainEqual({
      code: "logic_imported",
      severity: "warning",
      questionTag: "Q2",
      questionRef: "R3",
      params: { description: "Ask if Q1 is Yes." },
    });
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("a run of conditional questions is routed from the block before it, each with fresh condition ids", async () => {
    const { document, issues } = await assemble([
      yesNo("R2", "Q1"),
      entry("R3", { label: "Q2", rules: showIf("Q1", ["Yes"]) }),
      yesNo("R4", "Q3", { rules: showIf("Q1", ["No"]) }),
      // Reads Q3, which is inside the run: the block before the run cannot read it yet.
      entry("R5", { label: "Q4", rules: [...showIf("Q1", ["Yes"]), ...showIf("Q3", ["Yes"])] }),
      entry("R6", { label: "Q5" }),
    ]);

    const before = document.blocks[0];
    const run = ["Q2", "Q3", "Q4"].map((id) => blockOf(document, id).block.id);
    expect(before.logic?.map((logic) => jumpTarget(logic.actions[0]))).toEqual(run);
    expect(before.logicFallback).toBe(blockOf(document, "Q5").block.id);
    // Each block of the run goes on to the next whose condition holds, else past the run.
    expect(blockOf(document, "Q2").block.logic?.map((logic) => jumpTarget(logic.actions[0]))).toEqual(
      run.slice(1)
    );
    expect(logicIssues(issues).sort()).toEqual(
      [
        ["Q2", "logic_imported"],
        ["Q3", "logic_imported"],
        ["Q4", "logic_imported"],
        ["Q4", "logic_not_imported"],
      ].sort()
    );
    const ids = document.blocks.flatMap((block) =>
      (block.logic ?? []).flatMap((logic) => {
        const group = logic.conditions as TCondition;
        return [group.id, ...(group.conditions ?? []).map((condition) => condition.id)];
      })
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("a conditional question that ends the survey falls through to the ending", async () => {
    const { document } = await assemble([
      yesNo("R2", "Q1"),
      entry("R3", { label: "Q2", rules: showIf("Q1", ["Yes"]) }),
    ]);

    expect(document.blocks[0].logicFallback).toBe(document.endings[0].id);
    expect(checkImportDraft(document)).toEqual([]);
  });

  test("a condition on a later question is reported, not imported", async () => {
    const { document, issues } = await assemble([
      entry("R2", { label: "Q1", rules: showIf("Q2", ["Yes"]) }),
      yesNo("R3", "Q2"),
    ]);

    expect(document.blocks.every((block) => block.logic === undefined)).toBe(true);
    expect(logicIssues(issues)).toEqual([["Q1", "logic_not_imported"]]);
  });
});

describe("options the import's per-question cap leaves out", () => {
  test("are reported, so the draft does not lose them without a line", async () => {
    const options = Array.from({ length: SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION + 2 }, (_, index) =>
      option(`Option ${index + 1}`)
    );

    const { document, issues } = await assemble([entry("R1", { kind: "multipleChoiceMulti", options })]);

    expect((elementsOf(document)[0] as unknown as { choices: unknown[] }).choices).toHaveLength(
      SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION
    );
    expect(issues).toContainEqual({
      code: "options_left_out",
      severity: "warning",
      questionTag: "R1",
      questionRef: "R1",
      params: { count: 2, options: "Option 201, Option 202" },
    });
  });
});
