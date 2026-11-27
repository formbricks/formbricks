/**
 * CSV cell writing that is safe in the browser too: no Node or xlsx imports, so a client component that
 * builds a CSV (the members CSV template, ENG-7475) uses the same defanging as the server exports.
 * `file-conversion.ts` re-exports these for its server callers.
 */

// Defang formula injection in CSV. A CSV cell starting with =, +, -, @, tab,
// or CR is evaluated as a formula by Excel/Sheets/Numbers. CSV only: xlsx
// writes typed text cells instead (see `toXlsxCell`).
// Sanitize at the render boundary only — never rewrite row keys, since
// distinct user-controlled labels could collide after prefixing (e.g.
// "=field" and "'=field" both map to "'=field"), dropping cell data.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export const sanitizeFormulaInjection = <T>(value: T): T => {
  if (typeof value === "string" && FORMULA_TRIGGER.test(value)) {
    return `'${value}` as T;
  }
  return value;
};

export type TCsvCell = string | number | null | undefined;

/**
 * One RFC 4180 CSV line, for writers that stream rows instead of building the whole file with
 * `convertToCsv`. Strings are defanged with `sanitizeFormulaInjection` and always quoted (inner quotes
 * doubled), numbers are written bare, and null/undefined become an empty cell. Ends with CRLF.
 */
export const toCsvLine = (cells: readonly TCsvCell[]): string =>
  cells
    .map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (typeof cell === "number") return String(cell);
      return `"${sanitizeFormulaInjection(cell).replaceAll('"', '""')}"`;
    })
    .join(",") + "\r\n";
