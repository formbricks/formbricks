/**
 * A small .xlsx writer for the Analysis export's workbook.
 *
 * Why not SheetJS: the vendored community build cannot write a frozen header, and it infers cell
 * types, so the one job that matters here (a code like `01` or `98` stays text) would rest on its
 * heuristics. This writer states every cell's type: text goes out as an inline string, numbers as
 * numbers, blank cells are not written. The file has a frozen header row, an auto-filter over the
 * data, no merged cells and nothing carried by colour.
 *
 * The workbook is built whole in memory, by nature of the format; the caller caps its size.
 */
import { ZipArchive } from "archiver";
import { sanitizeFormulaInjection } from "../utils/file-conversion";

export type TXlsxCell = string | number | null;

export const XLSX_LIMITS = { rows: 1_048_576, columns: 16_384 } as const;

/** Excel's cell text limit. A longer text makes Excel report the file as corrupt. */
const MAX_CELL_CHARACTERS = 32_767;
const MAX_SHEET_NAME_CHARACTERS = 31;

export class XlsxLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlsxLimitError";
  }
}

// eslint-disable-next-line no-control-regex -- control characters XML 1.0 cannot carry are exactly what is removed
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const escapeXml = (text: string): string =>
  text.replace(XML_ILLEGAL, "").replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return "&quot;";
    }
  });

const cutCell = (text: string): string => {
  if (text.length <= MAX_CELL_CHARACTERS) return text;
  const cut = text.slice(0, MAX_CELL_CHARACTERS);
  // Do not leave half of a surrogate pair at the end.
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
};

/** A, B, ... Z, AA, AB ... for a zero-based column index. */
const columnLetters = (index: number): string => {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

const HEADER_STYLE = 1;

const cellXml = (reference: string, cell: TXlsxCell, style?: number): string => {
  if (cell === null) return "";
  const styleAttribute = style ? ` s="${style}"` : "";
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? `<c r="${reference}"${styleAttribute}><v>${cell}</v></c>` : "";
  }
  // XML parsers fold a CR into an LF anyway, so say LF: the same line break in every reader.
  const text = escapeXml(cutCell(sanitizeFormulaInjection(cell.replace(/\r\n?/g, "\n"))));
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
};

type TLimits = { rows: number; columns: number };

export type TXlsxSheetWriter = { addRow: (cells: readonly TXlsxCell[]) => void };

export const createXlsxWorkbook = ({ limits = XLSX_LIMITS }: { limits?: TLimits } = {}) => {
  type TSheet = { name: string; header: readonly string[]; rows: string[] };
  const sheets: TSheet[] = [];
  let cells = 0;

  const addSheet = (name: string, header: readonly string[]): TXlsxSheetWriter => {
    if (name === "" || name.length > MAX_SHEET_NAME_CHARACTERS || /[\\/?*[\]:]/.test(name)) {
      throw new Error(`Not a valid Excel sheet name: "${name}"`);
    }
    if (header.length > limits.columns) {
      throw new XlsxLimitError(
        `A sheet holds at most ${limits.columns} columns, this one needs ${header.length}`
      );
    }
    const sheet: TSheet = { name, header, rows: [] };
    sheets.push(sheet);
    cells += header.length;

    return {
      addRow: (row) => {
        // +1 for the header row.
        if (sheet.rows.length + 2 > limits.rows) {
          throw new XlsxLimitError(`A sheet holds at most ${limits.rows} rows`);
        }
        const number = sheet.rows.length + 2;
        sheet.rows.push(
          `<row r="${number}">${row.map((cell, index) => cellXml(`${columnLetters(index)}${number}`, cell)).join("")}</row>`
        );
        cells += row.length;
      },
    };
  };

  const sheetXml = ({ header, rows }: TSheet): string => {
    const lastColumn = columnLetters(Math.max(header.length, 1) - 1);
    const lastRow = rows.length + 1;
    const range = `A1:${lastColumn}${lastRow}`;
    const widths = header
      .map((title, index) => {
        const width = Math.min(Math.max(title.length + 2, 10), 40);
        return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
      })
      .join("");
    const headerRow = `<row r="1">${header.map((title, index) => cellXml(`${columnLetters(index)}1`, title, HEADER_STYLE)).join("")}</row>`;
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="${range}"/>` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<cols>${widths}</cols>` +
      `<sheetData>${headerRow}${rows.join("")}</sheetData>` +
      `<autoFilter ref="${range}"/>` +
      `<ignoredErrors><ignoredError sqref="${range}" numberStoredAsText="1"/></ignoredErrors>` +
      `</worksheet>`
    );
  };

  const toBuffer = (): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const archive = new ZipArchive({ zlib: { level: 6 } });
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("error", reject);
      archive.on("end", () => resolve(Buffer.concat(chunks)));

      const xmlHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
      archive.append(
        `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          sheets
            .map(
              (_, index) =>
                `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
            )
            .join("") +
          `</Types>`,
        { name: "[Content_Types].xml" }
      );
      archive.append(
        `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
        { name: "_rels/.rels" }
      );
      archive.append(
        `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>` +
          `</workbook>`,
        { name: "xl/workbook.xml" }
      );
      archive.append(
        `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          sheets
            .map(
              (_, index) =>
                `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
            )
            .join("") +
          `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
        { name: "xl/_rels/workbook.xml.rels" }
      );
      // Style 0 is plain, style 1 is a bold header. No fills with colour, no borders: bold is the
      // only thing the formatting says, and a screen reader or a filter does not need it.
      archive.append(
        `${xmlHeader}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
          `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
          `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
          `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`,
        { name: "xl/styles.xml" }
      );
      sheets.forEach((sheet, index) => {
        archive.append(sheetXml(sheet), { name: `xl/worksheets/sheet${index + 1}.xml` });
      });
      void archive.finalize();
    });

  return { addSheet, toBuffer, cellCount: () => cells };
};
