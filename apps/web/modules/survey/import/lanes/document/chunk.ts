import { IMPORT_MAX_QUESTIONS, IMPORT_MAX_TEXT_CHARS } from "../../limits";
import { importWarning } from "../../report";
import type { TImportIssue } from "../../types";

/**
 * Chunking for long documents (D4 option C). A chunk is sized by the model's 8192 output-token budget,
 * not by the schema cap: every text is emitted once per language, so a bilingual file gets about half
 * the questions per call. Chunks split on headings, page breaks and question starts, never between a
 * question and its options.
 */

export type TChunk = {
  index: number;
  total: number;
  text: string;
  estimatedQuestions: number;
};

export type TChunkOptions = {
  languageCount: number;
  /** Overrides for tests; defaults derive from `languageCount`. */
  targetQuestions?: number;
  maxChars?: number;
};

/** Beyond this the remainder is dropped with `text_truncated`: nobody imports a 200-question survey in one go. */
export const CHUNK_MAX_TOTAL_QUESTIONS = IMPORT_MAX_QUESTIONS;
export const CHUNK_MAX_TOTAL_CHARS = IMPORT_MAX_TEXT_CHARS;

// Sized for a 16k output budget with reasoning tokens counted against it: 40/16k overflowed live.
const QUESTIONS_PER_CALL_BUDGET = 24;
const CHARS_PER_CALL_BUDGET = 10_000;

export function defaultChunkLimits(languageCount: number): { targetQuestions: number; maxChars: number } {
  const languages = Math.max(1, languageCount);
  return {
    targetQuestions: Math.max(8, Math.floor(QUESTIONS_PER_CALL_BUDGET / languages)),
    maxChars: Math.floor(CHARS_PER_CALL_BUDGET / languages),
  };
}

const HEADING = /^#{1,6}\s+\S/;
const PAGE_BREAK = /^---\s*$/;
const QUESTION_START = [
  /^\d{1,3}[.)]\s+\S/,
  /^Q\s?\d{1,3}\b/i,
  /^(?:Question|Frage|Pregunta|Domanda|Vraag|Question n°)\s*\d{1,3}\b/i,
  /^\[\s?\]\s*\S/,
];
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;
const INDENTED = /^\s{2,}\S/;

export function isQuestionStart(line: string): boolean {
  return QUESTION_START.some((pattern) => pattern.test(line));
}

type TSegment = { lines: string[]; questions: number; hardBoundaryBefore: boolean };

/**
 * Splits the text into segments that must never be divided: a question with its options, a heading
 * with what follows it, a table with all its rows. Also counts the questions each segment holds.
 */
export function segmentDocument(text: string): TSegment[] {
  const lines = text.split("\n");
  const segments: TSegment[] = [];
  let current: TSegment | null = null;
  let inTable = false;

  const start = (hardBoundaryBefore: boolean): TSegment => {
    const segment: TSegment = { lines: [], questions: 0, hardBoundaryBefore };
    segments.push(segment);
    return segment;
  };

  for (const line of lines) {
    const isTableRow = TABLE_ROW.test(line);
    if (isTableRow) {
      if (!inTable || !current) {
        current = start(false);
        inTable = true;
      }
      current.lines.push(line);
      // Every body row of a pipe table is a candidate question (question-list spreadsheets).
      if (!TABLE_SEPARATOR.test(line) && current.lines.length > 2) current.questions += 1;
      continue;
    }
    inTable = false;

    if (HEADING.test(line) || PAGE_BREAK.test(line)) {
      current = start(true);
      current.lines.push(line);
      continue;
    }

    if (isQuestionStart(line) && !INDENTED.test(line)) {
      current = start(false);
      current.lines.push(line);
      current.questions += 1;
      continue;
    }

    // A blank line closes nothing by itself; options after a blank line still belong to the question.
    if (!current) current = start(false);
    current.lines.push(line);
  }

  return segments.filter((segment) => segment.lines.some((line) => line.trim().length > 0));
}

function segmentText(segment: TSegment): string {
  return segment.lines.join("\n").replace(/^\n+|\n+$/g, "");
}

/**
 * Builds chunks from the unbreakable segments: a chunk closes when adding the next segment would exceed
 * the question target or the char budget, and hard boundaries (headings, page breaks) are preferred
 * cut points once a chunk is at least half full.
 */
export function chunkDocumentText(
  text: string,
  options: TChunkOptions
): { chunks: TChunk[]; issues: TImportIssue[] } {
  const limits = { ...defaultChunkLimits(options.languageCount), ...omitUndefined(options) };
  const issues: TImportIssue[] = [];
  const segments = segmentDocument(text);

  const drafts: { parts: string[]; questions: number; chars: number }[] = [];
  let current = { parts: [] as string[], questions: 0, chars: 0 };
  let totalQuestions = 0;
  let totalChars = 0;
  let dropped = 0;

  const close = () => {
    if (current.parts.length > 0) drafts.push(current);
    current = { parts: [], questions: 0, chars: 0 };
  };

  for (const segment of segments) {
    const body = segmentText(segment);
    const chars = body.length + 2;

    if (
      totalQuestions + segment.questions > CHUNK_MAX_TOTAL_QUESTIONS ||
      totalChars + chars > CHUNK_MAX_TOTAL_CHARS
    ) {
      dropped += Math.max(segment.questions, 0);
      continue;
    }

    const wouldOverflow =
      current.parts.length > 0 &&
      (current.questions + segment.questions > limits.targetQuestions ||
        current.chars + chars > limits.maxChars);
    const preferredCut =
      segment.hardBoundaryBefore && current.questions >= Math.ceil(limits.targetQuestions / 2);

    if (wouldOverflow || preferredCut) close();

    // A single segment larger than the char budget cannot be split further; it becomes its own chunk.
    current.parts.push(body);
    current.questions += segment.questions;
    current.chars += chars;
    totalQuestions += segment.questions;
    totalChars += chars;
  }
  close();

  if (dropped > 0) {
    issues.push(
      importWarning({
        code: "text_truncated",
        vars: { max: CHUNK_MAX_TOTAL_QUESTIONS, dropped },
        message: `The document has more than ${CHUNK_MAX_TOTAL_QUESTIONS} questions; the last ${dropped} were not imported.`,
      })
    );
  }

  const chunks = drafts.map((draft, index) => ({
    index: index + 1,
    total: drafts.length,
    text: draft.parts.join("\n\n"),
    estimatedQuestions: draft.questions,
  }));
  return { chunks, issues };
}

function omitUndefined(options: TChunkOptions): { targetQuestions?: number; maxChars?: number } {
  return {
    ...(options.targetQuestions !== undefined ? { targetQuestions: options.targetQuestions } : {}),
    ...(options.maxChars !== undefined ? { maxChars: options.maxChars } : {}),
  };
}
