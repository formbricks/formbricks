import { SURVEY_IMPORT_MAX_DRAFT_BYTES } from "@/modules/survey/import/limits";

/**
 * Limits of the Excel export (ADR 0027). The export writes what the survey holds, whose own caps
 * (texts, options, languages) already bound the sheet's size; only the format's own ceiling is left.
 */

/**
 * The most characters one xlsx cell holds (Excel's specification). A longer text is cut to fit and
 * marked as cut, and its row is kept.
 */
export const EXCEL_EXPORT_MAX_CELL_CHARS = 32_767;

/**
 * The most characters of text an imported Excel export may hold in the cells the import reads (ENG-6809):
 * every language cell, Question ID and Type of every row, together. Twice the most a survey may weigh as
 * JSON (`SURVEY_IMPORT_MAX_DRAFT_BYTES`): a sheet holds a survey's texts without their markup, so any
 * export fits with room for the rows a reviewer adds, and a sheet past it could not be saved anyway.
 *
 * Enforced in the upload's worker, before the rows are handed to the server's thread. Cells are counted
 * one by one, not per distinct text: an xlsx can point thousands of cells at one shared string for the
 * cost of one, and each cell is copied on its own when the rows cross threads.
 */
export const EXCEL_EXPORT_IMPORT_MAX_TEXT_CHARS = 2 * SURVEY_IMPORT_MAX_DRAFT_BYTES;

/**
 * The most characters of a headline the Logic column names a question by ("If question “How likely
 * are you to…” is less than 7"). Enough to recognize it; longer ones are cut with an ellipsis.
 */
export const EXCEL_EXPORT_LOGIC_QUESTION_LABEL_CHARS = 60;
