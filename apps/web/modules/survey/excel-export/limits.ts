/**
 * Limits of the Excel export (ADR 0017). The export writes what the survey holds, whose own caps
 * (texts, options, languages) already bound the sheet's size; only the format's own ceiling is left.
 */

/**
 * The most characters one xlsx cell holds (Excel's specification). A longer text is cut to fit and
 * marked as cut, and its row is kept.
 */
export const EXCEL_EXPORT_MAX_CELL_CHARS = 32_767;
