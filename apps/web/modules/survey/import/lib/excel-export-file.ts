import { ZId } from "@formbricks/types/common";
import {
  EXCEL_EXPORT_KEY_HEADER,
  EXCEL_EXPORT_META_FORMAT,
  EXCEL_EXPORT_META_ROWS,
  EXCEL_EXPORT_META_SHEET,
  EXCEL_EXPORT_META_SURVEY_ID,
  isExcelExportMetaLayout,
} from "@/modules/survey/excel-export/format";
import { type TZipArchive, openZipArchive } from "@/modules/survey/import/core/zip";

/**
 * Whether an `.xlsx` is laid out as a Formbricks Excel export (ENG-6809), told in the browser from a few
 * parts of it: the workbook's meta sheet `formbricks` comes after its first sheet and is laid out as this
 * version writes it (`isExcelExportMetaLayout`, the rule the server's reader holds it to), with a survey
 * id; and the first sheet, the texts, has the key column, `key` in column A.
 *
 * Without Formbricks AI, the import dialog uploads only such a workbook: the server reads it without AI
 * when the survey it names is one the user may update, and sends any other workbook to the AI document
 * import. It is a hint for the user's sake, never a check the server relies on: the server reads and
 * checks the file again, under its own limits, and decides.
 *
 * The archive is opened with the upload's zip guard (`openZipArchive`), so a zip bomb costs its
 * directory here as it does on the server. Anything that cannot be read is not an export.
 */

/** Column letters by zero-based index, as far as the meta sheet's cells reach. */
const COLUMNS = "ABC";

const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const OFFICE_DOCUMENT_TYPE = `${RELATIONSHIPS_NS}/officeDocument`;
const SHARED_STRINGS_TYPE = `${RELATIONSHIPS_NS}/sharedStrings`;

const parseXml = (archive: TZipArchive, path: string): Document | null => {
  const bytes = archive.read(path);
  if (!bytes) return null;
  const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "application/xml");
  return document.getElementsByTagName("parsererror").length > 0 ? null : document;
};

const elements = (node: Document | Element, localName: string): Element[] =>
  Array.from(node.getElementsByTagNameNS("*", localName));

/** A relationship's target as an archive path, resolved from the part that names it. */
const resolvePart = (fromPart: string, target: string): string =>
  new URL(target, `https://part/${fromPart}`).pathname.slice(1);

/** Where a part's relationships are: `xl/workbook.xml` → `xl/_rels/workbook.xml.rels`. */
const relationshipsOf = (part: string): string => {
  const slash = part.lastIndexOf("/");
  return `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`;
};

/** The relationships of `part`, by id and by type. */
const readRelationships = (archive: TZipArchive, part: string) => {
  const document = parseXml(archive, relationshipsOf(part));
  const relationships = document ? elements(document, "Relationship") : [];
  const targetOf = (relationship: Element | undefined) => {
    const target = relationship?.getAttribute("Target");
    return target ? resolvePart(part, target) : null;
  };
  return {
    byId: (id: string) =>
      targetOf(relationships.find((relationship) => relationship.getAttribute("Id") === id)),
    byType: (type: string) =>
      targetOf(relationships.find((relationship) => relationship.getAttribute("Type") === type)),
  };
};

/** A string item's text: its runs' texts, without the phonetic guides some editors add. */
const itemText = (item: Element): string =>
  elements(item, "t")
    .filter((text) => text.parentElement?.localName !== "rPh")
    .map((text) => text.textContent ?? "")
    .join("");

/** The meta sheet's cells by reference (`A1`), as text; shared strings read only when a cell needs them. */
const readCells = (sheet: Document, sharedStrings: () => string[]): Map<string, string> => {
  const cells = new Map<string, string>();
  for (const cell of elements(sheet, "c")) {
    const reference = cell.getAttribute("r");
    if (!reference) continue;
    const type = cell.getAttribute("t");
    const value = elements(cell, "v")[0]?.textContent ?? "";
    if (type === "s") {
      cells.set(reference, sharedStrings()[Number(value)] ?? "");
    } else if (type === "inlineStr") {
      const item = elements(cell, "is")[0];
      cells.set(reference, item ? itemText(item) : "");
    } else {
      cells.set(reference, value);
    }
  }
  return cells;
};

/**
 * What an `.xlsx` is to the import dialog: this version's Excel export, one an earlier version wrote
 * (6.2's, format 1: a meta sheet of `surveyId`, `updatedAt`, `format` that maps no column, so it can't
 * update its survey), or any other workbook.
 */
export type TExcelExportFileKind = "export" | "earlier_export" | "other";

/** 6.2's meta sheet, format 1: the survey id in A1, the format in A3. */
const isEarlierExportMeta = (cellAt: (row: number, column: number) => string): boolean =>
  cellAt(0, 0) === EXCEL_EXPORT_META_SURVEY_ID && cellAt(2, 0) === EXCEL_EXPORT_META_FORMAT;

/** What an opened archive is laid out as; see `TExcelExportFileKind`. */
export const getExcelExportArchiveKind = (archive: TZipArchive): TExcelExportFileKind => {
  const workbookPart = readRelationships(archive, "").byType(OFFICE_DOCUMENT_TYPE);
  const workbook = workbookPart ? parseXml(archive, workbookPart) : null;
  if (!workbookPart || !workbook) return "other";

  const sheets = elements(workbook, "sheet");
  const metaIndex = sheets.findIndex((sheet) => sheet.getAttribute("name") === EXCEL_EXPORT_META_SHEET);
  // The texts sheet comes first; the meta sheet after it.
  if (metaIndex < 1) return "other";
  const relationshipId = sheets[metaIndex].getAttributeNS(RELATIONSHIPS_NS, "id");
  const relationships = readRelationships(archive, workbookPart);
  const metaPart = relationshipId ? relationships.byId(relationshipId) : null;
  const meta = metaPart ? parseXml(archive, metaPart) : null;
  if (!meta) return "other";

  let sharedStrings: string[] | null = null;
  const sharedStringsOf = () => {
    if (sharedStrings) return sharedStrings;
    const part = relationships.byType(SHARED_STRINGS_TYPE);
    const document = part ? parseXml(archive, part) : null;
    sharedStrings = document ? elements(document, "si").map(itemText) : [];
    return sharedStrings;
  };
  const cells = readCells(meta, sharedStringsOf);

  const cellAt = (row: number, column: number) => cells.get(`${COLUMNS[column]}${row + 1}`) ?? "";
  if (isEarlierExportMeta(cellAt)) return "earlier_export";
  const surveyIdRow = EXCEL_EXPORT_META_ROWS.indexOf(EXCEL_EXPORT_META_SURVEY_ID);
  if (!isExcelExportMetaLayout(cellAt) || !ZId.safeParse(cellAt(surveyIdRow, 1).trim()).success) {
    return "other";
  }

  // The texts sheet's key column, as the server finds it: a row whose column A reads `key`.
  const textsId = sheets[0].getAttributeNS(RELATIONSHIPS_NS, "id");
  const textsPart = textsId ? relationships.byId(textsId) : null;
  const texts = textsPart ? parseXml(archive, textsPart) : null;
  if (!texts) return "other";
  const hasKeyColumn = [...readCells(texts, sharedStringsOf).entries()].some(
    ([reference, text]) => /^A\d+$/.test(reference) && text === EXCEL_EXPORT_KEY_HEADER
  );
  return hasKeyColumn ? "export" : "other";
};

/** Whether an opened archive is laid out as this version's Excel export. */
export const isExcelExportArchive = (archive: TZipArchive): boolean =>
  getExcelExportArchiveKind(archive) === "export";

/** What an `.xlsx` the user picked is laid out as. Never throws: unreadable is any other workbook. */
export const getExcelExportFileKind = async (file: Blob): Promise<TExcelExportFileKind> => {
  try {
    return getExcelExportArchiveKind(openZipArchive(new Uint8Array(await file.arrayBuffer())));
  } catch {
    return "other";
  }
};
