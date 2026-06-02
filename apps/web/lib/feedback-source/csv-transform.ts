import {
  TFeedbackSourceFieldMapping,
  THubFieldType,
  THubTargetField,
  ZHubFieldType,
} from "@formbricks/types/feedback-source";
import { FeedbackRecordCreateParams } from "@/modules/hub";
import { routeResponseValueTarget } from "./utils";

const NUMERIC_FIELDS = new Set<THubTargetField>(["value_number"]);
const BOOLEAN_FIELDS = new Set<THubTargetField>(["value_boolean"]);
const TIMESTAMP_FIELDS = new Set<THubTargetField>(["collected_at", "value_date"]);
const JSON_FIELDS = new Set<THubTargetField>(["metadata"]);
const ISO_DATE_OR_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/;

const isValidIsoDateOrTimestamp = (value: string): boolean => {
  const match = ISO_DATE_OR_TIMESTAMP_REGEX.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

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
    if (!isValidIsoDateOrTimestamp(trimmed)) return undefined;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  return trimmed;
};

const resolveValue = (
  row: Record<string, string>,
  mapping: TFeedbackSourceFieldMapping,
  effectiveTargetFieldId: THubTargetField
): string | number | boolean | undefined => {
  if (mapping.staticValue) {
    if (mapping.staticValue === "$now" && TIMESTAMP_FIELDS.has(effectiveTargetFieldId)) {
      return new Date().toISOString();
    }
    return coerceValue(mapping.staticValue, effectiveTargetFieldId);
  }

  const rawValue = row[mapping.sourceFieldId];
  if (rawValue === undefined || rawValue === null) return undefined;

  return coerceValue(rawValue, effectiveTargetFieldId);
};

const resolveFieldTypeForRow = (
  row: Record<string, string>,
  mappings: TFeedbackSourceFieldMapping[]
): THubFieldType | null => {
  const mapping = mappings.find((m) => m.targetFieldId === "field_type");
  if (!mapping) return null;

  const raw = mapping.staticValue ?? row[mapping.sourceFieldId];
  if (!raw) return null;

  const parsed = ZHubFieldType.safeParse(raw.trim());
  return parsed.success ? parsed.data : null;
};

/**
 * Transform a single CSV row into a FeedbackRecord using field mappings.
 *
 * Returns null if field_id, field_type, tenant_id, or submission_id are missing.
 */
export const transformCsvRowToFeedbackRecord = (
  row: Record<string, string>,
  mappings: TFeedbackSourceFieldMapping[],
  tenantId?: string
): FeedbackRecordCreateParams | null => {
  const record: Record<string, string | number | boolean | Record<string, unknown> | undefined> = {};

  const safeMappings = mappings.filter(
    (m) => m.targetFieldId !== "tenant_id" && m.targetFieldId !== "source_type"
  );
  record.source_type = "csv";

  const fieldType = resolveFieldTypeForRow(row, safeMappings);
  if (!fieldType) return null;

  for (const mapping of safeMappings) {
    let effectiveTargetFieldId: THubTargetField;
    if (mapping.targetFieldId === "response_value") {
      try {
        effectiveTargetFieldId = routeResponseValueTarget(fieldType);
      } catch {
        return null;
      }
    } else {
      effectiveTargetFieldId = mapping.targetFieldId;
    }

    const value = resolveValue(row, mapping, effectiveTargetFieldId);
    if (value === undefined) continue;

    if (JSON_FIELDS.has(effectiveTargetFieldId)) {
      try {
        record[effectiveTargetFieldId] = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        record[effectiveTargetFieldId] = { raw: value };
      }
    } else {
      record[effectiveTargetFieldId] = value;
    }
  }

  if (!record.source_type || !record.field_id || !record.field_type) {
    return null;
  }

  if (tenantId && !record.tenant_id) {
    record.tenant_id = tenantId;
  }

  if (!record.tenant_id) {
    return null;
  }

  if (!record.submission_id) {
    return null;
  }

  return record as unknown as FeedbackRecordCreateParams;
};

/**
 * Transform multiple CSV rows into FeedbackRecords.
 * Returns the successfully transformed records and a count of skipped rows.
 */
export const transformCsvRowsToFeedbackRecords = (
  rows: Record<string, string>[],
  mappings: TFeedbackSourceFieldMapping[],
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
