import { parse } from "csv-parse/sync";

export const parseContactsCSV = (csv: string): unknown[] => {
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: [",", ";", "\t"],
  });
};
