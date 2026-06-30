import "server-only";
import { InvalidInputError } from "@formbricks/types/errors";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { CSV_IMPORT_MISSING_COLUMNS_ERROR_CODE } from "@/modules/ee/unify-feedback/sources/types";
import { createFeedbackRecordsBatch } from "@/modules/hub";
import { transformCsvRowsToFeedbackRecords } from "./csv-transform";
import { TImportResult } from "./import";
import {
  formatMissingRequiredCsvFieldMappingsMessage,
  getMissingCsvMappedSourceColumns,
  getMissingRequiredCsvFieldMappings,
} from "./utils";

const CSV_BATCH_SIZE = 50;

export const importCsvData = async (
  feedbackSource: TFeedbackSourceWithMappings,
  csvRows: Record<string, string>[]
): Promise<TImportResult> => {
  if (feedbackSource.type !== "csv") {
    throw new InvalidInputError("CSV import is only supported for CSV feedbackSources");
  }

  if (feedbackSource.fieldMappings.length === 0) {
    throw new InvalidInputError("FeedbackSource has no field mappings configured");
  }

  const missingMappedColumns = getMissingCsvMappedSourceColumns(
    feedbackSource.fieldMappings,
    Object.keys(csvRows[0] ?? {})
  );
  if (missingMappedColumns.length > 0) {
    throw new InvalidInputError(CSV_IMPORT_MISSING_COLUMNS_ERROR_CODE);
  }

  const missing = getMissingRequiredCsvFieldMappings(feedbackSource.fieldMappings);
  if (missing.length > 0) {
    throw new InvalidInputError(formatMissingRequiredCsvFieldMappingsMessage());
  }

  const { records, skipped: transformSkipped } = transformCsvRowsToFeedbackRecords(
    csvRows,
    feedbackSource.fieldMappings,
    feedbackSource.feedbackDirectoryId
  );

  let successes = 0;
  let failures = 0;
  let skipped = transformSkipped;

  for (let i = 0; i < records.length; i += CSV_BATCH_SIZE) {
    const batch = records.slice(i, i + CSV_BATCH_SIZE);
    const { results } = await createFeedbackRecordsBatch(batch);
    for (const result of results) {
      if (result.data !== null) {
        successes++;
      } else if (result.error?.status === 409) {
        // Duplicate (tenant_id, submission_id, field_id) — already imported. Treat as skipped, not failed.
        skipped++;
      } else {
        failures++;
      }
    }
  }

  return { successes, failures, skipped };
};
