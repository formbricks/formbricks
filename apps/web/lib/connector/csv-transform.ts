import { randomUUID } from "crypto";
import {
  TConnectorFieldMapping,
  THubFieldType,
  THubTargetField,
  ZHubFieldType,
} from "@formbricks/types/connector";
import { routeResponseValueTarget } from "@/modules/ee/unify-feedback/sources/utils";
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
  mapping: TConnectorFieldMapping,
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
  mappings: TConnectorFieldMapping[]
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
 * Returns null if field_id, field_type, or tenant_id are missing, or if a mapped submission_id
 * resolves empty. Falls back to a random UUID for submission_id only when no mapping exists.
 */
export const transformCsvRowToFeedbackRecord = (
  row: Record<string, string>,
  mappings: TConnectorFieldMapping[],
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

  if (!("submission_id" in record)) {
    const submissionMapped = safeMappings.some((m) => m.targetFieldId === "submission_id");
    if (submissionMapped) {
      return null;
    }
    record.submission_id = randomUUID();
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
