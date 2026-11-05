import MarkdownIt from "markdown-it";
import { surveyImportFileUnreadable } from "../core/errors";
import type { TSurveyImportTextEncoding } from "../core/sniff";
import {
  SURVEY_IMPORT_MARKDOWN_MAX_CHARS,
  SURVEY_IMPORT_WORD_MAX_PARAGRAPHS,
  SURVEY_IMPORT_WORD_MAX_TABLES,
  SURVEY_IMPORT_WORD_MAX_TABLE_CELLS,
} from "../limits";
import { documentLimitExceeded } from "./errors";
import { type TDocumentCell, type TDocumentLine, type TDocumentModel, buildDocumentModel } from "./model";

/**
 * The Markdown reader of the document import: a questionnaire written as Markdown, read into the same
 * keyed model as a Word file (`read-word.ts`), since it has the same shape — flowing paragraphs, lists
 * and tables. So the AI plans it with the Word layout:
 *
 * - each line of text is a line of one cell (`P12`): a heading, a paragraph's line, a list item with
 *   its number or bullet at the start ("1. ", "- "), as a Word list's label is. A line break inside a
 *   paragraph starts a new line, because a questionnaire's lines are its questions and options;
 * - each table row is a line (`T2R3`) with a cell per column (`T2R3C1`); the delimiter row is not one;
 * - inline markup is not text: emphasis, code marks, link targets and HTML tags are dropped, their text
 *   kept, and escapes are read (`\|` is a `|`). Images are counted, for the report.
 *
 * Markdown is plain text, so the sniffer reads it as a CSV; `looksLikeMarkdown` tells the two apart.
 * Paragraphs, tables and cells are held to the Word limits, and the text, before it is parsed, to
 * `SURVEY_IMPORT_MARKDOWN_MAX_CHARS`.
 */

type TToken = ReturnType<MarkdownIt["parse"]>[number];

/** `html`: HTML is markup, not text; tags are dropped and the text between them kept. */
const markdown = new MarkdownIt("default", { html: true, linkify: false, typographer: false });

/** A GFM table's delimiter row: `|---|:--:|`, at least one pipe and one dash. */
const TABLE_DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
/** An ATX heading: `# Title`. */
const HEADING_LINE = /^ {0,3}#{1,6}\s+\S/;
/** A list item: `- text`, `* text`, `+ text`, `1. text`, `1) text`. */
const LIST_LINE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+\S/;
/** YAML front matter at the very start of the file, which is metadata, not the questionnaire. */
const FRONT_MATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/** Delimiters a CSV question list may use; a Markdown file's prose has them too, but not on a grid. */
const CSV_DELIMITERS = [",", ";", "\t"] as const;
/** Share of lines with the same field count, past one field, that makes text a CSV grid. */
const CSV_GRID_SHARE = 0.6;

/** Whether the lines split into the same number of fields (more than one) under one delimiter. */
const isCsvGrid = (lines: readonly string[]): boolean =>
  CSV_DELIMITERS.some((delimiter) => {
    const counts = new Map<number, number>();
    for (const line of lines) {
      const fields = line.split(delimiter).length;
      counts.set(fields, (counts.get(fields) ?? 0) + 1);
    }
    let modal = { fields: 1, lines: 0 };
    for (const [fields, count] of counts) if (count > modal.lines) modal = { fields, lines: count };
    return modal.fields > 1 && modal.lines / lines.length >= CSV_GRID_SHARE;
  });

/**
 * Whether text the sniffer read as a CSV is a Markdown questionnaire: a Markdown table (a row of pipes
 * over a delimiter row), or headings and list items in text that is no CSV grid — a question list
 * exported from a spreadsheet, `1. Age,Single,18-24` included, stays a CSV.
 */
export const looksLikeMarkdown = (text: string): boolean => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return false;

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].includes("|") && lines[index].includes("-") && TABLE_DELIMITER_ROW.test(lines[index])) {
      if (lines[index - 1].includes("|")) return true;
    }
  }

  const marked = lines.filter((line) => HEADING_LINE.test(line) || LIST_LINE.test(line)).length;
  return marked >= 2 && !isCsvGrid(lines);
};

/** An inline token's text: its words, line breaks as `\n`, markup dropped. Counts the images it holds. */
const inlineText = (token: TToken, counts: { images: number }): string => {
  let text = "";
  for (const child of token.children ?? []) {
    switch (child.type) {
      case "text":
      case "code_inline":
        text += child.content;
        break;
      case "softbreak":
      case "hardbreak":
        text += "\n";
        break;
      case "image":
        counts.images += 1;
        break;
      default:
        // Emphasis, links and HTML tags: markup around text that comes as its own `text` tokens.
        break;
    }
  }
  return text;
};

interface TReadState {
  lines: TDocumentLine[];
  paragraphs: number;
  tables: number;
  tableCells: number;
  images: number;
  title: string | null;
}

const addParagraph = (state: TReadState, text: string): void => {
  state.paragraphs += 1;
  if (state.paragraphs > SURVEY_IMPORT_WORD_MAX_PARAGRAPHS) {
    throw documentLimitExceeded(
      "paragraphs",
      "file",
      `The document must not have more than ${SURVEY_IMPORT_WORD_MAX_PARAGRAPHS} paragraphs`
    );
  }
  if (text.trim() === "") return;
  const key = `P${state.paragraphs}`;
  state.lines.push({ key, cells: [{ key, text }] });
};

/** Each line of a block's text as a paragraph, the first one prefixed with a list item's label. */
const addTextLines = (state: TReadState, text: string, label: string): void => {
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .forEach((line, index) => addParagraph(state, index === 0 ? `${label}${line}` : line));
};

/** A table's rows, from its `table_open` token on, as lines; returns the index after `table_close`. */
const readTable = (state: TReadState, tokens: readonly TToken[], start: number): number => {
  state.tables += 1;
  if (state.tables > SURVEY_IMPORT_WORD_MAX_TABLES) {
    throw documentLimitExceeded(
      "tables",
      "file",
      `The document must not have more than ${SURVEY_IMPORT_WORD_MAX_TABLES} tables`
    );
  }
  const table = `T${state.tables}`;
  let row = 0;
  let column = 0;
  let cells: TDocumentCell[] = [];
  let index = start + 1;
  for (; index < tokens.length && tokens[index].type !== "table_close"; index += 1) {
    const token = tokens[index];
    if (token.type === "tr_open") {
      row += 1;
      column = 0;
      cells = [];
    } else if (token.type === "th_open" || token.type === "td_open") {
      column += 1;
      state.tableCells += 1;
      if (state.tableCells > SURVEY_IMPORT_WORD_MAX_TABLE_CELLS) {
        throw documentLimitExceeded(
          "table_cells",
          "file",
          `The document's tables must not have more than ${SURVEY_IMPORT_WORD_MAX_TABLE_CELLS} cells`
        );
      }
    } else if (token.type === "inline") {
      // A cell is one line of the table: a `<br>` in it is markup, not a new row.
      const text = inlineText(token, state).replaceAll("\n", " ").trim();
      if (text !== "") cells.push({ key: `${table}R${row}C${column}`, text });
    } else if (token.type === "tr_close" && cells.length > 0) {
      state.lines.push({ key: `${table}R${row}`, cells, table });
    }
  }
  return index;
};

/**
 * Read a Markdown questionnaire (text, and the encoding the upload was decoded as) into the document
 * model, laid out as a Word file's. Throws `SurveyImportInputError` — a 422 — past the Word limits or
 * the Markdown character cap (`document_limit_exceeded`) or for a file with no text (`file_unreadable`).
 */
export const readMarkdownDocument = (
  text: string,
  encoding: TSurveyImportTextEncoding = "utf-8"
): TDocumentModel => {
  // Before parsing: the parser reads all of it, and markup can be crafted to be slow to parse.
  if (text.length > SURVEY_IMPORT_MARKDOWN_MAX_CHARS) {
    throw documentLimitExceeded(
      "source_size",
      "file",
      `The Markdown file must not exceed ${SURVEY_IMPORT_MARKDOWN_MAX_CHARS} characters`
    );
  }
  const tokens = markdown.parse(text.replace(FRONT_MATTER, ""), {});
  const state: TReadState = { lines: [], paragraphs: 0, tables: 0, tableCells: 0, images: 0, title: null };

  /** The label of the list item whose first block is next: "1. ", "- ", or "" outside one. */
  let label = "";
  let headingLevel = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    switch (token.type) {
      case "list_item_open":
        // An ordered item's number is in `info`, its `.` or `)` in `markup`; a bullet's marker in `markup`.
        label = `${token.info}${token.markup} `;
        break;
      case "heading_open":
        headingLevel = Number(token.tag.slice(1));
        break;
      case "inline": {
        const blockText = inlineText(token, state);
        if (headingLevel > 0 && state.title === null && blockText.trim() !== "") {
          state.title = blockText.replaceAll("\n", " ").trim();
        }
        addTextLines(state, blockText, label);
        label = "";
        headingLevel = 0;
        break;
      }
      case "fence":
      case "code_block":
        addTextLines(state, token.content, label);
        label = "";
        break;
      case "table_open":
        index = readTable(state, tokens, index);
        label = "";
        break;
      default:
        // Block structure (paragraph, list and blockquote marks), rules and HTML blocks carry no text.
        break;
    }
  }

  if (state.lines.length === 0) throw surveyImportFileUnreadable("The document has no text");
  return buildDocumentModel("docx", state.lines, { title: state.title, encoding, images: state.images });
};
