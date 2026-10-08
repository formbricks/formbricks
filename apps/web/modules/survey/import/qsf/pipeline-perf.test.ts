import { beforeEach, describe, expect, test, vi } from "vitest";
import { cpuMsSince } from "./__fixtures__/cpu-time";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import {
  PAGE_BREAK,
  blocksElement,
  flowBlock,
  flowElement,
  flowEnd,
  optionsElement,
  question,
  resetFlowIds,
  survey as surveyExport,
} from "./__fixtures__/qsf-builders";
import { loadRecordedPlan, recordedGenerate, refsInPrompt } from "./__fixtures__/recorded-plans";
import type { TQsfPlanGenerate } from "./ai-plan";
import { checkQsfDraft } from "./final-gate";
import { QSF_DRAFT_MAX_BYTES, fitQsfSurveyToCreateLimit, measureQsfDraftBytes } from "./fit-draft";
import { normalizeQualtricsLanguageCode } from "./language-codes";
import { QSF_MAX_TEXT_CHARS } from "./limits";
import { QSF_RECALL_FALLBACK } from "./piped-text";
import { QsfImportInputError, prepareQsfImport, runQsfImport } from "./pipeline";
import type { TQsfSurvey } from "./qsf-model";

/**
 * What the stages are handed, recorded by pass-through spies. The wall-clock bounds below are coarse
 * sanity checks — another process on the machine stretches every one of them — so each test's real
 * guard is structural: what work reached a stage, or how often the import gave the event loop back.
 */
const seen = vi.hoisted(() => ({
  yields: 0,
  /** This process's CPU time at the last yield, and the most it spent between two yields. */
  cpuAtLastYield: 0,
  longestStretchMs: 0,
  languageCodeLookups: 0,
  longestPipedScan: 0,
  /** The last sanitized texts, which the plan and the assembly copy from. */
  texts: null as Parameters<typeof import("./fit-draft").fitQsfSurveyToCreateLimit>[1] | null,
  /** For each `planQsfImport` and `assembleQsfDraft` call: whether its survey already fit the body. */
  stages: [] as { stage: "plan" | "assemble"; fits: boolean }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn(async () => true) }));
vi.mock("node:timers/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:timers/promises")>();
  return {
    ...original,
    setImmediate: (...args: Parameters<typeof original.setImmediate>) => {
      seen.yields += 1;
      const { user, system } = process.cpuUsage();
      seen.longestStretchMs = Math.max(seen.longestStretchMs, (user + system - seen.cpuAtLastYield) / 1000);
      seen.cpuAtLastYield = user + system;
      return original.setImmediate(...args);
    },
  };
});
vi.mock("./language-codes", async (importOriginal) => {
  const original = await importOriginal<typeof import("./language-codes")>();
  return {
    ...original,
    normalizeQualtricsLanguageCode: (raw: string) => {
      seen.languageCodeLookups += 1;
      return original.normalizeQualtricsLanguageCode(raw);
    },
  };
});
vi.mock("./piped-text", async (importOriginal) => {
  const original = await importOriginal<typeof import("./piped-text")>();
  return {
    ...original,
    collectEmbeddedDataReferences: (text: string) => {
      seen.longestPipedScan = Math.max(seen.longestPipedScan, text.length);
      return original.collectEmbeddedDataReferences(text);
    },
  };
});

/** Whether a survey, as a stage gets it, already fits the create's body on the fit's own bound. */
const fitsTheBody = (survey: TQsfSurvey, texts: Parameters<typeof fitQsfSurveyToCreateLimit>[1]): boolean =>
  fitQsfSurveyToCreateLimit(structuredClone(survey), texts).issues.length === 0;

vi.mock("./sanitize-text", async (importOriginal) => {
  const original = await importOriginal<typeof import("./sanitize-text")>();
  return {
    ...original,
    sanitizeQsfTexts: async (...args: Parameters<typeof original.sanitizeQsfTexts>) => {
      const texts = await original.sanitizeQsfTexts(...args);
      seen.texts = texts;
      return texts;
    },
  };
});
vi.mock("./ai-plan", async (importOriginal) => {
  const original = await importOriginal<typeof import("./ai-plan")>();
  return {
    ...original,
    planQsfImport: (params: Parameters<typeof original.planQsfImport>[0]) => {
      seen.stages.push({
        stage: "plan",
        fits: seen.texts !== null && fitsTheBody(params.survey, seen.texts),
      });
      return original.planQsfImport(params);
    },
  };
});
vi.mock("./assemble", async (importOriginal) => {
  const original = await importOriginal<typeof import("./assemble")>();
  return {
    ...original,
    assembleQsfDraft: (params: Parameters<typeof original.assembleQsfDraft>[0]) => {
      seen.stages.push({ stage: "assemble", fits: fitsTheBody(params.survey, params.texts) });
      return original.assembleQsfDraft(params);
    },
  };
});

beforeEach(() => {
  seen.yields = 0;
  seen.languageCodeLookups = 0;
  seen.longestPipedScan = 0;
  seen.texts = null;
  seen.stages = [];
});

/**
 * CPU time a synchronous call takes, in milliseconds. Unlike wall time, other processes on the
 * machine do not stretch it, so it can hold a budget.
 */
const cpuMs = (work: () => unknown): number => {
  const start = process.cpuUsage();
  work();
  return cpuMsSince(start);
};

/**
 * The most CPU time the import spends without giving the event loop back: the longest synchronous
 * stretch, which on the server stalls every other request on the pod for as long. Measured in this
 * process's CPU time between two yields rather than in wall time, so a loaded machine — whose other
 * processes stretch every wall-clock reading — does not move it.
 */
const longestStretchMs = async (work: () => Promise<unknown>): Promise<number> => {
  const start = process.cpuUsage();
  seen.cpuAtLastYield = start.user + start.system;
  seen.longestStretchMs = 0;
  await work();
  const end = process.cpuUsage();
  return Math.max(seen.longestStretchMs, (end.user + end.system - seen.cpuAtLastYield) / 1000);
};

const runLarge = (prepared: ReturnType<typeof prepareQsfImport>) =>
  runQsfImport({
    prepared,
    workspaceId: "clxx1234567890123456789012",
    organizationId: "org_1",
    userId: null,
    signal: new AbortController().signal,
    deadlineMs: 120_000,
    onProgress: () => undefined,
    generate: recordedGenerate(loadRecordedPlan("large-150.qsf")),
  });

/**
 * A hostile file: one question with 200 choices and 200 answers, and `variants` `Language` keys that
 * all spell German — `de`, `DE`, ` de`, `\tDe`, … — each with an empty translation of both lists. Case
 * and whitespace variants normalize to one language, so the language cap never fired on them, and
 * every key used to be checked against every choice and answer: ~9 s at 390,000 keys.
 */
function buildLanguageVariantsQsf(variants: number): Record<string, unknown> {
  const options = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [String(i + 1), { Display: `Option ${i + 1}` }])
  );
  const language: Record<string, unknown> = {};
  const spellings = ["de", "dE", "De", "DE"];
  const space = [" ", "\t", "\n", "\r"];
  for (let index = 0; index * spellings.length < variants; index++) {
    // `index` in base 4, written in whitespace, before each spelling: every key distinct.
    let prefix = "";
    for (let rest = index; rest > 0; rest = Math.floor(rest / 4)) prefix += space[rest % 4];
    for (const spelling of spellings) language[`${prefix}${spelling}`] = { Choices: {}, Answers: {} };
  }
  return {
    SurveyEntry: { SurveyName: "Variants", SurveyLanguage: "EN" },
    SurveyElements: [
      {
        Element: "SQ",
        PrimaryAttribute: "QID1",
        Payload: {
          QuestionText: "Rate each",
          QuestionType: "Matrix",
          Selector: "Likert",
          Choices: options,
          Answers: options,
          Language: language,
        },
      },
      { Element: "BL", Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }] },
      { Element: "FL", Payload: { Flow: [{ Type: "Block", ID: "BL_1" }] } },
    ],
  };
}

describe("event loop", () => {
  test("prepareQsfImport never scans a 15 MB text for piped text", async () => {
    // One question text of `${e://` repeated, no closing brace: every match attempt used to scan up to
    // 200 characters on, about 1.7 s for the whole text.
    const qsf = {
      SurveyEntry: { SurveyName: "Long text", SurveyLanguage: "EN" },
      SurveyElements: [
        {
          Element: "SQ",
          PrimaryAttribute: "QID1",
          Payload: { QuestionText: "${e://".repeat(2_500_000), QuestionType: "TE", Selector: "SL" },
        },
        {
          Element: "BL",
          Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }],
        },
        { Element: "FL", Payload: { Flow: [{ Type: "Block", ID: "BL_1" }] } },
      ],
    };

    // Structural: no text past the sanitizer's length is ever scanned for piped text.
    expect(cpuMs(() => prepareQsfImport(qsf, "long-text.qsf"))).toBeLessThanOrEqual(50);
    expect(seen.longestPipedScan).toBeLessThanOrEqual(QSF_MAX_TEXT_CHARS);
  });

  test("prepareQsfImport cuts every other long string from the file before it trims or matches it", async () => {
    // Names cut before they are trimmed; codes, numbers, a message reference and a URL refused by
    // their length first.
    const pad = " ".repeat(3_000_000);
    const qsf = {
      SurveyEntry: { SurveyName: `Name${pad}`, SurveyLanguage: `${pad}EN` },
      SurveyElements: [
        {
          Element: "SQ",
          PrimaryAttribute: "QID1",
          Payload: {
            QuestionText: "Q",
            DataExportTag: `Q1${pad}`,
            QuestionType: "TE",
            Selector: "SL",
            Language: { [`${pad}DE`]: { QuestionText: "F" } },
          },
        },
        {
          Element: "BL",
          Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }],
        },
        {
          Element: "FL",
          Payload: {
            Flow: [
              { Type: "EmbeddedData", EmbeddedData: [{ Field: `f${pad}` }] },
              { Type: "Block", ID: "BL_1" },
            ],
          },
        },
        { Element: "SO", Payload: { EOSMessage: `MS_${"a".repeat(3_000_000)}`, EOSRedirectURL: `${pad}x` } },
      ],
    };

    expect(cpuMs(() => prepareQsfImport(qsf, "long-strings.qsf"))).toBeLessThanOrEqual(50);
  });

  test("prepareQsfImport refuses a file of Language key variants at once, before reading any key", async () => {
    const qsf = buildLanguageVariantsQsf(20_000);
    let refused: unknown;

    const used = cpuMs(() => {
      try {
        prepareQsfImport(qsf, "variants.qsf");
      } catch (error) {
        refused = error;
      }
    });

    // Structural: refused on the count of keys.
    expect((refused as QsfImportInputError).invalidParams[0].name).toBe(
      "qsf.SurveyElements.0.Payload.Language"
    );
    // The survey's own default language is the one code looked up; no `Language` key is.
    expect(seen.languageCodeLookups).toBe(1);
    // A count of the keys, natively; reading them against 400 options took about half a second here.
    expect(used).toBeLessThanOrEqual(50);
  });

  test("and holds it for well under a second at 390,000 variants, where it used to take about 9 s", async () => {
    const qsf = buildLanguageVariantsQsf(390_000);
    let refused: unknown;

    const used = cpuMs(() => {
      try {
        prepareQsfImport(qsf, "variants.qsf");
      } catch (error) {
        refused = error;
      }
    });

    expect(refused).toBeInstanceOf(QsfImportInputError);
    // The survey's own default language is the one code looked up; no `Language` key is.
    expect(seen.languageCodeLookups).toBe(1);
    // V8 enumerating 390,000 keys once (~80 ms here); the route's JSON.parse of that body takes longer.
    expect(used).toBeLessThanOrEqual(400);
  });

  test("prepareQsfImport holds it for at most ~50 ms on the largest file", async () => {
    const qsf = loadQsfFixture("large-150.qsf");

    // Coarse, cold: ~7 ms on an idle laptop. Cold, the CPU time also counts the JIT compiling on other
    // threads, which a loaded machine stretches, so the plan's 50 ms budget is held warm, below.
    expect(cpuMs(() => prepareQsfImport(qsf, "large-150.qsf"))).toBeLessThan(1_000);
    // The plan's budget, in CPU time so other processes do not stretch it: ~2 ms warm.
    expect(cpuMs(() => prepareQsfImport(qsf, "large-150.qsf"))).toBeLessThanOrEqual(50);
  });

  test(
    "runQsfImport never holds it for long, sanitizer included, the AI mocked",
    { timeout: 30_000 },
    async () => {
      // A first run pays for JIT and for compiling the survey schemas, once per process.
      await runLarge(prepareQsfImport(loadQsfFixture("large-150.qsf"), "large-150.qsf"));
      const prepared = prepareQsfImport(loadQsfFixture("large-150.qsf"), "large-150.qsf");
      // Every text with real markup, choices included: over half a second of sanitizing in all, in
      // about 600 small texts. It has to come in slices.
      for (const text of prepared.survey.texts.values()) {
        text.byLanguage.set(prepared.survey.defaultLanguage, "<span>x</span>".repeat(30));
      }

      seen.yields = 0;
      const stretchMs = await longestStretchMs(() => runLarge(prepared));

      // Structural: over half a second of sanitizing comes in ~10 ms slices, so the import gives the
      // event loop back dozens of times; one that stops yielding does so a handful of times.
      expect(seen.yields).toBeGreaterThanOrEqual(20);
      // Coarse: ~20 ms warm, the longest stretch one synchronous check of the draft; unsliced, the
      // sanitizing alone is over half a second.
      expect(stretchMs).toBeLessThan(400);
    }
  );
});

// Here rather than beside the other pipeline tests: these build and assemble multi-megabyte surveys,
// and a file's tests run one after another, so they never load the machine while an event-loop
// measurement above runs.
describe("a draft too large for the create's request body", () => {
  /** 49 Qualtrics codes for distinct survey languages, from what the reader makes of them. */
  const translationCodes = (): string[] => {
    const seen = new Map<string, string>();
    for (const region of ["", "-AT", "-CH", "-BE", "-US", "-GB"]) {
      for (const code of [
        "AR",
        "BG",
        "CS",
        "DA",
        "DE",
        "EL",
        "ES",
        "ET",
        "FI",
        "FR",
        "HE",
        "HI",
        "HR",
        "HU",
      ]) {
        const normalized = normalizeQualtricsLanguageCode(`${code}${region}`);
        if (normalized && normalized !== "en-US" && !seen.has(normalized))
          seen.set(normalized, `${code}${region}`);
      }
    }
    return [...seen.values()].slice(0, 49);
  };

  /** `questions` multiple choice questions of `options` options, on pages of 10, in `languages`. */
  const buildQsf = (shape: {
    questions: number;
    options: number;
    languages: string[];
    textChars: number;
  }) => {
    const pad = "x".repeat(shape.textChars);
    const refs = Array.from({ length: shape.questions }, (_, q) => `QID${q + 1}`);
    const elements = refs.map((ref, q) => {
      const choices = Object.fromEntries(
        Array.from({ length: shape.options }, (_, i) => [
          String(i + 1),
          { Display: `Option ${i + 1} of ${q}` },
        ])
      );
      const language = Object.fromEntries(
        shape.languages.map((code) => [
          code,
          { QuestionText: `${code} question ${q} ${pad}`, Choices: choices },
        ])
      );
      return {
        Element: "SQ",
        PrimaryAttribute: ref,
        Payload: {
          QuestionText: `Question ${q} ${pad}`,
          DataExportTag: `Q${q + 1}`,
          QuestionType: "MC",
          Selector: "SAVR",
          Choices: choices,
          Language: language,
        },
      };
    });
    const blocks = Array.from({ length: Math.ceil(shape.questions / 10) }, (_, b) => ({
      ID: `BL_${b}`,
      Description: `Block ${b}`,
      BlockElements: refs.slice(b * 10, b * 10 + 10).map((ref) => ({ Type: "Question", QuestionID: ref })),
    }));
    return {
      SurveyEntry: { SurveyName: "Large", SurveyLanguage: "EN" },
      SurveyElements: [
        ...elements,
        { Element: "BL", Payload: blocks },
        { Element: "FL", Payload: { Flow: blocks.map((block) => ({ Type: "Block", ID: block.ID })) } },
      ],
    };
  };

  const answerAsMultipleChoice: TQsfPlanGenerate = async (request) => ({
    object: {
      questions: refsInPrompt(request.prompt).map((ref) => ({
        ref,
        type: "multipleChoiceSingle",
        required: false,
        choicesFrom: "choices",
        rowsFrom: null,
        columnsFrom: null,
        otherChoiceKey: null,
        noneChoiceKey: null,
        labelKey: null,
        excludedKeys: [],
        contactFields: [],
        inputType: null,
        scale: null,
        range: null,
        format: null,
        logicNotes: [],
      })),
      skipped: [],
      pages: [],
    },
  });

  /** Run the import, measuring the longest the event loop is held once the stream is open. */
  const runQsf = async (qsf: Record<string, unknown>) => {
    const prepared = prepareQsfImport(qsf, "large.qsf");
    let result: Awaited<ReturnType<typeof runQsfImport>> | undefined;
    const stretchMs = await longestStretchMs(async () => {
      result = await runQsfImport({
        prepared,
        workspaceId: "clxx1234567890123456789012",
        organizationId: "org_1",
        userId: "user_1",
        signal: new AbortController().signal,
        deadlineMs: 120_000,
        onProgress: () => undefined,
        generate: answerAsMultipleChoice,
      });
    });
    if (!result) throw new Error("the import returned nothing");
    return { ...result, stretchMs };
  };

  test(
    "cuts languages, last declared first, from 200 questions of 15 options in 50 languages",
    { timeout: 120_000 },
    async () => {
      const result = await runQsf(
        buildQsf({ questions: 200, options: 15, languages: translationCodes(), textChars: 0 })
      );

      // Structural: the survey was cut to fit before it was planned, so the plan and the assembly only
      // ever saw what fits one create body.
      expect(seen.stages.map((stage) => stage.stage)).toEqual(["plan", "assemble"]);
      expect(seen.stages.every((stage) => stage.fits)).toBe(true);
      // Coarse: the longest stretch left is the create's own request schema on that ~2 MB draft, ~1.3 s;
      // uncut, the 4.3 MB draft's took about 4.5 s.
      expect(result.stretchMs).toBeLessThan(3_000);
      expect(measureQsfDraftBytes(result.payload)).toBeLessThanOrEqual(QSF_DRAFT_MAX_BYTES);
      expect(result.report.summary.questions).toBe(200);
      const cut = result.report.issues.filter(
        (issue) => issue.code === "language_skipped" && issue.params?.cause === "draft_too_large"
      );
      expect(cut.length).toBeGreaterThan(0);
      expect(result.report.summary.languages).toHaveLength(50 - cut.length);
      expect(result.report.summary.languages[0]).toBe("en-US");
      expect(cut.map((issue) => issue.params?.code)).not.toContain("en-US");
      expect(checkQsfDraft(result.payload)).toEqual([]);
    }
  );

  test(
    "cuts trailing questions from a one-language survey of very long texts",
    { timeout: 60_000 },
    async () => {
      // 200 questions of 20,000-character texts: about 4 MB in one language.
      const result = await runQsf(buildQsf({ questions: 200, options: 2, languages: [], textChars: 20_000 }));

      expect(seen.stages.map((stage) => stage.stage)).toEqual(["plan", "assemble"]);
      expect(seen.stages.every((stage) => stage.fits)).toBe(true);
      // Coarse: few, long texts are cheap to check, and sliced everywhere else. ~60 ms.
      expect(result.stretchMs).toBeLessThan(300);
      expect(measureQsfDraftBytes(result.payload)).toBeLessThanOrEqual(QSF_DRAFT_MAX_BYTES);
      const cut = result.report.issues.filter(
        (issue) => issue.code === "question_skipped" && issue.params?.cause === "draft_too_large"
      );
      expect(cut.length).toBeGreaterThan(0);
      expect(result.report.summary.questions).toBe(200 - cut.length);
      // Cut before planning, the trailing run of questions, in flow order.
      expect(cut.map((issue) => issue.questionTag)).toEqual(
        Array.from({ length: cut.length }, (_, index) => `Q${200 - cut.length + index + 1}`)
      );
      expect(result.payload.blocks.flatMap((block) => block.elements).at(-1)?.id).toBe(
        `Q${200 - cut.length}`
      );
      expect(checkQsfDraft(result.payload)).toEqual([]);
    }
  );

  test(
    "shows the fallback for a pipe to a question cut to fit, in the ending and in kept questions, and says so",
    { timeout: 60_000 },
    async () => {
      // 120 questions of 20,000-character texts in one language: the trailing ones are cut before
      // planning. The end message recalls two of them and a kept one; Q70 recalls a kept and a cut one.
      const words = (seed: string, length: number) =>
        Array.from({ length: Math.ceil(length / 4) }, (_, i) => `${seed}w${i}`)
          .join(" ")
          .slice(0, length);
      const pipe = (qid: string) => `\${q://${qid}/ChoiceGroup/SelectedChoices}`;
      const extra: Record<number, string> = {
        70: `Recall of kept Q2: [${pipe("QID2")}] and of cut Q118: [${pipe("QID118")}].`,
      };
      resetFlowIds();
      const elements: string[] = [];
      const questions = Array.from({ length: 120 }, (_, index) => {
        const n = index + 1;
        elements.push(`QID${n}`);
        if (n % 5 === 0 && n < 120) elements.push(PAGE_BREAK);
        return question({
          qid: `QID${n}`,
          text: `Question ${n}: ${extra[n] ?? ""} ${words(`q${n}`, 20_000)}`,
          type: "MC",
          selector: "SAVR",
          choices: [1, 2, 3, 4].map((option) => ({ display: `Option ${option} of ${n}` })),
        });
      });
      const endMessage = `Cut Q118 said [${pipe("QID118")}], cut Q120 said [${pipe("QID120")}], kept Q2 said [${pipe("QID2")}].`;
      const qsf = surveyExport(
        "Recall of cut",
        "EN",
        [
          ...questions,
          blocksElement([{ id: "BL_1", description: "All", type: "Default", elements }]),
          flowElement([flowBlock("BL_1"), flowEnd()]),
          optionsElement({ EOSMessage: endMessage }),
        ],
        120
      );

      const result = await runQsf(qsf);

      const cut = result.report.issues
        .filter((issue) => issue.code === "question_skipped" && issue.params?.cause === "draft_too_large")
        .map((issue) => issue.questionTag);
      expect(cut).toEqual(expect.arrayContaining(["Q118", "Q120"]));
      expect(cut).not.toContain("Q70");

      const ending = result.payload.endings[0];
      const endText = ending?.type === "endScreen" ? ending.headline["en-US"] : "";
      expect(endText).toContain(
        `Cut Q118 said [${QSF_RECALL_FALLBACK}], cut Q120 said [${QSF_RECALL_FALLBACK}]`
      );
      expect(endText).toContain("kept Q2 said [#recall:Q2/fallback:...#]");
      const q70 = result.payload.blocks
        .flatMap((block) => block.elements)
        .find((element) => element.id === "Q70");
      expect(q70?.headline["en-US"]).toContain(
        `Recall of kept Q2: [#recall:Q2/fallback:...#] and of cut Q118: [${QSF_RECALL_FALLBACK}].`
      );
      expect(result.report.issues).toEqual(
        expect.arrayContaining([
          { code: "piped_text_removed", severity: "warning", params: { count: 2, subject: "ending" } },
          { code: "piped_text_removed", severity: "warning", questionTag: "Q70", params: { count: 1 } },
        ])
      );
      expect(checkQsfDraft(result.payload)).toEqual([]);
    }
  );
});
