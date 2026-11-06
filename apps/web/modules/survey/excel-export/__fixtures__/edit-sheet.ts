import * as XLSX from "xlsx";

/**
 * An Excel export edited the way a reviewer's spreadsheet app would save it: the texts sheet's rows
 * changed by `edit` (each row a list of cell texts, the hidden key first), every other sheet and the
 * hidden state kept. For the import's tests (ENG-6809).
 */
export const editExcelExport = (bytes: Uint8Array, edit: (rows: string[][]) => string[][]): Uint8Array => {
  const book = XLSX.read(bytes, { type: "array" });
  const name = book.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, raw: false, defval: "" });
  const sheet = XLSX.utils.aoa_to_sheet(edit(rows.map((row) => [...row])));
  sheet["!cols"] = book.Sheets[name]["!cols"];
  book.Sheets[name] = sheet;
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
};

/** The index of the row whose hidden key is `key`; throws when there is none, so a test can't pass on a typo. */
export const rowOf = (rows: string[][], key: string): number => {
  const index = rows.findIndex((row) => row[0] === key);
  if (index < 0) throw new Error(`No row with key ${key}`);
  return index;
};
