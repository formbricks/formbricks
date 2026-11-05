/**
 * Limits of the Excel export (ADR 0025). The export writes what the survey holds, whose own caps
 * (texts, options, languages) already bound the sheet's size; only the format's own ceiling is left.
 */

/**
 * The most characters one xlsx cell holds (Excel's specification). A longer text is cut to fit and
 * marked as cut, and its row is kept.
 */
export const EXCEL_EXPORT_MAX_CELL_CHARS = 32_767;

/**
 * The most characters of a headline the Logic column names a question by ("If question “How likely
 * are you to…” is less than 7"). Enough to recognize it; longer ones are cut with an ellipsis.
 */
export const EXCEL_EXPORT_LOGIC_QUESTION_LABEL_CHARS = 60;
