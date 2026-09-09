import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CHUNK_MAX_TOTAL_QUESTIONS,
  chunkDocumentText,
  defaultChunkLimits,
  isQuestionStart,
  segmentDocument,
} from "./chunk";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

const questionNumbers = (text: string) =>
  [...text.matchAll(/^(\d+)\. Statement/gm)].map((match) => Number(match[1]));

describe("chunkDocumentText", () => {
  test("150 questions with sections: about a chunk per section for one language, more for two, no question split", () => {
    const text = fixture("survey-150-questions.md");

    // 24 questions per call for one language; the ten 15-question sections are preferred cut points.
    const single = chunkDocumentText(text, { languageCount: 1 }).chunks;
    expect(single.length).toBeGreaterThanOrEqual(7);
    expect(single.length).toBeLessThanOrEqual(10);

    const bilingual = chunkDocumentText(text, { languageCount: 2 }).chunks;
    expect(bilingual.length).toBeGreaterThanOrEqual(single.length);
    expect(bilingual.length).toBeLessThanOrEqual(20);

    for (const chunks of [single, bilingual]) {
      const numbers = chunks.flatMap((chunk) => questionNumbers(chunk.text));
      expect(numbers).toEqual(Array.from({ length: 150 }, (_, index) => index + 1));
      expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index + 1));
      expect(chunks.every((chunk) => chunk.total === chunks.length)).toBe(true);
      // Every chunk ends with an option line or the closing line, never with a bare question.
      for (const chunk of chunks) {
        const lastLine = chunk.text.trimEnd().split("\n").at(-1) ?? "";
        expect(/^\d+\. Statement/.test(lastLine)).toBe(false);
      }
      expect(chunks.reduce((sum, chunk) => sum + chunk.estimatedQuestions, 0)).toBe(150);
    }
  });

  test("60 questions without headings in one language: three chunks of at most 24", () => {
    const { chunks, issues } = chunkDocumentText(fixture("survey-60-questions.md"), { languageCount: 1 });
    expect(chunks).toHaveLength(3);
    expect(issues).toEqual([]);
    expect(questionNumbers(chunks[0].text).at(-1)).toBe(24);
    expect(questionNumbers(chunks[2].text)).toEqual(Array.from({ length: 12 }, (_, index) => 49 + index));
  });

  test("the total cap drops the remainder with text_truncated", () => {
    const text = Array.from(
      { length: 260 },
      (_, index) => `${index + 1}. Question ${index + 1}?\n- yes\n- no`
    ).join("\n\n");
    const { chunks, issues } = chunkDocumentText(text, { languageCount: 1 });

    expect(chunks.reduce((sum, chunk) => sum + chunk.estimatedQuestions, 0)).toBe(CHUNK_MAX_TOTAL_QUESTIONS);
    expect(issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "text_truncated",
        vars: { max: 200, dropped: 60 },
      }),
    ]);
  });

  test("a question keeps its options across a blank line; tables are one unit", () => {
    const segments = segmentDocument(
      "1. Pick one\n\n- a\n- b\n2. Next?\n| Question | Type |\n| --- | --- |\n| Q3 | nps |\n| Q4 | text |\n## Section\nplain"
    );
    expect(segments.map((segment) => segment.questions)).toEqual([1, 1, 2, 0]);
    expect(segments[0].lines.join("\n")).toContain("- b");
    expect(segments[3].hardBoundaryBefore).toBe(true);
  });

  test("question start patterns and default limits", () => {
    expect(["1. x", "12) y", "Q3 z", "Question 4", "Frage 7:", "[ ] Ja"].every(isQuestionStart)).toBe(true);
    expect(["- option", "   3. indented", "plain text"].some(isQuestionStart)).toBe(false);
    expect(defaultChunkLimits(1)).toEqual({ targetQuestions: 24, maxChars: 10_000 });
    expect(defaultChunkLimits(2)).toEqual({ targetQuestions: 12, maxChars: 5_000 });
    expect(defaultChunkLimits(9)).toEqual({ targetQuestions: 8, maxChars: 1_111 });
    expect(chunkDocumentText("", { languageCount: 1 }).chunks).toEqual([]);
  });
});
