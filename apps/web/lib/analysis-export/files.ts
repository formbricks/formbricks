/**
 * The file writers of the Analysis export (ENG-6791). Each takes the service's output
 * (`openAnalysisExport`) and returns the file: an Excel workbook as a Buffer, the zip as a stream.
 * They write no response, check no permission and know no route; the route (ENG-6792) owns those.
 */
export {
  buildAnalysisWorkbook,
  type TAnalysisFileOptions,
  type TAnalysisWorkbookOptions,
} from "./analysis-workbook";
export { createAnalysisZip, createSingleFileZip } from "./analysis-zip";
export { XLSX_LIMITS, XlsxLimitError, createXlsxWorkbook } from "./xlsx-writer";
