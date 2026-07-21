import { parse } from "csv-parse/sync";
import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { createFeedbackCSVDataSchema } from "./types";

// ENG-1799: a header-only CSV (zero data rows) must surface the friendly CSV_AT_LEAST_ONE_ROW error,
// NOT crash with a raw "Cannot convert undefined to object". The crash was inside the schema itself:
// `createFeedbackCSVDataSchema`'s `.superRefine` dereferenced `Object.keys(rows[0])`, and zod runs the
// refinement even when the preceding `.min(1)` fails — so an empty array threw a raw TypeError out of
// `safeParse` (which is why callers saw it as a thrown error, not a validation failure). This drives the
// real schema + csv-parse through the exact parse+validate chain both consumers use
// (csv-feedback-source-ui.tsx, csv-import-modal.tsx) to prove empty input now fails validation cleanly.

const t = ((key: string) => key) as unknown as TFunction;

// Mirror the component's parse options exactly (csv-feedback-source-ui.tsx:136).
const parseCsv = (csv: string) =>
  parse(csv, { columns: true, relax_column_count: true, skip_empty_lines: true }) as Record<string, string>[];

describe("createFeedbackCSVDataSchema — header-only CSV guard (ENG-1799)", () => {
  test.each([
    ["header + trailing newline", "submission_id,field_id,field_type,response_value\n"],
    ["header, no trailing newline", "submission_id,field_id,field_type,response_value"],
    ["header + blank lines", "submission_id,field_id,field_type,response_value\n\n\n"],
  ])("%s → zero rows, validation fails cleanly instead of throwing", (_label, csv) => {
    const records = parseCsv(csv);

    // The precondition that made the refinement throw: rows[0] is undefined.
    expect(records).toHaveLength(0);
    expect(records[0]).toBeUndefined();

    // safeParse must resolve to a failure (not throw) with the friendly message.
    const result = createFeedbackCSVDataSchema(t).safeParse(records);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("workspace.unify.csv_at_least_one_row");
    }
  });

  test("a valid single-row CSV still passes (guard does not over-reject)", () => {
    const records = parseCsv("submission_id,field_id,field_type,response_value\nsub-1,q1,text,hi");
    expect(records).toHaveLength(1);
    expect(createFeedbackCSVDataSchema(t).safeParse(records).success).toBe(true);
  });
});
