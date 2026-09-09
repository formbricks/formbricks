import { IMPORTED_SURVEY_MAX_CHOICES } from "@/app/api/v3/surveys/generate/constants";
import type { TGeneratedDraftText } from "@/app/api/v3/surveys/generate/schemas";

/**
 * Deterministic corrections read from the document text itself, applied after the model answered and
 * before the draft is repaired. Table-shaped sources (CSV, XLSX, Markdown tables) put a question and its
 * type cell on one line; the model reads "Single Select (dropdown)" right about two times in three and a
 * "Rows: … | Columns: …" cell less often than that. A line lookup does not guess.
 *
 * Only two hints, both anchored on the question's own headline being found on a line:
 * - a single-choice question whose line (headline removed) says "dropdown" → `dropdown: true`
 * - a line with "Rows: a; b | Columns: x; y" → a matrix with exactly those rows and columns, when the
 *   question is a matrix without them or the line calls the question a matrix
 */

type TDraftQuestion = Record<string, unknown> & { type?: unknown; headline?: unknown };

const DROPDOWN_HINT = /\bdrop-?down\b/;
const MATRIX_WORD = /\bmatrix\b/;
/** "Rows: Staff; Facilities \| Columns: Poor; Good" — the pipe may be escaped (Markdown cell) or absent (prose). */
const MATRIX_HINT = /\brows?\s*:\s*([^|]+?)\s*\\?\|?\s*\bcol(?:umn)?s?\s*:\s*([^|]+)/i;
const MIN_ANCHOR_LENGTH = 8;

/** Lower-cased, whitespace-collapsed, Markdown punctuation removed: what a table cell and a headline share. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[|\\"“”*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry as { text?: unknown } | null)?.text)
    .filter((text): text is string => typeof text === "string");
}

/** The same language shape as `template`: a plain string, or one entry per language code the template uses. */
function likeText(template: unknown, text: string): TGeneratedDraftText {
  if (Array.isArray(template)) {
    const codes = [
      ...new Set(
        template
          .map((entry) => (entry as { languageCode?: unknown } | null)?.languageCode)
          .filter((code): code is string => typeof code === "string")
      ),
    ];
    if (codes.length > 0) return codes.map((languageCode) => ({ languageCode, text }));
  }
  return text;
}

function splitLabels(cell: string): string[] {
  const separator = cell.includes(";") ? ";" : ",";
  return cell
    .split(separator)
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .slice(0, IMPORTED_SURVEY_MAX_CHOICES);
}

type TLine = { raw: string; normalized: string };

/** The document line that carries this question, with the headline blanked out of the normalized copy. */
function findQuestionLine(
  lines: readonly TLine[],
  question: TDraftQuestion
): { raw: string; rest: string } | null {
  for (const text of textsOf(question.headline)) {
    const needle = normalize(text);
    if (needle.length < MIN_ANCHOR_LENGTH) continue;
    for (const line of lines) {
      const index = line.normalized.indexOf(needle);
      if (index === -1) continue;
      return {
        raw: line.raw,
        rest: `${line.normalized.slice(0, index)} ${line.normalized.slice(index + needle.length)}`,
      };
    }
  }
  return null;
}

function hasEntries(value: unknown, min: number): boolean {
  return Array.isArray(value) && value.length >= min;
}

function applyHints(question: TDraftQuestion, line: { raw: string; rest: string }): TDraftQuestion {
  let next = question;

  if (
    question.type === "multipleChoiceSingle" &&
    question.dropdown !== true &&
    DROPDOWN_HINT.test(line.rest)
  ) {
    next = { ...next, dropdown: true };
  }

  const wantsMatrix = question.type === "matrix" || MATRIX_WORD.test(line.rest);
  const matrix = wantsMatrix ? MATRIX_HINT.exec(line.raw) : null;
  if (matrix) {
    const rows = splitLabels(matrix[1]);
    const columns = splitLabels(matrix[2]);
    if (rows.length >= 1 && columns.length >= 2) {
      next = {
        ...next,
        type: "matrix",
        choices: null,
        rows: hasEntries(question.rows, 1)
          ? question.rows
          : rows.map((row) => likeText(question.headline, row)),
        columns: hasEntries(question.columns, 2)
          ? question.columns
          : columns.map((column) => likeText(question.headline, column)),
      };
    }
  }

  return next;
}

/** Applies the document hints to every question of a raw draft; anything not shaped like a draft passes through. */
export function applySourceHints(raw: unknown, sourceText: string): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { blocks?: unknown }).blocks)) return raw;
  const lines: TLine[] = sourceText
    .split("\n")
    .map((line) => ({ raw: line, normalized: normalize(line) }))
    .filter((line) => line.normalized.length >= MIN_ANCHOR_LENGTH);
  if (lines.length === 0) return raw;

  const blocks = (raw as { blocks: unknown[] }).blocks.map((block) => {
    if (!block || typeof block !== "object" || !Array.isArray((block as { questions?: unknown }).questions))
      return block;
    const questions = (block as { questions: unknown[] }).questions.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const question = entry as TDraftQuestion;
      const line = findQuestionLine(lines, question);
      return line ? applyHints(question, line) : question;
    });
    return { ...(block as object), questions };
  });
  return { ...(raw as object), blocks };
}
