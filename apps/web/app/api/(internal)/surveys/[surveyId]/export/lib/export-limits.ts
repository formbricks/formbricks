/**
 * The most cells an Excel export may hold, over every sheet. Excel is built whole in memory, so it needs
 * a cap; CSV and the zip stream and have none.
 *
 * PLACEHOLDER (ENG-6792): `undefined` means no cap. ENG-6793 measures the memory a workbook costs and
 * sets the number here. The route turns a refused workbook into a 422 whose detail the manager shows.
 */
export const EXCEL_EXPORT_MAX_CELLS: number | undefined = undefined;
