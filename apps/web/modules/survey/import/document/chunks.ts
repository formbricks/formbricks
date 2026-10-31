import { SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS, SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS } from "../limits";
import type { TDocumentModel } from "./model";
import { describedLineChars } from "./prompt";

/*
 * How a document's lines are cut into AI calls, apart from the calls themselves (`ai-plan.ts`), so the
 * reader's worker thread can hold a file to `SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS` without loading the AI SDK.
 */

/**
 * Expected output tokens per line: a planned entry's fields where a line starts one, and the parts of
 * cells a split quotes back. Most cells are named whole (`text: null`), so about a quarter of the text
 * is expected to come back, at about 4 characters a token. A chunk that needs more than expected runs
 * out of output tokens and is split, like any other.
 */
const TOKENS_PER_LINE = 10;
const CHARS_PER_TOKEN = 4;

/**
 * Data characters per chunk: half of one call's cap, leaving room for the system prompt and for the
 * lines shown around the chunk's own.
 */
const DOCUMENT_CHUNK_DATA_CHARS = SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS / 2;

const lineCost = (line: TDocumentModel["lines"][number]): { tokens: number; chars: number } => {
  const textChars = line.cells.reduce((sum, cell) => sum + cell.text.length, 0);
  return {
    tokens: TOKENS_PER_LINE + Math.ceil(textChars / CHARS_PER_TOKEN),
    chars: describedLineChars(line),
  };
};

/**
 * Group lines into chunks of at most `SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS` expected output and
 * `DOCUMENT_CHUNK_DATA_CHARS` of data, in document order, as many as it takes.
 */
export function chunkDocumentLines(model: TDocumentModel, refs: readonly string[]): string[][] {
  const lineByKey = new Map(model.lines.map((line) => [line.key, line]));
  const chunks: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  let chars = 0;

  for (const ref of refs) {
    const line = lineByKey.get(ref);
    if (!line) continue;
    const cost = lineCost(line);
    if (
      current.length > 0 &&
      (tokens + cost.tokens > SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS ||
        chars + cost.chars > DOCUMENT_CHUNK_DATA_CHARS)
    ) {
      chunks.push(current);
      current = [];
      tokens = 0;
      chars = 0;
    }
    current.push(ref);
    tokens += cost.tokens;
    chars += cost.chars;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** How many chunks the whole document plans in: what `prepare` holds to `SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS`. */
export const countDocumentChunks = (model: TDocumentModel): number =>
  chunkDocumentLines(
    model,
    model.lines.map((line) => line.key)
  ).length;
