import type { TAnalysisCell } from "./types";

/** What the SPSS syntax needs to know about a column's cells, measured while the rows stream past. */
export type TColumnStats = {
  /** Longest text cell, in UTF-8 bytes (SPSS string widths are bytes). 0 when the column has no text. */
  maxTextBytes: number;
  /** Characters of the widest number as written, minus sign and decimal point included. */
  maxNumberChars: number;
  maxDecimals: number;
};

/**
 * Observes rows one at a time, so the writers need no second pass over data they have already
 * streamed out. Cost is one comparison per cell.
 */
const observeText = (entry: TColumnStats, text: string): void => {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > entry.maxTextBytes) entry.maxTextBytes = bytes;
};

const observeNumber = (entry: TColumnStats, value: number): void => {
  const written = String(value);
  if (written.length > entry.maxNumberChars) entry.maxNumberChars = written.length;
  const point = written.indexOf(".");
  const decimals = point === -1 ? 0 : written.length - point - 1;
  if (decimals > entry.maxDecimals) entry.maxDecimals = decimals;
};

export const createColumnStats = (columnCount: number) => {
  const stats: TColumnStats[] = Array.from({ length: columnCount }, () => ({
    maxTextBytes: 0,
    maxNumberChars: 0,
    maxDecimals: 0,
  }));

  return {
    observe: (cells: readonly TAnalysisCell[]): void => {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (cell === null) continue;
        const entry = stats[index];
        if (typeof cell === "string") observeText(entry, cell);
        else observeNumber(entry, cell);
      }
    },
    result: (): TColumnStats[] => stats,
  };
};
