import { createId } from "@paralleldrive/cuid2";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@formbricks/database";
import { createSurveyImport } from "@/app/api/internal/surveys/imports/lib/operations";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { createIcuTranslate } from "@/modules/survey/excel-export/__fixtures__/translate";
import { writeExcelExport } from "@/modules/survey/excel-export/write";
import type { TImportPlanRequest } from "@/modules/survey/import/core/ai-plan";
import { openZipArchive } from "@/modules/survey/import/core/zip";
import { docx, p, r, tbl } from "@/modules/survey/import/document/__fixtures__/docx-builders";
import { EXCEL_EXPORT_ROUND_TRIP_SURVEY } from "@/modules/survey/import/document/__fixtures__/excel-export-survey";
import { loadDocumentFixture } from "@/modules/survey/import/document/__fixtures__/load-fixture";
import { promptInjectionWithoutInjectedText } from "@/modules/survey/import/document/__fixtures__/prompt-injection";
import {
  type TRecordedDocumentPlan,
  linesInPrompt,
  loadRecordedDocumentPlan,
  planForLines,
  recordedDocumentGenerate,
} from "@/modules/survey/import/document/__fixtures__/recorded-plans";
import { readCsvDocument } from "@/modules/survey/import/document/read-csv";
import { readSheetDocument } from "@/modules/survey/import/document/read-sheet";
import { readWordDocument } from "@/modules/survey/import/document/read-word";
import { streamSurveyImport } from "./operations";

/**
 * Importing an Excel or CSV question list (ENG-6852) or a Word questionnaire (ENG-6853), seam 1, against
 * real PostgreSQL, SpiceDB and Redis: a file's bytes previewed through the import stream and created through the import's create.
 * The AI is faked at the organization's AI boundary with plans recorded for each file; everything after
 * it — the checks that every text is the file's, the assembly, the logic, the create's own checks, the
 * naming — runs for real.
 */

const ai = vi.hoisted(() => ({
  generate: undefined as undefined | ((request: TImportPlanRequest) => Promise<unknown>),
  calls: 0,
}));

vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/service")>()),
  assertOrganizationAIConfigured: async () => ({}),
  generateOrganizationAIObject: async (request: TImportPlanRequest) => {
    ai.calls += 1;
    if (!ai.generate) throw new Error("No recorded plan for this call");
    return ai.generate(request);
  },
}));

// i18next-icu's ESM build cannot construct IntlMessageFormat under Node's own module loader, so outside
// Next's bundler `t` returns messages uninterpolated. Names are checked with the en-US strings.
vi.mock("@/lingodotdev/server", async () => {
  const { default: enUS } = await import("@/locales/en-US.json");
  const lookup = (key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], enUS);
  return {
    getTranslate:
      async () =>
      (key: string, options: Record<string, unknown> = {}) =>
        String(lookup(key) ?? key).replaceAll(/\{(\w+)\}/g, (match, name: string) =>
          name in options ? String(options[name]) : match
        ),
  };
});

let fixture: TDashboardsFixture;

const owner = () => sessionOf(fixture.users.owner);

const readEvents = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

type TDraft = {
  name: string;
  defaultLanguage: string;
  languages: { code: string; enabled: boolean }[];
  welcomeCard?: { headline: Record<string, string>; subheader?: Record<string, string> };
  blocks: {
    id: string;
    name: string;
    elements: Record<string, unknown>[];
    logic?: { conditions: unknown; actions: { target: string }[] }[];
    logicFallback?: string;
  }[];
  endings: { id: string; headline?: Record<string, string>; subheader?: Record<string, string> }[];
};

type TDone = {
  payload: TDraft & Record<string, unknown>;
  references: Record<string, unknown>;
  report: {
    source: { kind: string; fileName: string };
    summary: Record<string, unknown>;
    issues: { code: string; severity: string; questionTag?: string; params?: Record<string, unknown> }[];
  };
};

/** Preview a file's bytes as the dialog uploads them. */
const preview = (bytes: Uint8Array, name: string) =>
  streamSurveyImport({
    req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST" }),
    authentication: owner(),
    workspaceId: fixture.workspaceId,
    file: new File([new Uint8Array(bytes)], name),
    requestId: "req_preview",
    instance: "/api/internal/surveys/import/stream",
  });

const previewDone = async (bytes: Uint8Array, name: string): Promise<TDone> => {
  const response = await preview(bytes, name);
  expect(response.status).toBe(200);
  const events = await readEvents(response);
  const done = events.find((event) => event.type === "done");
  if (!done) throw new Error(`The preview did not finish: ${JSON.stringify(events.at(-1))}`);
  return done as unknown as TDone;
};

/** Preview a fixture, the model answering from its recorded plan. */
const previewFixture = (name: string, plan: TRecordedDocumentPlan = loadRecordedDocumentPlan(name)) => {
  ai.generate = recordedDocumentGenerate(plan);
  return previewDone(loadDocumentFixture(name), name);
};

const commit = (done: TDone, idempotencyKey = createId()) => {
  const { workspaceId: _workspaceId, ...survey } = done.payload;
  return createSurveyImport({
    req: new Request("http://localhost/api/internal/surveys/imports", {
      method: "POST",
      headers: { "Idempotency-Key": `"${idempotencyKey}"` },
    }),
    authentication: owner(),
    body: { workspaceId: fixture.workspaceId, survey, references: done.references },
    requestId: "req_commit",
    instance: "/api/internal/surveys/imports",
  });
};

/** The file's texts per language column, whitespace collapsed: what every draft text must be part of. */
const fileTexts = (name: string, bytes: Uint8Array): string[] => {
  const readModel = () => {
    if (name.endsWith(".csv")) return readCsvDocument(new TextDecoder().decode(bytes));
    if (name.endsWith(".docx")) return readWordDocument(openZipArchive(bytes));
    return readSheetDocument(openZipArchive(bytes));
  };
  const model = readModel();
  return [...model.cells.values()].map((text) => text.replaceAll(/\s+/gu, " ").trim());
};

/** Every text the draft shows, in every language. */
const draftTexts = (draft: TDraft): string[] => {
  const texts: string[] = [];
  const collect = (value: unknown, key?: string) => {
    if (Array.isArray(value)) value.forEach((item) => collect(item));
    else if (typeof value === "object" && value !== null) {
      const isLocaleText = Object.hasOwn(value, draft.defaultLanguage);
      if (
        isLocaleText &&
        ["headline", "subheader", "label", "lowerLabel", "upperLabel"].includes(key ?? "")
      ) {
        for (const text of Object.values(value))
          if (typeof text === "string" && text !== "") texts.push(text);
      } else for (const [childKey, child] of Object.entries(value)) collect(child, childKey);
    }
  };
  collect(draft.blocks);
  collect(draft.welcomeCard);
  return texts;
};

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  await synchronizeAuthzedIntegrationFixture();
});

beforeEach(() => {
  ai.generate = undefined;
  ai.calls = 0;
});

/**
 * Preview a question list against its recorded plan and hold the draft to the file: every question
 * the plan placed is in it, in every language the file has, and every text is a cell of the file or a
 * part of one, as the file writes it. Nothing falls back to a whole cell, and no language misses a text.
 */
const expectWordForWord = async (name: string, bytes: Uint8Array, plan: TRecordedDocumentPlan) => {
  ai.generate = recordedDocumentGenerate(plan);
  const done = await previewDone(bytes, name);

  expect(done.report.source).toEqual({ kind: /\.(csv|xlsx|docx)$/.exec(name)?.[1], fileName: name });
  expect(done.payload.languages.every((language) => language.enabled)).toBe(true);
  const questionCount = plan.questions.filter(
    (entry) => !["welcome", "ending"].includes(String(entry.kind))
  ).length;
  expect(done.report.summary.questions).toBe(questionCount);

  const cells = fileTexts(name, bytes);
  const texts = draftTexts(done.payload);
  expect(texts.length).toBeGreaterThan(questionCount);
  expect(texts.filter((text) => !cells.some((cell) => cell.includes(text)))).toEqual([]);
  expect(done.report.issues.map((issue) => issue.code)).not.toContain("text_not_split");
  expect(done.report.issues.map((issue) => issue.code)).not.toContain("translation_missing");
  return done;
};

describe("document import, on files shaped like the ones it was built for", () => {
  test.each([
    ["library-visit.xlsx", ["en-US", "ar-SA"]],
    ["library-short.xlsx", ["en-US", "ar-SA"]],
    ["site-audit-checklist.xlsx", ["en-US"]],
    ["sample-survey-2.xlsx", ["en-US"]],
    ["sample-survey-2.csv", ["en-US"]],
    ["bilingual-en-de.docx", ["en-US", "de-DE"]],
    ["german-only.docx", ["de-DE"]],
    ["long-survey-150.docx", ["en-US"]],
    ["questions-in-table.docx", ["en-US"]],
    ["tracked-changes-comments.docx", ["en-US"]],
    ["sample-survey-2-word.docx", ["en-US"]],
  ])("%s imports word for word, in every language", async (name, languages) => {
    const done = await expectWordForWord(name, loadDocumentFixture(name), loadRecordedDocumentPlan(name));

    expect(done.payload.languages.map((language) => language.code)).toEqual(languages);
  });
});

/**
 * Customer questionnaires, with plans recorded for them, kept outside the repository: a local check
 * that runs only with `DOCUMENT_IMPORT_LOCAL_FIXTURES` naming their folder, never in CI. The folder
 * holds `<name>.xlsx` or `<name>.csv` and `plans/<name>.plan.json` for each.
 */
// eslint-disable-next-line turbo/no-undeclared-env-vars -- a local test switch, not app config
const LOCAL_FIXTURES = process.env.DOCUMENT_IMPORT_LOCAL_FIXTURES;
const localFixtures = LOCAL_FIXTURES
  ? readdirSync(LOCAL_FIXTURES).filter((name) => /\.(xlsx|csv)$/.test(name))
  : [];

describe.skipIf(!LOCAL_FIXTURES)("document import, on local customer files", () => {
  test.each(localFixtures)("%s imports word for word, in every language", async (name) => {
    const folder = LOCAL_FIXTURES ?? "";
    const { plan } = JSON.parse(
      readFileSync(join(folder, "plans", `${name.replace(/\.(xlsx|csv)$/, "")}.plan.json`), "utf8")
    ) as { plan: TRecordedDocumentPlan };

    await expectWordForWord(name, new Uint8Array(readFileSync(join(folder, name))), plan);
  });
});

/** The draft's block holding the element with `id`, and its position. */
const blockOf = (draft: TDraft, id: string) => {
  const index = draft.blocks.findIndex((block) => block.elements.some((element) => element.id === id));
  return { index, block: draft.blocks[index] };
};

const choiceIdsOf = (draft: TDraft, elementId: string, labels: string[]) => {
  const element = draft.blocks
    .flatMap((block) => block.elements)
    .find((candidate) => candidate.id === elementId);
  const choices = (element?.choices ?? []) as { id: string; label: Record<string, string> }[];
  return labels.map((label) => choices.find((choice) => choice.label["en-US"] === label)?.id);
};

/** A rule's condition, as `[element, operator, value]`, for a group of one condition. */
const conditionOf = (rule: { conditions: unknown }) => {
  const group = rule.conditions as {
    conditions: { leftOperand: { value: string }; operator: string; rightOperand?: { value: unknown } }[];
  };
  return group.conditions.map((condition) => [
    condition.leftOperand.value,
    condition.operator,
    condition.rightOperand?.value,
  ]);
};

describe("Sample_Survey_2's types", () => {
  test("become the Formbricks types the list names, with the ones Formbricks cannot hold reported", async () => {
    const { payload, report } = await previewFixture("sample-survey-2.csv");
    const elements = payload.blocks.flatMap((block) => block.elements);

    expect(elements.map((element) => [element.id, element.type])).toEqual([
      ["01", "openText"],
      ["02", "multipleChoiceSingle"],
      ["03", "multipleChoiceSingle"],
      ["04", "multipleChoiceMulti"],
      ["06", "rating"],
      ["07", "nps"],
      ["08", "csat"],
      ["09", "ces"],
      ["10", "ranking"],
      ["11", "matrix"],
      ["12", "date"],
      ["14", "fileUpload"],
      ["15", "consent"],
    ]);
    const byId = new Map(elements.map((element) => [element.id, element]));
    expect(byId.get("03")).toMatchObject({ displayType: "dropdown" });
    expect(byId.get("06")).toMatchObject({
      scale: "star",
      range: 5,
      lowerLabel: { "en-US": "Poor" },
      upperLabel: { "en-US": "Excellent" },
    });
    // The text to agree to is the consent's checkbox, once.
    expect(byId.get("15")).toMatchObject({ label: { "en-US": "I agree to the terms and conditions." } });
    expect(byId.get("15")).not.toHaveProperty("subheader");
    expect(
      report.issues.filter((issue) => issue.code === "question_skipped").map((issue) => issue.questionTag)
    ).toEqual(["R6", "R14", "R17", "R18"]);
  });
});

describe("routing becomes logic", () => {
  test("a skip jumps from its question's block to the target's, flagged for checking", async () => {
    const { payload, report } = await previewFixture("library-visit.xlsx");

    // "IF answer is "In the city" or "In a nearby town" → Skip to Block 06"
    const source = blockOf(payload, "03");
    const target = blockOf(payload, "06");
    expect(conditionOf(source.block.logic![0])).toEqual([
      ["03", "equalsOneOf", choiceIdsOf(payload, "03", ["In the city", "In a nearby town"])],
    ]);
    expect(source.block.logic![0].actions[0].target).toBe(target.block.id);

    // Each of the sheet's three rules is in the report, for the user to check.
    expect(report.summary.importedLogicRules).toBe(3);
    expect(
      report.issues.filter((issue) => issue.code === "logic_imported").map((issue) => issue.questionTag)
    ).toEqual(["03", "08", "04"]);
  });

  test("a question asked only if an earlier answer holds is reached through the block before it", async () => {
    const { payload } = await previewFixture("library-visit.xlsx");

    // "04": "Ask if coded "further away" in Block 03" — the plan names the option the file means.
    const gated = blockOf(payload, "04");
    const before = payload.blocks[gated.index - 1];
    expect(gated.block.elements).toHaveLength(1);
    expect(before.elements.map((element) => element.id)).toEqual(["03"]);
    // The block's own skip comes first; past it, "04" is shown only to those who live further away.
    expect(before.logic?.map(conditionOf)).toEqual([
      [["03", "equalsOneOf", choiceIdsOf(payload, "03", ["In the city", "In a nearby town"])]],
      [["03", "equals", choiceIdsOf(payload, "03", ["Further away"])[0]]],
    ]);
    expect(before.logic?.map((rule) => rule.actions[0].target)).toEqual([
      blockOf(payload, "06").block.id,
      gated.block.id,
    ]);
    expect(before.logicFallback).toBe(payload.blocks[gated.index + 1].id);
  });

  test("a run of conditional questions is routed from the block before it, each condition read before the run", async () => {
    const { payload, report } = await previewFixture("site-audit-checklist.xlsx");
    const vis04 = (labels: string[]) => choiceIdsOf(payload, "VIS04", labels);

    // ARR01 asks those who came by public transport, ARR02–ARR04 drivers; ARR04 only drivers for whom
    // the car park was not easy to use.
    const run = ["ARR01", "ARR02", "ARR03", "ARR04"].map((id) => blockOf(payload, id));
    expect(run.map(({ index }) => index)).toEqual([0, 1, 2, 3].map((step) => run[0].index + step));
    const before = payload.blocks[run[0].index - 1];
    expect(before.elements.map((element) => element.id)).toEqual([
      "VIS01",
      "VIS02",
      "VIS03",
      "VIS04",
      "VIS05",
    ]);
    expect(before.logic?.map((rule) => rule.actions[0].target)).toEqual(run.map(({ block }) => block.id));
    expect(conditionOf(before.logic![0])).toEqual([
      ["VIS04", "equals", vis04(["Public transport (bus / tram)"])[0]],
    ]);
    // ARR05 is asked of everyone: it does not share a block with the conditional question before it.
    expect(before.logicFallback).toBe(blockOf(payload, "ARR05").block.id);
    expect(blockOf(payload, "ARR05").block.elements.map((element) => element.id)).toEqual(["ARR05"]);
    // ARR04 is also asked only if ARR03 is 2, but ARR03 is inside the run: the block before the run,
    // which routes to ARR04, cannot read it yet. That rule is reported, not imported.
    expect(
      report.issues
        .filter((issue) => issue.questionTag === "ARR04")
        .map((issue) => issue.code)
        .sort()
    ).toEqual(["logic_imported", "logic_not_imported"]);
  });

  test("a rule naming an answer the question does not have is reported, not imported", async () => {
    const plan = loadRecordedDocumentPlan("library-short.xlsx");
    const question = plan.questions.find((entry) => entry.ref === "R4");
    if (!question) throw new Error("No R4 in the plan");
    question.rules = [
      { kind: "showIf", question: "01", operator: "equals", values: ["Sunday"], target: null },
    ];
    question.logicNotes = ["Asked only if 01 is Sunday."];

    const { payload, report } = await previewFixture("library-short.xlsx", plan);

    expect(payload.blocks.every((block) => block.logic === undefined)).toBe(true);
    expect(report.summary).toMatchObject({ logicRules: 1, importedLogicRules: 0 });
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "logic_not_imported",
        questionTag: "03",
        params: { description: "Asked only if 01 is Sunday." },
      })
    );
  });
});

describe("texts are the file's, word for word", () => {
  /** The short list's first question: its English cell with its choices, and its Arabic cell. */
  const withHeadline = (english: string) => {
    const plan = loadRecordedDocumentPlan("library-short.xlsx");
    const question = plan.questions.find((entry) => entry.ref === "R2");
    if (!question) throw new Error("No R2 in the plan");
    (question.headline as { language: string; text: string | null }[])[0].text = english;
    return plan;
  };

  test("a piece not in its cell is asked again, and kept once the retry quotes the cell", async () => {
    const wrong = withHeadline("On which day did you visit?");
    const right = loadRecordedDocumentPlan("library-short.xlsx");
    const prompts: string[] = [];
    ai.generate = recordedDocumentGenerate(right, (request) => {
      prompts.push(request.prompt);
      return planForLines(prompts.length === 1 ? wrong : right, linesInPrompt(request.prompt));
    });

    const done = await previewDone(loadDocumentFixture("library-short.xlsx"), "library-short.xlsx");

    expect(prompts).toHaveLength(2);
    expect(linesInPrompt(prompts[1])).toEqual(["R2"]);
    expect(prompts[1]).toContain("R2: a piece's text is not in its cell exactly");
    const element = done.payload.blocks[0].elements[0];
    expect(element.headline).toEqual({
      "en-US": "Which day did you visit?",
      "ar-SA": "في أي يوم زرت المكتبة؟",
    });
    expect(done.report.issues.map((issue) => issue.code)).not.toContain("text_not_split");
  });

  test("a piece not in its cell on the retry too makes the whole cell the headline, with a warning", async () => {
    const done = await previewFixture("library-short.xlsx", withHeadline("On which day did you visit?"));

    const element = done.payload.blocks[0].elements[0];
    expect(element).toMatchObject({ id: "01", type: "openText" });
    expect(element.headline).toEqual({
      "en-US":
        "Which day did you visit? Choices: Monday; Tuesday; Wednesday; Thursday; Friday; Saturday; Other",
      "ar-SA": "في أي يوم زرت المكتبة؟ الخيارات: الاثنين؛ الثلاثاء؛ الأربعاء؛ الخميس؛ الجمعة؛ السبت؛ أخرى",
    });
    expect(done.report.issues).toContainEqual(
      expect.objectContaining({
        code: "text_not_split",
        severity: "warning",
        questionTag: "01",
        params: { cell: "C2" },
      })
    );
  });

  test("whitespace aside, a piece must match its cell exactly", async () => {
    // Line breaks and doubled spaces in the quote are the file's whitespace, not a different text.
    const done = await previewFixture("library-short.xlsx", withHeadline("Which day  did\nyou visit?"));

    expect(done.payload.blocks[0].elements[0].headline).toMatchObject({
      "en-US": "Which day did you visit?",
    });
    expect(done.report.issues.map((issue) => issue.code)).not.toContain("text_not_split");
  });
});

describe("naming", () => {
  test("a document is named from its title property, else the title line the AI found, else its file name", async () => {
    const titled = await previewFixture("site-audit-checklist.xlsx");
    expect(titled.payload.name).toBe("CITY PARKS | SITE AUDIT CHECKLIST (imported)");

    const untitled = await previewFixture("sample-survey-2.csv");
    expect(untitled.payload.name).toBe("sample-survey-2 (imported)");

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["Title line"], ["Q1", "How old are you?"]]),
      "Sheet1"
    );
    book.Props = { Title: "Visitor survey" };
    const bytes = new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
    ai.generate = recordedDocumentGenerate({
      defaultLanguage: "en-US",
      languages: ["en-US"],
      titleCell: "A1",
      questions: [openTextEntry("R2", "B2")],
      skipped: [],
    });
    expect((await previewDone(bytes, "book.xlsx")).payload.name).toBe("Visitor survey (imported)");
  });

  test("an imported name already taken in the workspace is numbered, through the import's create", async () => {
    const first = await previewFixture("library-short.xlsx");
    const created = await commit(first);
    expect(created.status).toBe(201);
    const surveyId = created.headers.get("Location")?.split("/").at(-1) ?? "";
    const survey = await prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: { name: true } });
    expect(survey.name).toBe("library-short (imported)");

    const second = await previewFixture("library-short.xlsx");
    expect(second.payload.name).toBe("library-short (imported 2)");
  });
});

/** An open question on `ref`'s line, its headline the whole of `cell`. */
function openTextEntry(ref: string, cell: string) {
  return {
    ref,
    kind: "openText",
    idCell: null,
    sectionCell: null,
    required: false,
    headline: [{ language: "en-US", cell, text: null }],
    subheader: [],
    options: [],
    columns: [],
    lowerLabel: [],
    upperLabel: [],
    dropdown: false,
    inputType: "text",
    scale: null,
    range: null,
    format: null,
    rules: [],
    logicNotes: [],
  };
}

describe("the AI ceiling", () => {
  const surveyCount = () => prisma.survey.count({ where: { workspaceId: fixture.workspaceId } });

  test("a file of more than 240k characters is refused before any AI call, pointing at MCP", async () => {
    const before = await surveyCount();
    // 100 rows of 2,401 characters: within the sheet limits, past the AI's.
    const csv = Array.from(
      { length: 100 },
      (_, index) => `Q${index},${"x".repeat(2_400 - String(index).length)}`
    ).join("\n");

    const response = await preview(new TextEncoder().encode(csv), "large.csv");

    expect(response.status).toBe(422);
    const problem = (await response.json()) as { invalid_params: { code: string; identifier: string }[] };
    expect(problem.invalid_params).toEqual([
      expect.objectContaining({ code: "document_limit_exceeded", identifier: "source_size" }),
    ]);
    expect(ai.calls).toBe(0);
    expect(await surveyCount()).toBe(before);
  });

  test("a file of exactly 240k characters is planned", async () => {
    const csv = Array.from(
      { length: 100 },
      (_, index) => `Q${index},${"x".repeat(2_400 - 1 - String(index).length)}`
    ).join("\n");
    ai.generate = recordedDocumentGenerate({
      defaultLanguage: "en-US",
      languages: ["en-US"],
      titleCell: null,
      questions: [openTextEntry("R1", "B1")],
      skipped: [],
    });

    const done = await previewDone(new TextEncoder().encode(csv), "at-limit.csv");

    expect(done.report.summary.questions).toBe(1);
  });

  test("a plan of more than 200 questions fails without a draft, pointing at MCP, and creates nothing", async () => {
    const before = await surveyCount();
    const rows = (count: number) => Array.from({ length: count }, (_, index) => `Q${index + 1}`).join("\n");
    const planOf = (count: number): TRecordedDocumentPlan => ({
      defaultLanguage: "en-US",
      languages: ["en-US"],
      titleCell: null,
      questions: Array.from({ length: count }, (_, index) => openTextEntry(`R${index + 1}`, `A${index + 1}`)),
      skipped: [],
    });

    ai.generate = recordedDocumentGenerate(planOf(201));
    const events = await readEvents(await preview(new TextEncoder().encode(rows(201)), "many.csv"));
    expect(events.at(-1)).toMatchObject({ type: "error", code: "import_too_large" });
    expect(events.some((event) => event.type === "done")).toBe(false);
    expect(await surveyCount()).toBe(before);

    ai.generate = recordedDocumentGenerate(planOf(200));
    expect(
      (await previewDone(new TextEncoder().encode(rows(200)), "two-hundred.csv")).report.summary.questions
    ).toBe(200);
  });
});

describe("a CSV's encoding", () => {
  test("a list Excel saved as Windows-1252 imports with its umlauts and euro signs, and says how it was read", async () => {
    ai.generate = recordedDocumentGenerate({
      defaultLanguage: "de-DE",
      languages: ["de-DE"],
      titleCell: null,
      questions: [
        {
          ...openTextEntry("R2", "B2"),
          kind: "multipleChoiceSingle",
          inputType: null,
          headline: [{ language: "de-DE", cell: "B2", text: null }],
          options: ["Unter 100 €", "Über 100 €"].map((text) => ({
            code: null,
            isOther: false,
            texts: [{ language: "de-DE", cell: "C2", text }],
          })),
        },
        { ...openTextEntry("R4", "B4"), headline: [{ language: "de-DE", cell: "B4", text: null }] },
      ],
      skipped: [],
    });

    const { payload, report } = await previewDone(loadDocumentFixture("budget-cp1252.csv"), "budget.csv");

    const [budget, liked] = payload.blocks.flatMap((block) => block.elements);
    expect(budget.headline).toEqual({ "de-DE": "Wie groß ist Ihr Budget in €?" });
    expect((budget.choices as { label: Record<string, string> }[]).map((choice) => choice.label)).toEqual([
      { "de-DE": "Unter 100 €" },
      { "de-DE": "Über 100 €" },
    ]);
    expect(liked.headline).toEqual({ "de-DE": "Was hat Ihnen gefallen? (Größe, Lage, Öffnungszeiten)" });
    expect(report.issues).toContainEqual({
      code: "file_encoding",
      severity: "info",
      params: { encoding: "windows-1252" },
    });
  });
});

describe("the Excel export (ENG-6849)", () => {
  test("imports back as a new survey, word for word in both languages, with its logic", async () => {
    const bytes = writeExcelExport({
      survey: EXCEL_EXPORT_ROUND_TRIP_SURVEY,
      t: createIcuTranslate("en-US"),
      locale: "en-US",
    });
    const piece = (cell: string, language: "en" | "de") => ({ language, cell, text: null });
    const both = (row: number) => [piece(`D${row}`, "en"), piece(`E${row}`, "de")];
    const entry = (ref: string, kind: string, fields: Record<string, unknown>) => ({
      ...openTextEntry(ref, ""),
      inputType: null,
      kind,
      ...fields,
    });
    ai.generate = recordedDocumentGenerate({
      defaultLanguage: "en",
      languages: ["en", "de"],
      titleCell: null,
      questions: [
        entry("R2", "welcome", { headline: both(2) }),
        entry("R3", "multipleChoiceSingle", {
          idCell: "B3",
          required: true,
          headline: both(3),
          options: [4, 5].map((row) => ({ code: null, isOther: false, texts: both(row) })),
          rules: [
            { kind: "skipTo", question: "visited", operator: "equals", values: ["No"], target: "improve" },
          ],
          logicNotes: ["If the answer is No, jump to improve."],
        }),
        entry("R6", "nps", {
          idCell: "B6",
          required: true,
          headline: both(6),
          lowerLabel: both(7),
          upperLabel: both(8),
        }),
        entry("R9", "openText", { idCell: "B9", inputType: "text", headline: both(9) }),
        entry("R10", "ending", { headline: both(10), subheader: both(11) }),
      ],
      skipped: [],
    });

    const done = await previewDone(bytes, "Visitor feedback.xlsx");
    const created = await commit(done);
    expect(created.status).toBe(201);

    const { payload } = done;
    expect(payload.languages.map((language) => language.code)).toEqual(["en-US", "de-DE"]);
    expect(payload.welcomeCard?.headline).toEqual({ "en-US": "Welcome", "de-DE": "Willkommen" });
    expect(
      payload.blocks.flatMap((block) => block.elements).map((element) => [element.id, element.headline])
    ).toEqual([
      ["visited", { "en-US": "Have you visited us before?", "de-DE": "Waren Sie schon einmal bei uns?" }],
      ["recommend", { "en-US": "Would you recommend us?", "de-DE": "Würden Sie uns empfehlen?" }],
      ["improve", { "en-US": "What should we improve?", "de-DE": "Was sollen wir verbessern?" }],
    ]);
    expect(choiceIdsOf(payload, "visited", ["Yes", "No"]).every(Boolean)).toBe(true);
    expect(payload.endings[0]).toMatchObject({
      headline: { "en-US": "Thank you!", "de-DE": "Danke!" },
      subheader: { "en-US": "See you soon.", "de-DE": "Bis bald." },
    });
    const visited = blockOf(payload, "visited").block;
    expect(conditionOf(visited.logic![0])).toEqual([
      ["visited", "equals", choiceIdsOf(payload, "visited", ["No"])[0]],
    ]);
    expect(visited.logic![0].actions[0].target).toBe(blockOf(payload, "improve").block.id);
    // The export's very hidden meta sheet is the file's bookkeeping, not a sheet the user skipped.
    expect(done.report.issues.map((issue) => issue.code)).not.toContain("sheets_skipped");
  });
});

/** What a draft says, without the ids each import makes anew: what two drafts of one file share. */
const contentOf = (draft: TDraft) => ({
  name: draft.name,
  languages: draft.languages,
  welcomeCard: draft.welcomeCard,
  elements: draft.blocks.flatMap((block) =>
    block.elements.map(({ id: _id, choices, rows, columns, ...element }) => ({
      ...element,
      labels: [choices, rows, columns].map((list) =>
        ((list ?? []) as { label: Record<string, string> }[]).map((item) => item.label)
      ),
    }))
  ),
  endings: draft.endings.map(({ id: _id, ...ending }) => ending),
});

describe("Word questionnaires (ENG-6853)", () => {
  test("a Word questionnaire with a recorded plan is created as a draft, named after its first heading", async () => {
    const before = await prisma.survey.count({ where: { workspaceId: fixture.workspaceId } });
    const done = await previewFixture("questions-in-table.docx");

    const created = await commit(done);

    expect(created.status).toBe(201);
    const surveyId = created.headers.get("Location")?.split("/").at(-1) ?? "";
    const survey = await prisma.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: { name: true, status: true, workspaceId: true, blocks: true },
    });
    expect(survey).toMatchObject({
      name: "Survey — Questions in a Table (imported)",
      status: "draft",
      workspaceId: fixture.workspaceId,
    });
    const elements = (survey.blocks as { elements: { id: string; type: string }[] }[]).flatMap(
      (block) => block.elements
    );
    expect(elements.map((element) => element.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1))
    );
    expect(elements.find((element) => element.id === "10")?.type).toBe("matrix");
    expect(await prisma.survey.count({ where: { workspaceId: fixture.workspaceId } })).toBe(before + 1);
  });

  test("Tracked_Changes_Comments imports its accepted text: the inserted question in, the deleted word and the comments out", async () => {
    const done = await previewFixture("tracked-changes-comments.docx");

    const elements = done.payload.blocks.flatMap((block) => block.elements);
    expect(elements.map((element) => [element.type, element.headline])).toEqual([
      ["csat", { "en-US": "How satisfied are you with the stadium?" }],
      ["multipleChoiceSingle", { "en-US": "Would you attend this event again?" }],
      ["openText", { "en-US": "Any additional comments?" }],
      ["nps", { "en-US": "How likely are you to recommend us?" }],
    ]);
    const everything = JSON.stringify(done.payload);
    expect(everything).not.toContain("venue");
    expect(everything).not.toContain("optional");
  });

  test("Long_Survey_150 is planned in several calls and keeps all 150 questions in order", async () => {
    const done = await previewFixture("long-survey-150.docx");

    expect(ai.calls).toBeGreaterThan(1);
    const headlines = done.payload.blocks
      .flatMap((block) => block.elements)
      .map((element) => element.headline);
    expect(headlines).toHaveLength(150);
    expect(headlines[0]).toEqual({ "en-US": "What did you think of the event overall? (item 1)" });
    expect(headlines[149]).toEqual({ "en-US": "How likely are you to recommend us? (item 150)" });
  });

  describe("Prompt_Injection", () => {
    test("produces the same draft as the file without its injected text", async () => {
      const plan = loadRecordedDocumentPlan("prompt-injection.docx");
      const requests: { system: string; prompt: string }[] = [];
      ai.generate = recordedDocumentGenerate(plan, (request) => {
        requests.push({ system: request.system, prompt: request.prompt });
        return undefined;
      });
      const withInjection = await previewDone(loadDocumentFixture("prompt-injection.docx"), "Event.docx");
      ai.generate = recordedDocumentGenerate(plan);
      const clean = await previewDone(promptInjectionWithoutInjectedText(), "Event.docx");

      expect(contentOf(withInjection.payload)).toEqual(contentOf(clean.payload));
      expect(withInjection.report.issues).toEqual(clean.report.issues);
      expect(withInjection.payload.name).toBe("Event Feedback Survey (imported)");
      expect(
        withInjection.payload.blocks.flatMap((block) => block.elements).some((element) => element.required)
      ).toBe(false);
      // The injected text reaches the model only inside the data block, with no way to close it.
      for (const { system, prompt } of requests) {
        const [outside, data] = prompt.split("\n<document_lines>\n");
        expect(`${system}\n${outside}`).not.toMatch(/PWNED|SYSTEM:|INSTRUCTION/);
        expect(data.split("</document_lines>")).toHaveLength(2);
      }
      expect(requests.map(({ prompt }) => prompt).join("\n")).toContain("PWNED");
    });
  });

  test("a question laid out as a table becomes a matrix, flagged for checking; a matrix in one row is not", async () => {
    const grid = tbl([
      ["", "Poor", "OK", "Good"],
      ["Staff", "", "", ""],
      ["Facilities", "", "", ""],
    ]);
    const bytes = docx({
      body: p("Club survey", { style: "Heading1" }) + p("Rate each part of your visit.") + grid,
    });
    const piece = (cell: string) => ({ language: "en-US", cell, text: null });
    const option = (cell: string) => ({ code: null, isOther: false, texts: [piece(cell)] });
    ai.generate = recordedDocumentGenerate({
      defaultLanguage: "en-US",
      languages: ["en-US"],
      titleCell: "P1",
      questions: [
        {
          ...openTextEntry("P2", "P2"),
          kind: "matrix",
          inputType: null,
          options: [option("T1R2C1"), option("T1R3C1")],
          columns: [option("T1R1C2"), option("T1R1C3"), option("T1R1C4")],
        },
      ],
      skipped: [],
    });

    const { payload, report } = await previewDone(bytes, "club.docx");

    const [matrix] = payload.blocks.flatMap((block) => block.elements);
    expect(matrix).toMatchObject({ type: "matrix", headline: { "en-US": "Rate each part of your visit." } });
    expect((matrix.rows as { label: Record<string, string> }[]).map((row) => row.label["en-US"])).toEqual([
      "Staff",
      "Facilities",
    ]);
    expect(
      (matrix.columns as { label: Record<string, string> }[]).map((column) => column.label["en-US"])
    ).toEqual(["Poor", "OK", "Good"]);
    expect(report.issues).toContainEqual({ code: "table_as_matrix", severity: "warning", questionTag: "P2" });

    const sample = await previewFixture("sample-survey-2-word.docx");
    expect(sample.payload.blocks.flatMap((block) => block.elements).map((element) => element.type)).toContain(
      "matrix"
    );
    expect(sample.report.issues.map((issue) => issue.code)).not.toContain("table_as_matrix");
  });

  test("images in the file are reported as not imported, and the questions around them are", async () => {
    const image = `<w:r><w:drawing/></w:r>`;
    const bytes = docx({ body: p(`${r("Which logo do you prefer?")}${image}`) + p(image) + p("Why?") });
    ai.generate = recordedDocumentGenerate({
      defaultLanguage: "en-US",
      languages: ["en-US"],
      titleCell: null,
      questions: [openTextEntry("P1", "P1"), openTextEntry("P3", "P3")],
      skipped: [],
    });

    const { payload, report } = await previewDone(bytes, "logos.docx");

    expect(payload.blocks.flatMap((block) => block.elements).map((element) => element.headline)).toEqual([
      { "en-US": "Which logo do you prefer?" },
      { "en-US": "Why?" },
    ]);
    expect(report.issues).toContainEqual({
      code: "images_not_imported",
      severity: "warning",
      params: { count: 2 },
    });
  });

  test("a document past the Word limits is refused before any AI call, and creates nothing", async () => {
    const before = await prisma.survey.count({ where: { workspaceId: fixture.workspaceId } });
    const body = p("Q1") + "<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>".repeat(501);

    const response = await preview(docx({ body, stored: true }), "tables.docx");

    expect(response.status).toBe(422);
    expect(((await response.json()) as { invalid_params: unknown[] }).invalid_params).toEqual([
      expect.objectContaining({ code: "document_limit_exceeded", identifier: "tables" }),
    ]);
    expect(ai.calls).toBe(0);
    expect(await prisma.survey.count({ where: { workspaceId: fixture.workspaceId } })).toBe(before);
  });
});
