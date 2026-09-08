import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { generateOrganizationAIObject, streamOrganizationAIObject } from "@/lib/ai/service";
import type { TImportContext, TImportProgress } from "../../types";
import { documentLane } from "./index";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: vi.fn(),
  streamOrganizationAIObject: vi.fn(),
}));

const FIXTURES = join(__dirname, "__fixtures__");
const workspaceId = "clxx1234567890123456789012";

const ctx = (overrides: Partial<TImportContext> = {}): TImportContext => ({
  workspaceId,
  organizationId: "org_1",
  userId: "user_1",
  requestId: "req_1",
  importRunId: "run_1",
  ...overrides,
});

const text = (value: string, codes: string[] = ["en-US"]) =>
  codes.map((languageCode) => ({ languageCode, text: value }));

/** A stand-in model: transcribes the numbered questions of the chunk it was given, 8 per block. */
function draftFromPrompt(prompt: string, codes: string[] = ["en-US"]) {
  const body = prompt.slice(prompt.indexOf("Document"));
  const headlines = [...body.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]);
  const first = /part 1 of|Document:\n/.test(body);
  const last = !/part \d+ of/.test(body) || /Thank you for taking part/.test(body);
  const blocks = [];
  for (let start = 0; start < headlines.length; start += 8) {
    blocks.push({
      name: text(`Block ${start / 8 + 1}`, codes),
      questions: headlines.slice(start, start + 8).map((headline) => ({
        type: "openText",
        headline: text(headline, codes),
        subheader: null,
        required: false,
        placeholder: null,
        longAnswer: true,
        choices: null,
        lowerLabel: null,
        upperLabel: null,
        scale: null,
        range: null,
      })),
    });
  }
  return {
    language: codes[0],
    defaultLanguage: codes[0],
    name: text("Long questionnaire", codes),
    description: null,
    welcomeCard: first
      ? {
          enabled: true,
          headline: text("Welcome", codes),
          subheader: null,
          buttonLabel: text("Start", codes),
        }
      : null,
    ending: last ? { headline: text("Thanks!", codes), subheader: null } : null,
    blocks,
  };
}

const detectionOutput = {
  languages: [{ code: "en-US", confidence: 0.98, evidence: ["Statement 1"] }],
  primaryLanguageCode: "en-US",
  isAmbiguous: false,
  ambiguityReasons: [],
};

function mockModel(onExtraction?: (callIndex: number) => void) {
  let extractions = 0;
  vi.mocked(generateOrganizationAIObject).mockImplementation(async (options) => {
    if (options.schemaName === "FormbricksSurveyImportLanguages") {
      return { object: detectionOutput } as never;
    }
    extractions += 1;
    onExtraction?.(extractions);
    return { object: draftFromPrompt(String(options.prompt)) } as never;
  });
  return () => extractions;
}

const input = (name: string) => ({
  kind: "markdown" as const,
  fileName: name,
  content: { type: "bytes" as const, bytes: readFileSync(join(FIXTURES, name)) },
});

const elementIds = (document: unknown) =>
  (document as { blocks: { elements: { id: string }[] }[] }).blocks.flatMap((block) =>
    block.elements.map((element) => element.id)
  );

beforeEach(() => {
  vi.mocked(generateOrganizationAIObject).mockReset();
  vi.mocked(streamOrganizationAIObject).mockReset();
});

describe("documentLane", () => {
  test("150 questions come back as one document with unique ids, one welcome card, one ending", async () => {
    const extractions = mockModel();
    const progress: TImportProgress[] = [];

    const candidate = await documentLane(
      input("survey-150-questions.md"),
      ctx({ onProgress: (p) => progress.push(p) })
    );

    expect(candidate.document).not.toBeNull();
    const ids = elementIds(candidate.document);
    expect(ids).toHaveLength(150);
    expect(new Set(ids).size).toBe(150);
    const document = candidate.document as {
      blocks: { elements: { headline: Record<string, string> }[] }[];
      welcomeCard: { enabled: boolean };
      endings: unknown[];
      languages: unknown[];
    };
    expect(
      document.blocks.flatMap((block) => block.elements.map((element) => element.headline["en-US"]))
    ).toEqual(
      Array.from(
        { length: 150 },
        (_, index) => `Statement ${index + 1}: our product helps me with task number ${index + 1}.`
      )
    );
    expect(document.welcomeCard.enabled).toBe(true);
    expect(document.endings).toHaveLength(1);
    expect(document.languages).toEqual([{ code: "en-US", default: true, enabled: true }]);
    expect(candidate.source).toMatchObject({
      lane: "ai",
      kind: "markdown",
      chunks: extractions(),
      detectedLanguages: [{ code: "en-US", confidence: 0.98 }],
    });
    expect(extractions()).toBeGreaterThanOrEqual(4);
    expect(candidate.issues).toEqual([
      expect.objectContaining({ code: "chunked", vars: { count: extractions() } }),
    ]);
    expect(progress.map((p) => p.stage)).toEqual([
      "reading",
      "detecting_languages",
      ...Array(extractions()).fill("extracting"),
      "validating",
    ]);
    expect(progress.filter((p) => p.stage === "extracting").map((p) => p.chunk?.index)).toEqual(
      Array.from({ length: extractions() }, (_, index) => index + 1)
    );
    expect(prepareV3SurveyCreateInput({ workspaceId, ...(candidate.document as object) }).ok).toBe(true);
  });

  test("aborting mid-way stops further provider calls", async () => {
    const controller = new AbortController();
    const extractions = mockModel((call) => {
      if (call === 2) controller.abort();
    });

    await expect(
      documentLane(input("survey-150-questions.md"), ctx({ signal: controller.signal }))
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(extractions()).toBe(2);
  });

  test("a failing chunk after successful ones yields a partial document plus chunk_failed", async () => {
    const extractions = mockModel((call) => {
      if (call === 3) throw new Error("provider hiccup");
    });

    const candidate = await documentLane(input("survey-150-questions.md"), ctx());

    expect(candidate.document).not.toBeNull();
    expect(elementIds(candidate.document).length).toBeLessThan(150);
    expect(candidate.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          code: "chunk_failed",
          vars: { index: 3, total: extractions() },
        }),
      ])
    );
  });

  test("a failure before anything was extracted propagates to the route", async () => {
    mockModel(() => {
      throw new Error("quota");
    });
    await expect(documentLane(input("survey-60-questions.md"), ctx())).rejects.toThrow("quota");
  });

  test("short documents skip detection and use the hint as default language; partials are forwarded", async () => {
    const partials: { draft: unknown; blockOffset: number }[] = [];
    vi.mocked(streamOrganizationAIObject).mockImplementation(async (options) => {
      const object = draftFromPrompt(String(options.prompt), ["de-DE"]);
      return {
        partialObjectStream: (async function* () {
          yield { name: object.name };
        })(),
        completion: Promise.resolve(object),
      } as never;
    });

    const candidate = await documentLane(
      {
        kind: "text",
        fileName: "kurz.txt",
        content: { type: "text", text: "1. Wie geht es?\n- gut\n- schlecht\n2. Noch etwas?" },
      },
      ctx({ languageHint: "de", onPartial: (draft, blockOffset) => partials.push({ draft, blockOffset }) })
    );

    expect(generateOrganizationAIObject).not.toHaveBeenCalled();
    expect(candidate.source.detectedLanguages).toBeUndefined();
    expect(partials).toEqual([{ draft: { name: text("Long questionnaire", ["de-DE"]) }, blockOffset: 0 }]);
    const call = vi.mocked(streamOrganizationAIObject).mock.calls[0][0];
    expect(String(call.prompt)).toContain("Default language code: de-DE");
    expect(String(call.prompt)).toMatch(/Allowed language codes: de-DE, /);
    expect((candidate.document as { defaultLanguage: string }).defaultLanguage).toBe("de-DE");
    expect(elementIds(candidate.document)).toHaveLength(2);
  });

  test("an unreadable file never reaches the model", async () => {
    const candidate = await documentLane(
      { kind: "docx", fileName: "x.docx", content: { type: "bytes", bytes: Buffer.from("not a zip") } },
      ctx()
    );
    expect(candidate.document).toBeNull();
    expect(candidate.issues[0].code).toBe("document_unreadable");
    expect(generateOrganizationAIObject).not.toHaveBeenCalled();
  });
});
