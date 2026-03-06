import { TConnectorFieldMapping, THubTargetField } from "@formbricks/types/connector";
import { FeedbackRecordCreateParams } from "@/modules/hub";

const NUMERIC_FIELDS = new Set<THubTargetField>(["value_number"]);
const BOOLEAN_FIELDS = new Set<THubTargetField>(["value_boolean"]);
const TIMESTAMP_FIELDS = new Set<THubTargetField>(["collected_at", "value_date"]);
const JSON_FIELDS = new Set<THubTargetField>(["metadata"]);

const coerceValue = (value: string, targetField: THubTargetField): string | number | boolean | undefined => {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  if (NUMERIC_FIELDS.has(targetField)) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  if (BOOLEAN_FIELDS.has(targetField)) {
    const lower = trimmed.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
    return undefined;
  }

  if (TIMESTAMP_FIELDS.has(targetField)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  return trimmed;
};

const resolveValue = (
  row: Record<string, string>,
  mapping: TConnectorFieldMapping
): string | number | boolean | undefined => {
  if (mapping.staticValue) {
    if (mapping.staticValue === "$now" && TIMESTAMP_FIELDS.has(mapping.targetFieldId)) {
      return new Date().toISOString();
    }
    return coerceValue(mapping.staticValue, mapping.targetFieldId);
  }

  const rawValue = row[mapping.sourceFieldId];
  if (rawValue === undefined || rawValue === null) return undefined;

  return coerceValue(rawValue, mapping.targetFieldId);
};

/**
 * Transform a single CSV row into a FeedbackRecord using field mappings.
 *
 * Each mapping maps a CSV column (sourceFieldId) or a static value to a target field.
 * Returns null if required fields (source_type, field_id, field_type) are missing after mapping.
 */
export const transformCsvRowToFeedbackRecord = (
  row: Record<string, string>,
  mappings: TConnectorFieldMapping[],
  tenantId?: string
): FeedbackRecordCreateParams | null => {
  const record: Record<string, string | number | boolean | Record<string, unknown> | undefined> = {};

  for (const mapping of mappings) {
    const value = resolveValue(row, mapping);
    if (value === undefined) continue;

    if (JSON_FIELDS.has(mapping.targetFieldId)) {
      try {
        record[mapping.targetFieldId] = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        record[mapping.targetFieldId] = { raw: value };
      }
    } else {
      record[mapping.targetFieldId] = value;
    }
  }

  if (!record.source_type || !record.field_id || !record.field_type) {
    return null;
  }

  if (tenantId && !record.tenant_id) {
    record.tenant_id = tenantId;
  }

  return record as unknown as FeedbackRecordCreateParams;
};

/**
 * Transform multiple CSV rows into FeedbackRecords.
 * Returns the successfully transformed records and a count of skipped rows.
 */
export const transformCsvRowsToFeedbackRecords = (
  rows: Record<string, string>[],
  mappings: TConnectorFieldMapping[],
  tenantId?: string
): { records: FeedbackRecordCreateParams[]; skipped: number } => {
  const records: FeedbackRecordCreateParams[] = [];
  let skipped = 0;

  for (const row of rows) {
    const record = transformCsvRowToFeedbackRecord(row, mappings, tenantId);
    if (record) {
      records.push(record);
    } else {
      skipped++;
    }
  }

  return { records, skipped };
};
