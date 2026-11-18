import { openZipArchive } from "@/modules/survey/import/core/zip";
import { readCheckedWorkbook } from "@/modules/survey/import/document/read-sheet";
import { EXCEL_EXPORT_SHEETS, type TExcelExportRead, excelExportFromBook } from "../read";

/** An Excel export's bytes read as the upload's worker reads them: the archive, the checked parse, the sheets. */
export const readExportBytes = (bytes: Uint8Array): TExcelExportRead =>
  excelExportFromBook(readCheckedWorkbook(openZipArchive(bytes), EXCEL_EXPORT_SHEETS));
