import { beforeEach, describe, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@formbricks/database";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import type { TImportPlanGenerate, TImportPlanRequest } from "../core/ai-plan";
import type { TSurveyImportDraft } from "../core/draft";
import { SurveyImportFailedError, SurveyImportTimeoutError } from "../core/errors";
import { openZipArchive } from "../core/zip";
import { SURVEY_IMPORT_MAX_QUESTIONS } from "../limits";
import { docx, p, r, tbl } from "./__fixtures__/docx-builders";
import { loadDocumentFixture, loadDocumentFixtureText } from "./__fixtures__/load-fixture";
import { promptInjectionWithoutInjectedText } from "./__fixtures__/prompt-injection";
import {
  type TRecordedDocumentPlan,
  linesInPrompt,
  loadRecordedDocumentPlan,
  planForLines,
  recordedDocumentGenerate,
} from "./__fixtures__/recorded-plans";
import { chunkDocumentLines } from "./chunks";
import { buildGridModel } from "./model";
import { type TRunDocumentImportParams, runDocumentImport } from "./pipeline";
import { type TPreparedDocumentImport, prepareDocumentImport } from "./prepare";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIObject: vi.fn(),
  checkImportDraft: vi.fn(),
  realCheckImportDraft: undefined as unknown as typeof import("../core/final-gate").checkImportDraft,
}));

vi.mock("server-only", () => ({}));
// Only the AI call and the database the naming reads are replaced; the readers, checks, assembly and
// the create's own checks run for real.
vi.mock("@/lib/ai/service", () => ({ generateOrganizationAIObject: mocks.generateOrganizationAIObject }));
vi.mock("@formbricks/database", () => ({ prisma: { survey: { findMany: vi.fn() } } }));
vi.mock("@/lib/user/locale", () => ({ getUserLocaleOrDefault: vi.fn(async () => "en-US") }));
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
vi.mock("../core/final-gate", async (importOriginal) => {
  const original = await importOriginal<typeof import("../core/final-gate")>();
  mocks.realCheckImportDraft = original.checkImportDraft;
  return {
    ...original,
    // The pipeline's own way in, through a mock that runs the real check unless a test says otherwise.
    checkImportDraftInSlices: async (document: Parameters<typeof original.checkImportDraft>[0]) =>
      mocks.checkImportDraft(document),
  };
});

const WORKSPACE_ID = "clxx1234567890123456789012";

/** A fixture read as the upload's thread reads it. */
const prepareFixture = (name: string, bytes = loadDocumentFixture(name)): TPreparedDocumentImport => {
  if (name.endsWith(".csv"))
    return prepareDocumentImport(
      { type: "csv", text: loadDocumentFixtureText(name), encoding: "utf-8" },
      name
    );
  const type = name.endsWith(".docx") ? "docx" : "xlsx";
  return prepareDocumentImport({ type, archive: openZipArchive(bytes) }, name);
};

const run = (
  prepared: TPreparedDocumentImport,
  generate: TImportPlanGenerate | undefined,
  overrides: Partial<TRunDocumentImportParams> = {}
) =>
  runDocumentImport({
    prepared,
    workspaceId: WORKSPACE_ID,
    organizationId: "org_1",
    userId: "user_1",
    signal: new AbortController().signal,
    deadlineMs: 120_000,
    onProgress: vi.fn(),
    generate,
    ...overrides,
  });

const runFixture = (name: string, plan: TRecordedDocumentPlan = loadRecordedDocumentPlan(name)) =>
  run(prepareFixture(name), recordedDocumentGenerate(plan));

const elementsOf = (document: TSurveyImportDraft) =>
  document.blocks.flatMap((block) => block.elements) as unknown as (Record<string, unknown> & {
    id: string;
    type: string;
  })[];

/** An open question on `ref`'s line, its headline the whole of `cell`. */
const openTextEntry = (ref: string, cell: string, language = "en-US") => ({
  ref,
  kind: "openText",
  idCell: null,
  sectionCell: null,
  required: false,
  headline: [{ language, cell, text: null }],
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
});

const planOf = (
  questions: TRecordedDocumentPlan["questions"],
  fields: Partial<TRecordedDocumentPlan> = {}
): TRecordedDocumentPlan => ({
  defaultLanguage: "en-US",
  languages: ["en-US"],
  titleCell: null,
  questions,
  skipped: [],
  ...fields,
});

/** Every text the draft shows, in every language. */
const draftTexts = (draft: TSurveyImportDraft): string[] => {
  const texts: string[] = [];
  const collect = (value: unknown, key?: string) => {
    if (Array.isArray(value)) value.forEach((item) => collect(item));
    else if (typeof value === "object" && value !== null) {
      if (
        Object.hasOwn(value, draft.defaultLanguage) &&
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

const failureOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(SurveyImportFailedError);
  return (error as SurveyImportFailedError).reason;
};

beforeEach(() => {
  vi.mocked(prisma.survey.findMany).mockReset();
  vi.mocked(prisma.survey.findMany).mockResolvedValue([]);
  mocks.generateOrganizationAIObject.mockReset();
  mocks.checkImportDraft.mockReset();
  mocks.checkImportDraft.mockImplementation(mocks.realCheckImportDraft);
});

describe("runDocumentImport, on files shaped like the ones it was built for", () => {
  test.each([
    ["library-visit.xlsx", ["en-US", "ar-SA"]],
    ["library-short.xlsx", ["en-US", "ar-SA"]],
    ["site-audit-checklist.xlsx", ["en-US"]],
    ["sample-survey-2.xlsx", ["en-US"]],
    ["sample-survey-2.csv", ["en-US"]],
    ["bilingual-en-de.docx", ["en-US", "de-DE"]],
    ["german-only.docx", ["de-DE"]],
    ["questions-in-table.docx", ["en-US"]],
    ["tracked-changes-comments.docx", ["en-US"]],
    ["sample-survey-2-word.docx", ["en-US"]],
  ])(
    "%s imports word for word, in every language, and passes the create's checks",
    async (name, languages) => {
      const plan = loadRecordedDocumentPlan(name);
      const prepared = prepareFixture(name);

      const { payload, report } = await run(prepared, recordedDocumentGenerate(plan));

      expect(payload.languages.map((language) => [language.code, language.enabled])).toEqual(
        languages.map((code) => [code, true])
      );
      const questionCount = plan.questions.filter(
        (entry) => !["welcome", "ending"].includes(String(entry.kind))
      ).length;
      expect(report.summary.questions).toBe(questionCount);
      const cells = [...prepared.model.cells.values()].map((text) => text.replaceAll(/\s+/gu, " ").trim());
      const texts = draftTexts(payload as TSurveyImportDraft);
      expect(texts.length).toBeGreaterThan(questionCount);
      expect(texts.filter((text) => !cells.some((cell) => cell.includes(text)))).toEqual([]);
      expect(report.issues.map((issue) => issue.code)).not.toContain("text_not_split");
      expect(report.issues.map((issue) => issue.code)).not.toContain("translation_missing");
      expect(mocks.realCheckImportDraft(payload)).toEqual([]);
    }
  );

  test("reports its stages, the source, and the tokens its calls used", async () => {
    const onProgress = vi.fn();
    const result = await run(
      prepareFixture("library-short.xlsx"),
      recordedDocumentGenerate(loadRecordedDocumentPlan("library-short.xlsx")),
      { onProgress }
    );

    expect(onProgress.mock.calls.map(([stage]) => stage)).toEqual(["ai", "assembling"]);
    expect(result.report.source).toEqual({ kind: "xlsx", fileName: "library-short.xlsx" });
    // A document points at nothing outside itself, so the dialog creates it through the draft create, not
    // the Formbricks file's.
    expect(result).not.toHaveProperty("references");
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    expect(result.usage?.outputTokens).toBeGreaterThan(0);
  });

  test("Sample_Survey_2's types become the Formbricks types the list names, the ones it cannot hold reported", async () => {
    const { payload, report } = await runFixture("sample-survey-2.csv");

    expect(elementsOf(payload as TSurveyImportDraft).map((element) => [element.id, element.type])).toEqual([
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
    const skipped = report.issues.filter((issue) => issue.code === "question_skipped");
    expect(skipped.map((issue) => issue.questionTag)).toEqual(["R6", "R14", "R17", "R18"]);
    expect(skipped[0]).toMatchObject({
      severity: "warning",
      params: { cause: "ai_skipped", description: "Picture Selection questions cannot be imported." },
    });
  });

  test("routing becomes logic, every rule reported by the question's ID for checking", async () => {
    const { report } = await runFixture("library-visit.xlsx");

    expect(report.summary.importedLogicRules).toBe(3);
    expect(
      report.issues.filter((issue) => issue.code === "logic_imported").map((issue) => issue.questionTag)
    ).toEqual(["03", "08", "04"]);
  });
});

describe("runDocumentImport: the AI's plan", () => {
  test("an entry still wrong on the retry is dropped with a report line, by the line it starts on", async () => {
    const plan = planOf([openTextEntry("R1", "B1"), { ...openTextEntry("R2", "B2"), kind: "address" }]);
    const prompts: string[] = [];
    const generate = recordedDocumentGenerate(plan, (request) => {
      prompts.push(request.prompt);
      return undefined;
    });

    const { payload, report } = await run(
      {
        fileName: "list.csv",
        model: buildGridModel("csv", [
          ["Q1", "Name?"],
          ["Q2", "Address?"],
        ]),
      },
      generate
    );

    expect(prompts).toHaveLength(2);
    expect(linesInPrompt(prompts[1])).toEqual(["R2"]);
    expect(prompts[1]).toContain("R2: its kind is not allowed");
    expect(elementsOf(payload as TSurveyImportDraft)).toHaveLength(1);
    expect(report.issues).toContainEqual({
      code: "question_skipped",
      severity: "warning",
      questionTag: "R2",
      params: { cause: "plan_invalid" },
    });
  });

  test("a skip with no reason left after cleaning is reported without one", async () => {
    const { report } = await run(
      {
        fileName: "list.csv",
        model: buildGridModel("csv", [
          ["Q1", "Name?"],
          ["Q2", "Photo"],
        ]),
      },
      recordedDocumentGenerate(
        planOf([openTextEntry("R1", "B1")], { skipped: [{ ref: "R2", reason: "   " }] })
      )
    );

    expect(report.issues).toContainEqual({
      code: "question_skipped",
      severity: "warning",
      questionTag: "R2",
      params: { cause: "ai_skipped" },
    });
  });

  test("without a model of its own, the import asks the organization's, traced to the user", async () => {
    mocks.generateOrganizationAIObject.mockImplementation(
      recordedDocumentGenerate(loadRecordedDocumentPlan("library-short.xlsx"))
    );

    await run(prepareFixture("library-short.xlsx"), undefined);

    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        aiTracing: {
          distinctId: "user_1",
          feature: AI_TRACING_FEATURE.SurveyImport,
          workspaceId: WORKSPACE_ID,
        },
        schemaName: "DocumentImportPlan",
        abortSignal: expect.any(AbortSignal),
        // The plan schema defaults what a JSON-object provider may leave out (`@formbricks/ai` turns
        // strict decoding off for whichever provider is configured).
        strictSchema: false,
      })
    );

    mocks.generateOrganizationAIObject.mockClear();
    await run(prepareFixture("library-short.xlsx"), undefined, { userId: null });
    expect(mocks.generateOrganizationAIObject.mock.calls[0][0].aiTracing).toBeUndefined();
  });
});

describe("runDocumentImport: naming", () => {
  const xlsx = (rows: string[][], title?: string) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
    if (title) book.Props = { Title: title };
    return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
  };
  const titled = planOf([openTextEntry("R2", "B2")], { titleCell: "A1" });
  const nameOf = async (bytes: Uint8Array, fileName: string, plan = titled) =>
    (await run(prepareFixture(fileName, bytes), recordedDocumentGenerate(plan))).payload.name;

  test("the title the file declares comes first, then the title line the AI found, then the file name", async () => {
    const rows = [["Title line"], ["Q1", "How old are you?"]];

    expect(await nameOf(xlsx(rows, "Visitor survey"), "book.xlsx")).toBe("Visitor survey (imported)");
    expect(await nameOf(xlsx(rows), "book.xlsx")).toBe("Title line (imported)");
    expect(await nameOf(xlsx(rows), "Visitor feedback.xlsx", { ...titled, titleCell: null })).toBe(
      "Visitor feedback (imported)"
    );
  });

  test("a title cell the file does not have is ignored", async () => {
    const plan = { ...titled, titleCell: "Z99" };

    expect(await nameOf(xlsx([["Title line"], ["Q1", "How old?"]]), "book.xlsx", plan)).toBe(
      "book (imported)"
    );
  });

  test("a name with nothing left after cleaning falls back to a fixed one; a long one is cut", async () => {
    const plan = { ...titled, titleCell: null };

    expect(await nameOf(xlsx([["x"], ["Q1", "How old?"]]), ".xlsx", plan)).toBe(".xlsx (imported)");
    expect(await nameOf(xlsx([["x"], ["Q1", "How old?"]], "   "), " .xlsx", plan)).toBe(
      "Imported survey (imported)"
    );
    const long = await nameOf(xlsx([["x"], ["Q1", "How old?"]], "A".repeat(300)), "book.xlsx", plan);
    expect(long).toBe(`${"A".repeat(200)} (imported)`);
  });

  test("an imported name already taken in the workspace is numbered", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([{ name: "library-short (imported)" }] as never);

    const { payload } = await runFixture("library-short.xlsx");

    expect(payload.name).toBe("library-short (imported 2)");
    expect(vi.mocked(prisma.survey.findMany).mock.calls[0][0]?.where).toMatchObject({
      workspaceId: WORKSPACE_ID,
    });
  });
});

describe("runDocumentImport: the AI ceiling", () => {
  const listOf = (count: number) => ({
    fileName: "many.csv",
    model: buildGridModel(
      "csv",
      Array.from({ length: count }, (_, index) => [`Q${index + 1}`])
    ),
  });
  const plannedAll = (count: number) =>
    planOf(Array.from({ length: count }, (_, index) => openTextEntry(`R${index + 1}`, `A${index + 1}`)));

  test(`a plan of more than ${SURVEY_IMPORT_MAX_QUESTIONS} questions fails without a draft; exactly that many is imported`, async () => {
    const over = SURVEY_IMPORT_MAX_QUESTIONS + 1;
    expect(await failureOf(run(listOf(over), recordedDocumentGenerate(plannedAll(over))))).toBe(
      "too_many_questions"
    );

    const { report } = await run(
      listOf(SURVEY_IMPORT_MAX_QUESTIONS),
      recordedDocumentGenerate(plannedAll(SURVEY_IMPORT_MAX_QUESTIONS))
    );
    expect(report.summary.questions).toBe(SURVEY_IMPORT_MAX_QUESTIONS);
  });

  test("planning stops once its answers hold more questions than the import takes, before the rest is asked", async () => {
    const lines = 3 * SURVEY_IMPORT_MAX_QUESTIONS;
    const file = listOf(lines);
    const chunks = chunkDocumentLines(
      file.model,
      file.model.lines.map((line) => line.key)
    ).length;
    const generate = vi.fn(recordedDocumentGenerate(plannedAll(lines)));

    expect(await failureOf(run(file, generate))).toBe("too_many_questions");
    // Every chunk asked would be `chunks` calls; it stopped once the questions so far passed the ceiling.
    expect(chunks).toBeGreaterThan(4);
    expect(generate.mock.calls.length).toBeLessThan(chunks);
  });

  test("a question asked again on the retry counts once toward the ceiling", async () => {
    const count = Math.ceil(SURVEY_IMPORT_MAX_QUESTIONS * 0.75);
    const valid = plannedAll(count);
    // The first round's answers place every line on a cell the line does not have, which the checks
    // fail; the retry places them right. Counted twice, the same lines would pass the ceiling.
    const wrong = planOf(valid.questions.map((question) => openTextEntry(question.ref, "Z9999")));
    const file = listOf(count);
    const firstRound = chunkDocumentLines(
      file.model,
      file.model.lines.map((line) => line.key)
    ).length;
    let calls = 0;
    const generate = recordedDocumentGenerate(valid, (request) => {
      calls += 1;
      return calls <= firstRound ? planForLines(wrong, linesInPrompt(request.prompt)) : undefined;
    });

    const { report } = await run(file, generate);
    expect(calls).toBeGreaterThan(firstRound);
    expect(report.summary.questions).toBe(count);
  });

  test("a plan with no question in it, every line answered, has nothing to import: a welcome and an ending alone are no survey", async () => {
    const plan = planOf([
      { ...openTextEntry("R1", "A1"), kind: "welcome" },
      { ...openTextEntry("R2", "A2"), kind: "ending" },
    ]);

    expect(await failureOf(run(listOf(2), recordedDocumentGenerate(plan)))).toBe("nothing_importable");
  });

  test("an answer that names no line at all fails as retryable, not as nothing to import", async () => {
    const plan = planOf([]);

    expect(await failureOf(run(listOf(2), recordedDocumentGenerate(plan)))).toBe("no_questions");
  });

  test("a plan that failed on the way stays retryable, even when the retry then leaves the line out", async () => {
    let calls = 0;
    const generate = recordedDocumentGenerate(planOf([]), () => {
      calls += 1;
      // The first answer places R2 and R3 on cells the file doesn't have, which fails both. The retry,
      // asked about those two, skips R3 and leaves R2 out: no failure is left, and nothing is silent.
      return calls === 1
        ? planOf([openTextEntry("R2", "Z8"), openTextEntry("R3", "Z9")], {
            skipped: [{ ref: "R1", reason: "A heading" }],
          })
        : planOf([], { skipped: [{ ref: "R3", reason: "A note" }] });
    });

    expect(await failureOf(run(listOf(3), generate))).toBe("no_questions");
    expect(calls).toBe(2);
  });

  test("a plan whose languages could not be read fails with nothing to import", async () => {
    const plan = planOf([openTextEntry("R1", "A1")], { defaultLanguage: "not a language", languages: [] });

    expect(await failureOf(run(listOf(1), recordedDocumentGenerate(plan)))).toBe("no_questions");
  });
});

describe("runDocumentImport: the final gate", () => {
  const prepared = (): TPreparedDocumentImport => ({
    fileName: "list.csv",
    model: buildGridModel("csv", [
      ["Q1", "Do you drive?", "Yes", "No"],
      ["Q2", "Which car?"],
      ["Q3", "Anything else?"],
    ]),
  });
  const plan = planOf([
    {
      ...openTextEntry("R1", "B1"),
      kind: "multipleChoiceSingle",
      idCell: "A1",
      inputType: null,
      options: ["C1", "D1"].map((cell) => ({
        code: null,
        isOther: false,
        texts: [{ language: "en-US", cell, text: null }],
      })),
    },
    {
      ...openTextEntry("R2", "B2"),
      idCell: "A2",
      rules: [{ kind: "showIf", question: "Q1", operator: "equals", values: ["Yes"], target: null }],
    },
    { ...openTextEntry("R3", "B3"), idCell: "A3" },
  ]);
  const generate = () => recordedDocumentGenerate(plan);

  test("an element the create would refuse is dropped and reported, and the rest is imported", async () => {
    mocks.checkImportDraft.mockImplementationOnce(() => [
      { name: "blocks.2.elements.0.headline", reason: "Refused" },
    ]);

    const { payload, report } = await run(prepared(), generate());

    expect(elementsOf(payload as TSurveyImportDraft).map((element) => element.id)).toEqual(["Q1", "Q2"]);
    expect(report.issues).toContainEqual({
      code: "question_skipped",
      severity: "warning",
      questionTag: "Q3",
      params: { cause: "validation_failed" },
    });
    expect(mocks.checkImportDraft).toHaveBeenCalledTimes(2);
  });

  test("logic the create would refuse is left out, each rule reported as not imported", async () => {
    mocks.checkImportDraft.mockImplementationOnce(() => [{ name: "blocks.0.logic.0", reason: "Refused" }]);

    const { payload, report } = await run(prepared(), generate());

    expect(payload.blocks.every((block) => !("logic" in block))).toBe(true);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "logic_not_imported", questionTag: "Q2" })
    );
    expect(report.issues.map((issue) => issue.code)).not.toContain("logic_imported");
  });

  test("a draft the create still refuses without its logic fails the import", async () => {
    mocks.checkImportDraft.mockImplementation(() => [{ name: "name", reason: "Refused" }]);

    expect(await failureOf(run(prepared(), generate()))).toBe("draft_invalid");
    expect(mocks.checkImportDraft).toHaveBeenCalledTimes(2);
  });

  test("a draft whose every element the create refuses leaves no question to import", async () => {
    mocks.checkImportDraft.mockImplementation((document: TSurveyImportDraft) =>
      document.blocks.flatMap((block, blockIndex) =>
        block.elements.map((_element, index) => ({
          name: `blocks.${blockIndex}.elements.${index}`,
          reason: "Refused",
        }))
      )
    );

    expect(await failureOf(run(prepared(), generate()))).toBe("no_questions");
    expect(mocks.checkImportDraft).toHaveBeenCalledTimes(2);
  });

  test("a draft past the create's size is cut to fit, the cut reported and the rest checked again", async () => {
    // One cell of 11,000 characters, named whole by each of 200 options: a draft past 2 MB.
    const big = "x".repeat(11_000);
    const model = buildGridModel("csv", [
      ["Q1", "Your name?"],
      ["Q2", "Pick one", big],
    ]);
    const huge = planOf([
      { ...openTextEntry("R1", "B1"), idCell: "A1" },
      {
        ...openTextEntry("R2", "B2"),
        kind: "multipleChoiceMulti",
        idCell: "A2",
        inputType: null,
        options: Array.from({ length: 200 }, () => ({
          code: null,
          isOther: false,
          texts: [{ language: "en-US", cell: "C2", text: null }],
        })),
      },
    ]);

    const { payload, report } = await run({ fileName: "big.csv", model }, recordedDocumentGenerate(huge));

    expect(elementsOf(payload as TSurveyImportDraft).map((element) => element.id)).toEqual(["Q1"]);
    expect(report.issues).toContainEqual(expect.objectContaining({ questionTag: "Q2", severity: "warning" }));
    // The gate ran once on the assembled draft and once more on the cut one.
    expect(mocks.checkImportDraft).toHaveBeenCalledTimes(2);
  });
});

describe("runDocumentImport: what the file holds that the draft cannot", () => {
  test("says how a text file was read, and which sheets it skipped", async () => {
    const model = buildGridModel("csv", [["Q1", "Wie groß?"]], {
      encoding: "windows-1252",
      skippedParts: ["Notes", "Codes"],
    });

    const { report } = await run(
      { fileName: "list.csv", model },
      recordedDocumentGenerate(
        planOf([openTextEntry("R1", "B1", "de-DE")], { defaultLanguage: "de-DE", languages: ["de-DE"] })
      )
    );

    expect(report.issues).toContainEqual({
      code: "file_encoding",
      severity: "info",
      params: { encoding: "windows-1252" },
    });
    expect(report.issues).toContainEqual({
      code: "sheets_skipped",
      severity: "info",
      params: { sheets: "Notes, Codes" },
    });
  });

  test("a question laid out as a table becomes a matrix, flagged for checking, and images are reported", async () => {
    const image = "<w:r><w:drawing/></w:r>";
    const bytes = docx({
      body:
        p("Club survey", { style: "Heading1" }) +
        p(`${r("Rate each part of your visit.")}${image}`) +
        tbl([
          ["", "Poor", "OK", "Good"],
          ["Staff", "", "", ""],
          ["Facilities", "", "", ""],
        ]),
    });
    const option = (cell: string) => ({
      code: null,
      isOther: false,
      texts: [{ language: "en-US", cell, text: null }],
    });
    const plan = planOf(
      [
        {
          ...openTextEntry("P2", "P2"),
          kind: "matrix",
          inputType: null,
          options: [option("T1R2C1"), option("T1R3C1")],
          columns: [option("T1R1C2"), option("T1R1C3"), option("T1R1C4")],
        },
      ],
      { titleCell: "P1" }
    );

    const { payload, report } = await run(prepareFixture("club.docx", bytes), recordedDocumentGenerate(plan));

    expect(payload.name).toBe("Club survey (imported)");
    expect(report.issues).toContainEqual({ code: "table_as_matrix", severity: "warning", questionTag: "P2" });
    expect(report.issues).toContainEqual({
      code: "images_not_imported",
      severity: "warning",
      params: { count: 1 },
    });
  });

  test("a matrix whose texts all sit in one row is not flagged", async () => {
    const { report } = await runFixture("sample-survey-2-word.docx");

    expect(report.issues.map((issue) => issue.code)).not.toContain("table_as_matrix");
  });
});

describe("runDocumentImport: Prompt_Injection", () => {
  /** What a draft says, without the ids each import makes anew. */
  const contentOf = (draft: TSurveyImportDraft) => ({
    name: draft.name,
    languages: draft.languages,
    welcomeCard: draft.welcomeCard,
    elements: elementsOf(draft).map(({ id: _id, choices, rows, columns, ...element }) => ({
      ...element,
      labels: [choices, rows, columns].map((list) =>
        ((list ?? []) as { label: Record<string, string> }[]).map((item) => item.label)
      ),
    })),
    endings: draft.endings.map(({ id: _id, ...ending }) => ending),
  });

  test("produces the same draft as the file without its injected text", async () => {
    const plan = loadRecordedDocumentPlan("prompt-injection.docx");
    const requests: TImportPlanRequest[] = [];
    const withInjection = await run(
      prepareFixture("Event.docx", loadDocumentFixture("prompt-injection.docx")),
      recordedDocumentGenerate(plan, (request) => {
        requests.push(request);
        return undefined;
      })
    );
    const clean = await run(
      prepareFixture("Event.docx", promptInjectionWithoutInjectedText()),
      recordedDocumentGenerate(plan)
    );

    expect(contentOf(withInjection.payload as TSurveyImportDraft)).toEqual(
      contentOf(clean.payload as TSurveyImportDraft)
    );
    expect(withInjection.report.issues).toEqual(clean.report.issues);
    expect(withInjection.payload.name).toBe("Event Feedback Survey (imported)");
    // The injected text reaches the model only inside the data block; nothing outside it quotes the file.
    for (const { system, prompt } of requests) {
      const [outside] = prompt.split("\n<document_lines>\n");
      expect(`${system}\n${outside}`).not.toMatch(/PWNED|SYSTEM:|INSTRUCTION/);
    }
    expect(requests.map(({ prompt }) => prompt).join("\n")).toContain("PWNED");
  });
});

describe("runDocumentImport: cancellation and time", () => {
  const prepared = () => prepareFixture("library-short.xlsx");
  const plan = () => loadRecordedDocumentPlan("library-short.xlsx");

  test("an import stopped before it starts asks the model nothing", async () => {
    const controller = new AbortController();
    controller.abort(new Error("Stopped"));
    const generate = vi.fn(recordedDocumentGenerate(plan()));

    await expect(run(prepared(), generate, { signal: controller.signal })).rejects.toThrow("Stopped");
    expect(generate).not.toHaveBeenCalled();
  });

  test("a Stop while the model plans ends the import before anything is assembled", async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const generate = recordedDocumentGenerate(plan(), () => {
      controller.abort(new Error("Stopped"));
      return undefined;
    });

    await expect(run(prepared(), generate, { signal: controller.signal, onProgress })).rejects.toThrow(
      "Stopped"
    );
    expect(onProgress.mock.calls.map(([stage]) => stage)).toEqual(["ai"]);
  });

  test("an import with no time left to plan anything took too long", async () => {
    const generate = vi.fn(recordedDocumentGenerate(plan()));

    await expect(run(prepared(), generate, { deadlineMs: 1_000 })).rejects.toBeInstanceOf(
      SurveyImportTimeoutError
    );
    expect(generate).not.toHaveBeenCalled();
  });

  test("each call is given the time left before the deadline, less what assembly needs", async () => {
    const timeouts: number[] = [];
    await run(
      prepared(),
      recordedDocumentGenerate(plan(), (request) => {
        timeouts.push(request.timeout);
        return undefined;
      }),
      { deadlineMs: 20_000 }
    );

    expect(timeouts.length).toBeGreaterThan(0);
    expect(Math.max(...timeouts)).toBeLessThanOrEqual(15_000);
  });

  test("a call that times out on every line leaves nothing to assemble: the import took too long", async () => {
    const generate: TImportPlanGenerate = (request) =>
      new Promise((_resolve, reject) => {
        const timer = setTimeout(
          () => reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
          1
        );
        request.abortSignal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(request.abortSignal.reason);
        });
      });

    await expect(run(prepared(), generate)).rejects.toBeInstanceOf(SurveyImportTimeoutError);
  });
});
