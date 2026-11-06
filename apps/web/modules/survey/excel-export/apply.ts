import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import type { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TSurveyElement, ZSurveyElement, ZSurveyElementId } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { V3_SURVEY_MAX_BLOCKS } from "@/app/api/v3/surveys/schemas";
import { recallToHeadline } from "@/lib/utils/recall";
import { addBlock, renumberAutoNamedBlocks, withFilledCodes } from "@/modules/survey/editor/lib/blocks";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { createSlicer } from "@/modules/survey/import/core/event-loop";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import { neutralize } from "@/modules/survey/import/core/sanitize-text";
import type { TSurveyImportSheetRowSkipCause } from "@/modules/survey/import/types";
import { type TSurveyText, walkSurveyTexts } from "@/modules/survey/lib/survey-texts";
import type { TExcelExportAddableProperty, TExcelExportField, TExcelExportLabels } from "./labels";
import { EXCEL_EXPORT_MAX_CELL_CHARS } from "./limits";
import type { TExcelExportRead, TExcelExportRow } from "./read";
import { toExportedCellText } from "./write";

/**
 * Applying an edited Excel export to its survey (ENG-6809). Rows are matched to the survey by id:
 *
 * - **A row with a key** is one of the survey's texts. A language cell that differs from the text as the
 *   export would write it now replaces it; an empty cell leaves it alone.
 * - **A row without a key** was added in the sheet. One whose Type names a question type adds that
 *   question, in a block of its own after the question above it, with the editor's defaults for the type
 *   and no logic; its Question ID is used when it is free. One whose Type names a field ("Choice 4",
 *   "Row 3", "Lower label") adds it to the question its Question ID names, or else to the question above.
 * - **Rows deleted from the sheet** change nothing: the sheet never removes a question, an option or a
 *   text. Whether a missing row was deleted on purpose can't be told from a sheet.
 *
 * Cells hold plain text: an edited text that was formatted comes back as plain paragraphs, flagged, and
 * `@Label` recalls come back as the recall they were, when the label is still the survey's.
 */

/** A report line's subject: the sheet row, named as the document import names rows. */
const rowTag = (row: number): string => `R${row}`;

/** A sheet that does not match the survey it is imported into: no row's key is one of its texts. */
export const excelExportOtherSurvey = (): SurveyImportInputError =>
  new SurveyImportInputError(
    [
      {
        name: "file",
        reason: "No row of the sheet matches a text of this survey. Was it exported from another survey?",
        code: "excel_export_other_survey",
      },
    ],
    "The sheet is not an export of this survey."
  );

// Inline formatting a plain cell cannot carry: a text that had any of it loses it when edited.
const FORMATTING_TAG = /<(?:a|b|strong|i|em|u|s|strike|del|code|mark|sub|sup|ul|ol|li|h[1-6]|blockquote)\b/i;

// A complete recall token, as the survey stores it and `recallToHeadline` renders it.
const RECALL_TOKEN = /#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g;

// A row's Question ID becomes a new question's id when the element schema takes it, and it is not a
// name every JavaScript object carries (`__proto__`, `constructor`, …): answers are keyed by question id,
// and the schema's charset lets those through.
const OBJECT_PROPERTY_NAMES = new Set(Object.getOwnPropertyNames(Object.prototype));
const isNewElementId = (id: string): boolean =>
  ZSurveyElementId.safeParse(id).success && !OBJECT_PROPERTY_NAMES.has(id);

// Types a row cannot make: a picture selection needs images, a booking needs a Cal.com account.
const UNADDABLE_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.PictureSelection,
  TSurveyElementTypeEnum.Cal,
]);

const SCALE_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
]);

// Which element types carry each field a row may add.
const PROPERTY_TYPES: Record<TExcelExportAddableProperty, ReadonlySet<TSurveyElementTypeEnum> | "all"> = {
  subheader: "all",
  placeholder: new Set([TSurveyElementTypeEnum.OpenText]),
  label: new Set([TSurveyElementTypeEnum.Consent]),
  lowerLabel: SCALE_TYPES,
  upperLabel: SCALE_TYPES,
  ctaButtonLabel: new Set([TSurveyElementTypeEnum.CTA]),
};

const CHOICE_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.MultipleChoiceMulti,
  TSurveyElementTypeEnum.Ranking,
]);

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Each recall token the stored text holds, by the `@Label` the export showed it as. */
const getRecallLabels = (stored: string, survey: TSurvey, textKey: string): Map<string, string> => {
  const labels = new Map<string, string>();
  for (const [token] of stored.matchAll(RECALL_TOKEN)) {
    const label = recallToHeadline({ default: token, [textKey]: token }, survey, false, textKey)[textKey];
    if (label && label !== token && !labels.has(label)) labels.set(label, token);
  }
  return labels;
};

/**
 * A cell's text split around the `@Label`s of the recalls the stored text had: each label becomes its
 * token again. Longest labels first, so `@Name` never takes the start of `@Name of company`.
 */
const splitRecalls = (text: string, labels: ReadonlyMap<string, string>): ({ token: string } | string)[] => {
  if (labels.size === 0) return [text];
  const ordered = [...labels.keys()].sort((a, b) => b.length - a.length);
  const parts: ({ token: string } | string)[] = [];
  let rest = text;
  while (rest) {
    let best: { index: number; label: string } | null = null;
    for (const label of ordered) {
      const index = rest.indexOf(label);
      if (index >= 0 && (!best || index < best.index)) best = { index, label };
    }
    if (!best) break;
    if (best.index > 0) parts.push(rest.slice(0, best.index));
    parts.push({ token: labels.get(best.label) ?? "" });
    rest = rest.slice(best.index + best.label.length);
  }
  if (rest) parts.push(rest);
  return parts;
};

const toLines = (cell: string): string[] =>
  cell
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** A rich text from a plain cell: one paragraph per non-empty line, the text escaped, recalls as tokens. */
const toParagraphs = (cell: string, labels: ReadonlyMap<string, string>): string =>
  toLines(cell)
    .map(
      (line) =>
        `<p>${splitRecalls(line, labels)
          .map((part) => (typeof part === "string" ? escapeHtml(part) : part.token))
          .join("")}</p>`
    )
    .join("");

/**
 * A plain text from a cell, recalls as tokens. A cell holds what the reviewer typed, never HTML, so it
 * is not parsed as such: a text that would render as markup (survey-ui renders a string that parses
 * into elements as HTML) gets its `<` replaced, so it shows as typed.
 *
 * Telling that parses the text, on the server's thread. `markup` remembers each distinct text's answer:
 * a sheet can repeat one long string in every cell at the cost of one shared string, and each distinct
 * text is then parsed once, so what is parsed is bounded by the shared strings part (10 MB).
 */
const toPlainText = (
  cell: string,
  labels: ReadonlyMap<string, string>,
  markup: Map<string, { text: string; escaped: boolean }>
): { text: string; escaped: boolean } => {
  const text = splitRecalls(toLines(cell).join(" "), labels)
    .map((part) => (typeof part === "string" ? part : part.token))
    .join("");
  let shown = markup.get(text);
  if (shown === undefined) {
    shown = neutralize(text);
    markup.set(text, shown);
  }
  return shown;
};

/**
 * Where each of the sheet's language columns goes in the survey: `default` for the default language's
 * text, a code for a translation, or `null` for a language the survey no longer has. The export writes
 * the default language first, so the first column is the default's whenever the survey has no
 * languages, or still has that one as its default.
 */
const getTextKeys = (read: TExcelExportRead, survey: TSurvey): Map<string, string | null> => {
  const defaultCode = survey.languages.find((language) => language.default)?.language.code;
  const codes = new Set(survey.languages.map(({ language }) => language.code));
  return new Map(
    read.languages.map(({ code }, index) => {
      if (code === "default" || code === defaultCode || (index === 0 && survey.languages.length === 0)) {
        return [code, "default"];
      }
      return [code, codes.has(code) ? code : null];
    })
  );
};

/** Set `value` at a dotted `path` of index and property segments, as `walkSurveyTexts` writes them. */
const setI18nText = (survey: TSurvey, path: string, textKey: string, value: string): void => {
  let holder: unknown = survey;
  for (const segment of path.split(".")) {
    holder = (holder as Record<string, unknown>)[segment];
  }
  (holder as Record<string, string>)[textKey] = value;
};

/** The element id a text key names, for texts that belong to an element: `element.<id>.…`. */
const elementIdOfKey = (key: string): string | null => {
  const [kind, id] = key.split(".");
  if (kind !== "element" || !id) return null;
  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
};

const findElement = (survey: TSurvey, id: string): { element: TSurveyElement; blockIndex: number } | null => {
  for (const [blockIndex, block] of survey.blocks.entries()) {
    const element = block.elements.find((candidate) => candidate.id === id);
    if (element) return { element, blockIndex };
  }
  return null;
};

export interface TExcelExportApplyContext {
  read: TExcelExportRead;
  /** Reads the sheet's Type cells back, in the export's language and English. */
  labels: TExcelExportLabels;
  /** A new element of `type` with the editor's defaults and a fresh id, before the sheet's texts. */
  newElement: (type: TSurveyElementTypeEnum) => TSurveyElement;
  /** The importer's translations, for what the editor names a new block's buttons. */
  t: TFunction;
  /** What the export marks a cut text with, in the importer's language. */
  truncatedSuffix: string;
}

export interface TExcelExportApplied {
  /** The survey with the sheet applied: a copy, the input is left as it is. */
  survey: TSurvey;
  issues: TSurveyImportPipelineIssue[];
}

/** One sheet applied row by row, in the sheet's order, onto a copy of the survey. */
class ExcelExportApplication {
  private readonly issues: TSurveyImportPipelineIssue[] = [];
  private survey: TSurvey;
  /** The keys of the texts the sheet changed, in any of their languages. */
  private readonly updatedKeys = new Set<string>();
  /** Rows whose key names one of the survey's ids: what says the sheet is this survey's. */
  private matched = 0;
  /** The question the last row belonged to: a field row without a Question ID adds to it. */
  private currentElementId: string | null = null;
  /** Where the next new question's block goes: after this block, or first when `null`. */
  private anchorBlockIndex: number | null = null;
  /** Each question a row created or added to, with those rows, checked once all rows are read. */
  private readonly changedElements = new Map<string, number[]>();
  private readonly createdElements = new Set<string>();
  private readonly textKeys: Map<string, string | null>;
  private readonly textsByKey: Map<string, TSurveyText>;
  /** Each distinct plain text as it is shown; see `toPlainText`. */
  private readonly markup = new Map<string, { text: string; escaped: boolean }>();

  constructor(
    private readonly source: TSurvey,
    private readonly context: TExcelExportApplyContext
  ) {
    this.survey = structuredClone(source);
    this.textKeys = getTextKeys(context.read, source);
    // Every text the survey has, empty or not: a translation may fill a text the export showed empty.
    this.textsByKey = new Map(walkSurveyTexts(source).map((text) => [text.key, text]));
  }

  async run(): Promise<TExcelExportApplied> {
    const { read } = this.context;
    for (const { code, column } of read.languages) {
      if (column === null) {
        this.issues.push({
          code: "sheet_language_skipped",
          severity: "warning",
          params: { code, cause: "column_missing" },
        });
      } else if (this.textKeys.get(code) === null) {
        this.issues.push({
          code: "sheet_language_skipped",
          severity: "warning",
          params: { code, cause: "not_in_survey" },
        });
      }
    }
    for (const row of read.duplicateRows) this.skip(row, "duplicate_key");

    // The merge runs on the server's thread, and a row can cost a markup parse per language: it yields
    // by elapsed time, as the import's sanitizer does.
    const slice = createSlicer();
    for (const row of read.rows) {
      await slice(); // NOSONAR(typescript:S9382) -- a deliberate yield every slice
      if (row.key) this.applyKeyedRow(row);
      else this.applyAddedRow(row);
    }
    if (this.matched === 0) throw excelExportOtherSurvey();

    this.checkChangedElements();
    this.issues.unshift({
      code: "texts_updated",
      severity: "info",
      params: { count: this.updatedKeys.size },
    });
    // Codes for what the sheet added, as the editor gives a question or option it adds; a sheet that only
    // changes texts leaves the survey's codes as they are.
    return {
      survey: this.changedElements.size > 0 ? withFilledCodes(this.survey) : this.survey,
      issues: this.issues,
    };
  }

  private skip(row: number, cause: TSurveyImportSheetRowSkipCause): void {
    this.issues.push({ code: "sheet_row_skipped", severity: "warning", params: { row, cause } });
  }

  private markChanged(elementId: string, row: number): void {
    const rows = this.changedElements.get(elementId);
    if (rows) rows.push(row);
    else this.changedElements.set(elementId, [row]);
  }

  /**
   * A text from a cell, recalls kept. A rich text (a headline, a description) becomes paragraphs when
   * it was stored as HTML or has several lines; a one-line one stored plain stays plain, as the other
   * imports store it. Every other text is plain.
   */
  private toStoredText(
    row: number,
    cell: string,
    isRichText: boolean,
    labels: ReadonlyMap<string, string>,
    stored = ""
  ): string {
    if (isRichText && (stored.includes("<") || toLines(cell).length > 1)) return toParagraphs(cell, labels);
    const plain = toPlainText(cell, labels, this.markup);
    if (plain.escaped) {
      this.issues.push({ code: "markup_escaped", severity: "info", questionTag: rowTag(row) });
    }
    return plain.text;
  }

  /** An added row's cells as a text in each of the survey's languages; `null` with no default text. */
  private toI18n(row: TExcelExportRow, isRichText: boolean): TI18nString | null {
    const i18n: Record<string, string> = {};
    for (const [code, cell] of row.cells) {
      const textKey = this.textKeys.get(code);
      if (!textKey || cell.trim() === "") continue;
      const text = this.toStoredText(row.row, cell, isRichText, new Map());
      if (text) i18n[textKey] = text;
    }
    return i18n.default ? (i18n as TI18nString) : null;
  }

  /** A keyed row moves where new questions go, and which question a field row adds to. */
  private followKey(key: string): void {
    const elementId = elementIdOfKey(key);
    if (elementId) {
      const found = findElement(this.survey, elementId);
      if (found) {
        this.currentElementId = elementId;
        this.anchorBlockIndex = found.blockIndex;
      }
    } else if (key.startsWith("ending.")) {
      this.currentElementId = null;
      this.anchorBlockIndex = this.survey.blocks.length - 1;
    }
  }

  private applyKeyedRow(row: TExcelExportRow): void {
    const text = this.textsByKey.get(row.key);
    if (!text) {
      this.skip(row.row, "unknown_key");
      return;
    }
    // The welcome card's keys hold no id, so every survey with one shares them: only a row keyed by a
    // question, block or ending id says the sheet was exported from this survey.
    if (!row.key.startsWith("welcomeCard.")) this.matched += 1;
    this.followKey(row.key);
    // A text the survey never stored (an "Other" placeholder nobody typed) was not exported either.
    if (!text.value) return;

    for (const [code, cell] of row.cells) {
      const textKey = this.textKeys.get(code);
      // An empty cell leaves the text alone, as does one that reads as the survey's text now.
      if (!textKey || cell.trim() === "") continue;
      const current = toExportedCellText({
        text,
        textKey,
        survey: this.source,
        truncatedSuffix: this.context.truncatedSuffix,
      });
      if (cell === current) continue;
      const params = { row: row.row, language: code };
      // A text cut to fit its cell cannot come back whole: the sheet holds only its start.
      if (current.length >= EXCEL_EXPORT_MAX_CELL_CHARS) {
        this.issues.push({
          code: "sheet_text_not_imported",
          severity: "warning",
          params: { ...params, cause: "cut_on_export" },
        });
        continue;
      }

      const stored = text.value[textKey] ?? "";
      const next = this.toStoredText(
        row.row,
        cell,
        text.isRichText,
        getRecallLabels(stored, this.source, textKey),
        stored
      );
      if (next === "" || next === stored) continue;
      if (text.isRichText && FORMATTING_TAG.test(stored)) {
        this.issues.push({ code: "sheet_formatting_dropped", severity: "warning", params });
      }
      setI18nText(this.survey, text.path, textKey, next);
      this.updatedKeys.add(row.key);
    }
  }

  private applyAddedRow(row: TExcelExportRow): void {
    const { labels } = this.context;
    const type = labels.elementType(row.type);
    if (type) {
      this.addElement(row, type);
      return;
    }
    const field = labels.field(row.type);
    if (field) {
      this.addField(row, field);
      return;
    }
    this.skip(row.row, "unknown_type");
  }

  /** A new question: its own block after the question above, the editor's defaults, the row's texts. */
  private addElement(row: TExcelExportRow, type: TSurveyElementTypeEnum): void {
    if (UNADDABLE_TYPES.has(type)) return this.skip(row.row, "unsupported_type");
    // A survey holds at most this many blocks, and each new question takes one: past it, the rest of the
    // sheet's new questions would be refused on save anyway, after costing a block each to build here.
    if (this.survey.blocks.length >= V3_SURVEY_MAX_BLOCKS) return this.skip(row.row, "survey_full");
    if (row.questionId && !isNewElementId(row.questionId)) return this.skip(row.row, "id_invalid");
    if (row.questionId && findElement(this.survey, row.questionId)) return this.skip(row.row, "id_taken");
    const headline = this.toI18n(row, true);
    if (!headline) return this.skip(row.row, "no_text");

    const element = {
      ...this.context.newElement(type),
      ...(row.questionId ? { id: row.questionId } : {}),
      headline,
    } as TSurveyElement;
    // Options come from the rows below, not from the editor's empty placeholders.
    if (CHOICE_TYPES.has(type)) Object.assign(element, { choices: [] });
    if (type === TSurveyElementTypeEnum.Matrix) Object.assign(element, { rows: [], columns: [] });

    const index = this.anchorBlockIndex === null ? 0 : this.anchorBlockIndex + 1;
    const added = addBlock(this.context.t, this.survey, { elements: [element] }, index);
    if (!added.ok) return this.skip(row.row, "invalid_question");

    this.survey = added.data;
    this.anchorBlockIndex = index;
    this.currentElementId = element.id;
    this.createdElements.add(element.id);
    this.markChanged(element.id, row.row);
    this.issues.push({ code: "sheet_question_added", severity: "info", params: { row: row.row } });
  }

  /** A field of a question: an option, a matrix row or column, or a text the question had none of. */
  private addField(row: TExcelExportRow, field: TExcelExportField): void {
    const elementId = row.questionId || this.currentElementId;
    const found = elementId ? findElement(this.survey, elementId) : null;
    if (!found) return this.skip(row.row, "no_question");
    const element = found.element as TSurveyElement & Record<string, unknown>;
    this.currentElementId = element.id;

    const isRichText = field.kind === "property" && field.property === "subheader";
    const text = this.toI18n(row, isRichText);
    if (!text) return this.skip(row.row, "no_text");

    switch (field.kind) {
      case "choice": {
        if (!CHOICE_TYPES.has(element.type)) return this.skip(row.row, "field_not_in_question");
        const choices = element.choices as { id: string; label: TI18nString }[];
        // "Other" stays last, as the editor keeps it.
        const otherIndex = choices.findIndex((choice) => choice.id === "other");
        choices.splice(otherIndex < 0 ? choices.length : otherIndex, 0, { id: createId(), label: text });
        break;
      }
      case "matrixRow":
      case "matrixColumn": {
        if (element.type !== TSurveyElementTypeEnum.Matrix) {
          return this.skip(row.row, "field_not_in_question");
        }
        const list = element[field.kind === "matrixRow" ? "rows" : "columns"] as {
          id: string;
          label: TI18nString;
        }[];
        list.push({ id: createId(), label: text });
        break;
      }
      case "property": {
        const types = PROPERTY_TYPES[field.property];
        if (types !== "all" && !types.has(element.type)) return this.skip(row.row, "field_not_in_question");
        // A field an existing question has is a keyed row: a second one is nothing to add.
        if (!this.createdElements.has(element.id) && element[field.property] !== undefined) {
          return this.skip(row.row, "field_taken");
        }
        element[field.property] = text;
        break;
      }
    }
    this.markChanged(element.id, row.row);
    this.issues.push({ code: "sheet_option_added", severity: "info", params: { row: row.row } });
  }

  /**
   * Hold every question the sheet created or added to against the element schema: one that fails is put
   * back as it was — a created one removed with its block — and its first row reported, its other lines
   * dropped.
   */
  private checkChangedElements(): void {
    for (const [elementId, rows] of this.changedElements) {
      const found = findElement(this.survey, elementId);
      if (!found || ZSurveyElement.safeParse(found.element).success) continue;

      const original = findElement(this.source, elementId);
      if (original) {
        const block = this.survey.blocks[found.blockIndex];
        block.elements = block.elements.map((element) =>
          element.id === elementId ? structuredClone(original.element) : element
        );
      } else {
        this.survey.blocks.splice(found.blockIndex, 1);
        this.survey.blocks = renumberAutoNamedBlocks(this.survey.blocks);
      }

      const dropped = new Set(rows);
      for (let index = this.issues.length - 1; index >= 0; index -= 1) {
        const { code, params } = this.issues[index];
        if (
          (code === "sheet_question_added" || code === "sheet_option_added") &&
          dropped.has(Number(params?.row))
        ) {
          this.issues.splice(index, 1);
        }
      }
      this.skip(rows[0], "invalid_question");
    }
  }
}

/**
 * Apply an Excel export to `survey`. Throws `SurveyImportInputError` (422, `excel_export_other_survey`)
 * when no row of the sheet is one of the survey's texts.
 */
export const applyExcelExport = (
  survey: TSurvey,
  context: TExcelExportApplyContext
): Promise<TExcelExportApplied> => new ExcelExportApplication(survey, context).run();
