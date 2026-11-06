import { ZId } from "@formbricks/types/common";
import {
  EXCEL_EXPORT_FORMAT,
  EXCEL_EXPORT_META_ROWS,
  EXCEL_EXPORT_META_SHEET,
  EXCEL_EXPORT_META_SURVEY_ID,
} from "@/modules/survey/excel-export/format";
import { type TZipArchive, openZipArchive } from "@/modules/survey/import/core/zip";

/**
 * Whether an `.xlsx` is laid out as a Formbricks Excel export (ENG-6809), told in the browser from a few
 * small parts of it: the workbook names a meta sheet `formbricks` that is not its first sheet, and that
 * sheet has the export's labels down column A, in order, with this version's format and a survey id
 * beside them.
 *
 * Without Formbricks AI, the import dialog uploads only such a workbook: the server reads it without AI
 * when the survey it names is one the user may update, and sends any other workbook to the AI document
 * import. It is a hint for the user's sake, never a check the server relies on: the server reads and
 * checks the file again, under its own limits, and decides.
 *
 * The archive is opened with the upload's zip guard (`openZipArchive`), so a zip bomb costs its
 * directory here as it does on the server. Anything that cannot be read is not an export.
 */

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

/** Whether an opened archive is laid out as an Excel export. */
export const isExcelExportArchive = (archive: TZipArchive): boolean => {
  const workbookPart = readRelationships(archive, "").byType(OFFICE_DOCUMENT_TYPE);
  const workbook = workbookPart ? parseXml(archive, workbookPart) : null;
  if (!workbookPart || !workbook) return false;

  const sheets = elements(workbook, "sheet");
  const metaIndex = sheets.findIndex((sheet) => sheet.getAttribute("name") === EXCEL_EXPORT_META_SHEET);
  // The texts sheet comes first; the meta sheet after it.
  if (metaIndex < 1) return false;
  const relationshipId = sheets[metaIndex].getAttributeNS(RELATIONSHIPS_NS, "id");
  const relationships = readRelationships(archive, workbookPart);
  const metaPart = relationshipId ? relationships.byId(relationshipId) : null;
  const meta = metaPart ? parseXml(archive, metaPart) : null;
  if (!meta) return false;

  let sharedStrings: string[] | null = null;
  const cells = readCells(meta, () => {
    if (sharedStrings) return sharedStrings;
    const part = relationships.byType(SHARED_STRINGS_TYPE);
    const document = part ? parseXml(archive, part) : null;
    sharedStrings = document ? elements(document, "si").map(itemText) : [];
    return sharedStrings;
  });

  const surveyIdRow = EXCEL_EXPORT_META_ROWS.indexOf(EXCEL_EXPORT_META_SURVEY_ID) + 1;
  return (
    EXCEL_EXPORT_META_ROWS.every((label, index) => cells.get(`A${index + 1}`) === label) &&
    cells.get("B1") === String(EXCEL_EXPORT_FORMAT) &&
    ZId.safeParse(cells.get(`B${surveyIdRow}`)?.trim()).success
  );
};

/** Whether an `.xlsx` the user picked is laid out as an Excel export. Never throws: unreadable is "no". */
export const isExcelExportFile = async (file: Blob): Promise<boolean> => {
  try {
    return isExcelExportArchive(openZipArchive(new Uint8Array(await file.arrayBuffer())));
  } catch {
    return false;
  }
};
