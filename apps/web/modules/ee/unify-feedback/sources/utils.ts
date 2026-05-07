import { TFunction } from "i18next";
import { TConnectorType, THubFieldType } from "@formbricks/types/connector";
import {
  CSV_REQUIRED_UI_FIELDS,
  CSV_TARGET_FIELDS,
  FEEDBACK_RECORD_FIELDS,
  MAX_CSV_VALUES,
  TFieldMapping,
  TSourceField,
} from "./types";

export type TConnectorOptionId = TConnectorType | "api_ingestion" | "feedback_record_mcp";

export interface TConnectorOption {
  id: TConnectorOptionId;
  name: string;
  description: string;
  disabled: boolean;
  badge?: { text: string; type: "success" | "gray" | "warning" };
}

export const getConnectorOptions = (t: TFunction): TConnectorOption[] => [
  {
    id: "formbricks_survey",
    name: t("workspace.unify.formbricks_surveys"),
    description: t("workspace.unify.source_connect_formbricks_description"),
    disabled: false,
  },
  {
    id: "csv",
    name: t("workspace.unify.csv_import"),
    description: t("workspace.unify.source_connect_csv_description"),
    disabled: false,
  },
  {
    id: "api_ingestion",
    name: t("workspace.unify.api_ingestion"),
    description: t("workspace.unify.api_ingestion_settings_description"),
    disabled: false,
  },
  {
    id: "feedback_record_mcp",
    name: t("workspace.unify.feedback_record_mcp"),
    description: t("workspace.unify.source_connect_feedback_record_mcp_description"),
    disabled: false,
  },
];

export const parseCSVColumnsToFields = (columns: string): TSourceField[] => {
  return columns.split(",").map((col) => {
    const trimmed = col.trim();
    return { id: trimmed, name: trimmed, type: "string", sampleValue: `Sample ${trimmed}` };
  });
};

export interface TEnumValidationError {
  targetFieldName: string;
  invalidEntries: { row: number; value: string }[];
  allowedValues: string[];
}

/**
 * Validates that CSV columns mapped to enum target fields contain only allowed values.
 * Returns an array of validation errors (empty if all valid).
 */
export const validateEnumMappings = (
  mappings: TFieldMapping[],
  csvData: Record<string, string>[]
): TEnumValidationError[] => {
  const errors: TEnumValidationError[] = [];

  for (const mapping of mappings) {
    if (!mapping.sourceFieldId || mapping.staticValue) continue;

    const targetField = FEEDBACK_RECORD_FIELDS.find((f) => f.id === mapping.targetFieldId);
    if (targetField?.type !== "enum" || !targetField?.enumValues) continue;

    const allowedValues = new Set(targetField.enumValues);
    const invalidEntries: { row: number; value: string }[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const value = csvData[i][mapping.sourceFieldId]?.trim();
      if (value && !allowedValues.has(value as THubFieldType)) {
        invalidEntries.push({ row: i + 1, value });
      }
    }

    if (invalidEntries.length > 0) {
      errors.push({
        targetFieldName: targetField.name,
        invalidEntries,
        allowedValues: targetField.enumValues,
      });
    }
  }

  return errors;
};

export const isConnectorNameValid = (name: string): boolean => name.trim().length > 0;

export const toggleQuestionId = (currentSelection: string[], questionId: string): string[] => {
  return currentSelection.includes(questionId)
    ? currentSelection.filter((id) => id !== questionId)
    : [...currentSelection, questionId];
};

export const validateCsvFile = (
  file: File,
  t: TFunction
): { valid: true } | { valid: false; error: string } => {
  if (!file.name.endsWith(".csv")) {
    return { valid: false, error: t("workspace.unify.csv_files_only") };
  }
  if (file.type && file.type !== "text/csv" && !file.type.includes("csv")) {
    return { valid: false, error: t("workspace.unify.csv_files_only") };
  }
  if (file.size > MAX_CSV_VALUES.FILE_SIZE) {
    return { valid: false, error: t("workspace.unify.csv_file_too_large") };
  }
  return { valid: true };
};

export type TMappingConfidence = "high" | "medium" | "low";

// Convert a filename like "q1-2026_survey-results.csv" into "Q1 2026 Survey Results".
export const titleizeFromFileName = (fileName: string): string => {
  const base = fileName.replace(/\.csv$/i, "");
  const words = base.split(/[_\-\s]+/).filter(Boolean);
  if (words.length === 0) return base;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
};

// Alias dictionary keyed by CSV target field id. Match in priority order: high → medium → fuzzy
// substring (low). Patterns are case-insensitive and applied to header names.
export const CSV_COLUMN_ALIASES: Record<string, { high: RegExp[]; medium: RegExp[] }> = {
  collected_at: {
    high: [/^(timestamp|collected_at|submitted_at)$/i],
    medium: [/^(created_at|date|time|datetime)$/i],
  },
  field_id: {
    high: [/^(field_id|question_id|q_id)$/i],
    medium: [/^(id|key)$/i],
  },
  field_label: {
    high: [/^(field_label|question|label|question_text)$/i],
    medium: [/^(name|title|prompt)$/i],
  },
  // field_type is intentionally not aliased to a CSV column. The UI exposes it as a single static
  // enum picker (one type per CSV); we infer the value from FIELD_TYPE_NAME_HINTS + samples.
  response_value: {
    high: [/^(response|answer|value|response_value)$/i],
    medium: [/^(score|rating|feedback)$/i],
  },
  source_id: {
    high: [/^(source_id|survey_id|form_id)$/i],
    medium: [],
  },
  source_name: {
    high: [/^source_name$/i],
    medium: [],
  },
  language: {
    high: [/^(language|lang|locale)$/i],
    medium: [],
  },
  user_identifier: {
    high: [/^(user_id|user_identifier|customer_id)$/i],
    medium: [/^(email|user|customer)$/i],
  },
  metadata: {
    high: [/^metadata$/i],
    medium: [],
  },
};

// Column-name hints used to pick a `field_type` when the user maps a column whose name strongly
// implies a question type (e.g. "rating", "nps", "is_promoter"). Checked before sample sniffing.
export const FIELD_TYPE_NAME_HINTS: Array<{ pattern: RegExp; type: THubFieldType }> = [
  { pattern: /^(rating|stars|score)$/i, type: "rating" },
  { pattern: /^(nps|nps_score|net_promoter)$/i, type: "nps" },
  { pattern: /^csat$/i, type: "csat" },
  { pattern: /^ces$/i, type: "ces" },
  { pattern: /^(number|count|amount|qty|quantity)$/i, type: "number" },
  { pattern: /^(comment|feedback|answer|response|text)$/i, type: "text" },
  { pattern: /^(category|choice|option|select)$/i, type: "categorical" },
  { pattern: /^(is_|has_|did_)/i, type: "boolean" },
  { pattern: /^(date|submitted_at|completed_at)$/i, type: "date" },
];

// Infer a likely THubFieldType from a column. Tries name hints first (more reliable), then falls
// back to sniffing sample values, then defaults to "text".
export const inferFieldType = ({
  columnName,
  samples,
}: {
  columnName?: string;
  samples: string[];
}): THubFieldType => {
  if (columnName) {
    for (const hint of FIELD_TYPE_NAME_HINTS) {
      if (hint.pattern.test(columnName)) return hint.type;
    }
  }

  const cleaned = samples.map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  if (cleaned.length === 0) return "text";

  const isBool = cleaned.every((s) => /^(true|false|yes|no|0|1)$/i.test(s));
  if (isBool) return "boolean";

  const isNumber = cleaned.every((s) => !Number.isNaN(Number.parseFloat(s)) && /^-?\d+(\.\d+)?$/.test(s));
  if (isNumber) return "number";

  const isDate = cleaned.every((s) => !Number.isNaN(new Date(s).getTime()));
  if (isDate) return "date";

  return "text";
};

// Centralized, exhaustive routing from THubFieldType to the underlying value_* target. Throws on
// unknown values so we fail closed if THubFieldType ever gains a member without a routing decision.
export const routeResponseValueTarget = (
  fieldType: THubFieldType
): "value_text" | "value_number" | "value_boolean" | "value_date" => {
  switch (fieldType) {
    case "text":
    case "categorical":
      return "value_text";
    case "number":
    case "nps":
    case "csat":
    case "ces":
    case "rating":
      return "value_number";
    case "boolean":
      return "value_boolean";
    case "date":
      return "value_date";
    default: {
      const _exhaustive: never = fieldType;
      throw new Error(`Unhandled field_type for response_value routing: ${String(_exhaustive)}`);
    }
  }
};

interface TAutoMapResult {
  mappings: TFieldMapping[];
  confidence: Record<string, TMappingConfidence>;
}

interface TAutoMapInput {
  sourceFields: TSourceField[];
  sampleRow: Record<string, string>;
  fileName: string;
}

const findBestSourceMatch = (
  targetId: string,
  sourceFields: TSourceField[]
): { sourceField: TSourceField; confidence: TMappingConfidence } | null => {
  const aliases = CSV_COLUMN_ALIASES[targetId];
  if (!aliases) return null;

  for (const pattern of aliases.high) {
    const match = sourceFields.find((f) => pattern.test(f.name));
    if (match) return { sourceField: match, confidence: "high" };
  }
  for (const pattern of aliases.medium) {
    const match = sourceFields.find((f) => pattern.test(f.name));
    if (match) return { sourceField: match, confidence: "medium" };
  }
  // Fuzzy substring fallback: target id token contained in header.
  const idToken = targetId.split("_").pop() ?? targetId;
  const fuzzy = sourceFields.find((f) => f.name.toLowerCase().includes(idToken.toLowerCase()));
  if (fuzzy) return { sourceField: fuzzy, confidence: "low" };

  return null;
};

// Auto-maps source columns onto CSV target fields based on header aliases, the filename, and a
// sample row. Resolves conflicts (one source matched by multiple targets) by giving the source to
// the highest-confidence target; later targets fall through to lower-confidence matches or remain
// unmapped.
export const autoMapCsvSourceFields = ({
  sourceFields,
  sampleRow,
  fileName,
}: TAutoMapInput): TAutoMapResult => {
  const mappings: TFieldMapping[] = [];
  const confidence: Record<string, TMappingConfidence> = {};
  const claimedSources = new Set<string>();

  // Match strength order — higher confidence claims a source first.
  const orderedTargets = CSV_TARGET_FIELDS.map((t) => t.id);

  // First pass: high-confidence matches.
  for (const targetId of orderedTargets) {
    const aliases = CSV_COLUMN_ALIASES[targetId];
    if (!aliases) continue;
    for (const pattern of aliases.high) {
      const match = sourceFields.find((f) => !claimedSources.has(f.id) && pattern.test(f.name));
      if (match) {
        mappings.push({ targetFieldId: targetId, sourceFieldId: match.id });
        confidence[targetId] = "high";
        claimedSources.add(match.id);
        break;
      }
    }
  }

  // Second pass: medium-confidence matches for still-unmapped targets.
  for (const targetId of orderedTargets) {
    if (confidence[targetId]) continue;
    const aliases = CSV_COLUMN_ALIASES[targetId];
    if (!aliases) continue;
    for (const pattern of aliases.medium) {
      const match = sourceFields.find((f) => !claimedSources.has(f.id) && pattern.test(f.name));
      if (match) {
        mappings.push({ targetFieldId: targetId, sourceFieldId: match.id });
        confidence[targetId] = "medium";
        claimedSources.add(match.id);
        break;
      }
    }
  }

  // Third pass: low-confidence fuzzy substring matches (best effort).
  for (const targetId of orderedTargets) {
    if (confidence[targetId]) continue;
    const remaining = sourceFields.filter((f) => !claimedSources.has(f.id));
    const guess = findBestSourceMatch(targetId, remaining);
    if (guess && guess.confidence === "low") {
      mappings.push({ targetFieldId: targetId, sourceFieldId: guess.sourceField.id });
      confidence[targetId] = "low";
      claimedSources.add(guess.sourceField.id);
    }
  }

  // collected_at: if no column matched, default to "$now".
  if (!confidence.collected_at) {
    mappings.push({ targetFieldId: "collected_at", staticValue: "$now" });
    confidence.collected_at = "high";
  }

  // source_name: prepopulate from filename (titleized) if not column-mapped.
  if (!confidence.source_name) {
    mappings.push({ targetFieldId: "source_name", staticValue: titleizeFromFileName(fileName) });
    confidence.source_name = "high";
  }

  // field_type: if still unmapped, infer from the response_value column's name and sample. Name
  // hints (e.g. column "rating" → field_type "rating") win over sample-based sniffing.
  if (!confidence.field_type) {
    const responseMapping = mappings.find((m) => m.targetFieldId === "response_value");
    if (responseMapping?.sourceFieldId) {
      const sourceField = sourceFields.find((f) => f.id === responseMapping.sourceFieldId);
      const inferred = inferFieldType({
        columnName: sourceField?.name,
        samples: [sampleRow[responseMapping.sourceFieldId] ?? ""],
      });
      mappings.push({ targetFieldId: "field_type", staticValue: inferred });
      // Name-hint matches deserve higher confidence than blind sample sniffing.
      const nameHinted = sourceField?.name
        ? FIELD_TYPE_NAME_HINTS.some((h) => h.pattern.test(sourceField.name))
        : false;
      confidence.field_type = nameHinted ? "high" : "medium";
    }
  }

  return { mappings, confidence };
};

// CSV-specific validator: confirms every UI-required field is resolved (column mapping or
// non-empty static value). Returns the missing fields so the UI can render a useful error.
export const areAllRequiredCsvFieldsMapped = (
  mappings: TFieldMapping[]
): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];
  for (const requiredId of CSV_REQUIRED_UI_FIELDS) {
    const mapping = mappings.find((m) => m.targetFieldId === requiredId);
    const resolved = Boolean(mapping?.sourceFieldId || mapping?.staticValue?.trim());
    if (!resolved) missing.push(requiredId);
  }
  return { valid: missing.length === 0, missing };
};
