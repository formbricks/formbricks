import "server-only";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { InvalidInputError } from "@formbricks/types/errors";
import { createFeedbackRecordsBatch } from "@/modules/hub";
import { transformCsvRowsToFeedbackRecords } from "./csv-transform";
import { TImportResult } from "./import";

const CSV_BATCH_SIZE = 50;

export const importCsvData = async (
  connector: TConnectorWithMappings,
  csvRows: Record<string, string>[]
): Promise<TImportResult> => {
  if (connector.type !== "csv") {
    throw new InvalidInputError("CSV import is only supported for CSV connectors");
  }

  if (connector.fieldMappings.length === 0) {
    throw new InvalidInputError("Connector has no field mappings configured");
  }

  const { records, skipped } = transformCsvRowsToFeedbackRecords(csvRows, connector.fieldMappings);

  let successes = 0;
  let failures = 0;

  for (let i = 0; i < records.length; i += CSV_BATCH_SIZE) {
    const batch = records.slice(i, i + CSV_BATCH_SIZE);
    const { results } = await createFeedbackRecordsBatch(batch);
    successes += results.filter((r) => r.data !== null).length;
    failures += results.filter((r) => r.error !== null).length;
  }

  return { successes, failures, skipped };
};
