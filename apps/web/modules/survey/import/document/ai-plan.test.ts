import { describe, expect, test } from "vitest";
import type { TImportPlanGenerate } from "../core/ai-plan";
import { SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS, SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS } from "../limits";
import { documentQuestionRefs, isSilentDocumentAnswer, planDocumentImport } from "./ai-plan";
import { chunkDocumentLines, countDocumentChunks } from "./chunks";
import type { TDocumentModel } from "./model";
import { readMarkdownDocument } from "./read-markdown";

const entry = (ref: string, kind = "openText") => ({
  ref,
  kind,
  idCell: null,
  sectionCell: null,
  required: false,
  headline: [{ language: "en-US", cell: `A${ref.slice(1)}`, text: null }],
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

const answer = (asked: string[], questions: unknown[], skipped: { ref: string; reason: string }[] = []) => ({
  refs: new Set(asked),
  object: { defaultLanguage: "en-US", languages: ["en-US"], titleCell: null, questions, skipped },
});

describe("documentQuestionRefs", () => {
  test("counts the lines an answer starts a question on", () => {
    expect(documentQuestionRefs(answer(["R1", "R2"], [entry("R1"), entry("R2", "nps")]))).toEqual([
      "R1",
      "R2",
    ]);
  });

  test("leaves out what the checks would not read as a question", () => {
    const counted = documentQuestionRefs(
      answer(
        ["R1", "R2", "R3", "R4", "R5"],
        [
          entry("R1", "welcome"),
          entry("R2", "ending"),
          // Twice: the checks fail the line as a duplicate.
          entry("R3"),
          entry("R3"),
          // Placed and skipped: the checks fail it.
          entry("R4"),
          // Not a line this call was asked about.
          entry("R9"),
          // Does not parse.
          { ref: "R5", kind: "openText" },
        ],
        [{ ref: "R4", reason: "A note" }]
      )
    );

    expect(counted).toEqual([]);
  });

  test("counts nothing from an answer that is not a plan", () => {
    expect(documentQuestionRefs({ refs: new Set(["R1"]), object: { questions: "R1" } })).toEqual([]);
  });
});

describe("planDocumentImport: silent answers and calls in flight", () => {
  const plannedEntry = (ref: string) => ({
    ...entry(ref),
    headline: [{ language: "en-US", cell: ref, text: null }],
  });

  /** A model that plans every line holding a question it is asked about; `silentFirst` calls answer nothing. */
  const modelFor = (model: TDocumentModel, isQuestion: (text: string) => boolean, silentFirst = 0) => {
    const questionKeys = new Set(model.lines.filter((l) => isQuestion(l.cells[0].text)).map((l) => l.key));
    let calls = 0;
    let inFlight = 0;
    const stats = { calls: 0, mostInFlight: 0, asked: [] as string[][], prompts: [] as string[] };
    const generate = async (request: { prompt: string }) => {
      calls += 1;
      stats.calls = calls;
      inFlight += 1;
      stats.mostInFlight = Math.max(stats.mostInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      // The lines asked about, not the ones shown as context after them.
      const data = request.prompt.slice(request.prompt.indexOf("{"), request.prompt.lastIndexOf("}") + 1);
      const asked = (JSON.parse(data) as { lines: { line: string }[] }).lines.map(({ line }) => line);
      stats.asked.push(asked);
      stats.prompts.push(request.prompt);
      const questions =
        calls <= silentFirst ? [] : asked.filter((k) => questionKeys.has(k)).map(plannedEntry);
      return {
        object: { defaultLanguage: "en-US", languages: ["en-US"], titleCell: null, questions, skipped: [] },
        usage: { inputTokens: 10, outputTokens: 10 },
      };
    };
    return { generate: generate as unknown as TImportPlanGenerate, stats };
  };

  const plan = (model: TDocumentModel, generate: TImportPlanGenerate) =>
    planDocumentImport({
      model,
      generate,
      signal: new AbortController().signal,
      deadline: performance.now() + 120_000,
    });

  test("lines of notes the model rightly names nothing of are not unread, and are asked about at most twice", async () => {
    const questions = Array.from({ length: 6 }, (_, i) => `${i + 1}. Question number ${i + 1}?`);
    const notes = Array.from(
      { length: 60 },
      (_, i) => `Note ${i + 1}: how the study is run, not a question.`
    );
    const model = readMarkdownDocument(["# Study", ...questions, ...notes].join("\n\n"));
    const chunks = chunkDocumentLines(
      model,
      model.lines.map((line) => line.key)
    ).length;
    const { generate, stats } = modelFor(model, (text) => text.includes("Question number"));

    const result = await plan(model, generate);

    expect(result.plan.entries.size).toBe(6);
    expect(result.unreadLines).toBe(0);
    // A silent chunk and its two halves, never a retry round on top.
    expect(stats.calls).toBeLessThanOrEqual(3 * chunks);
  });

  test("a chunk first answered with an empty plan gets its questions on the second ask", async () => {
    const model = readMarkdownDocument(
      Array.from({ length: 8 }, (_, i) => `${i + 1}. Question number ${i + 1}?`).join("\n\n")
    );
    const { generate, stats } = modelFor(model, (text) => text.includes("Question number"), 1);

    const result = await plan(model, generate);

    expect(result.plan.entries.size).toBe(8);
    expect(result.unreadLines).toBe(0);
    // Asked again in halves straight away, not left to the retry round, which re-sends the whole chunk
    // with a list of problems.
    expect(stats.asked[1]).toEqual(stats.asked[0].slice(0, stats.asked[1].length));
    expect([...stats.asked[1], ...stats.asked[2]]).toEqual(stats.asked[0]);
    expect(stats.prompts.slice(1).some((prompt) => prompt.includes("had problems"))).toBe(false);
  });

  test("a long document runs SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS calls at once", async () => {
    const model = readMarkdownDocument(
      Array.from(
        { length: 150 },
        (_, i) =>
          `${i + 1}. Question number ${i + 1}: how satisfied are you with this part of the service?\n\n- Very\n- Somewhat\n- Not at all`
      ).join("\n\n")
    );
    const { generate, stats } = modelFor(model, (text) => text.includes("Question number"));

    await plan(model, generate);

    expect(stats.mostInFlight).toBe(SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS);
  });
});

describe("countDocumentChunks", () => {
  test("counts at the shared chunk size, not the smaller planning size, so the size ceiling stays put", () => {
    const model = readMarkdownDocument(
      Array.from({ length: 200 }, (_, i) => `${i + 1}. Question number ${i + 1}?\n\n- Yes\n- No`).join("\n\n")
    );
    const refs = model.lines.map((line) => line.key);

    expect(countDocumentChunks(model)).toBe(
      chunkDocumentLines(model, refs, SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS).length
    );
    expect(countDocumentChunks(model)).toBeLessThan(chunkDocumentLines(model, refs).length);
  });
});

describe("isSilentDocumentAnswer", () => {
  test("is true for an answer that names none of its lines, false for one naming a line with an invalid entry", () => {
    expect(isSilentDocumentAnswer(answer(["R1", "R2"], []))).toBe(true);
    expect(isSilentDocumentAnswer(answer(["R1", "R2"], [{ ref: "R1", kind: "openText" }]))).toBe(false);
    expect(isSilentDocumentAnswer(answer(["R1"], [], [{ ref: "R1", reason: "A picture choice" }]))).toBe(
      false
    );
  });
});
