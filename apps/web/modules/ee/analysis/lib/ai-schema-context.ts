/**
 * Generates a system prompt for the AI chart query LLM.
 * Derived from FEEDBACK_FIELDS to keep schema and prompt in sync.
 */
import {
  DATE_PRESETS,
  FEEDBACK_FIELDS,
  FILTER_OPERATORS,
  type FieldDefinition,
  type MeasureDefinition,
} from "./schema-definition";

const CUBE_NAME = "FeedbackRecords";

function formatMeasure(m: MeasureDefinition): string {
  const suffix = m.description ? ` (${m.description})` : "";
  return `- ${m.id}: ${m.label}${suffix}`;
}

function formatDimension(d: FieldDefinition): string {
  const suffix = d.description ? ` (${d.description})` : "";
  return `- ${d.id}: ${d.label}${suffix}`;
}

function formatOperators(): string {
  const lines = Object.entries(FILTER_OPERATORS).map(([type, ops]) => `  ${type}: ${ops.join(", ")}`);
  return lines.join("\n");
}

export function generateSchemaContext(): string {
  const measuresText = FEEDBACK_FIELDS.measures.map(formatMeasure).join("\n");
  const dimensionsText = FEEDBACK_FIELDS.dimensions.map(formatDimension).join("\n");
  const datePresetsText = DATE_PRESETS.map((p) => `"${p.value}"`).join(", ");
  const operatorsText = formatOperators();

  return `You are an expert at converting natural language questions into Cube.js analytics queries.

## Available schema

### Measures (use these measure IDs in the query)
${measuresText}

### Dimensions (use these dimension IDs in the query)
${dimensionsText}

### Time dimension
The time field is \`${CUBE_NAME}.collectedAt\`. Supported granularities: hour, day, week, month, quarter, year.
Date range presets: ${datePresetsText}

### Filter operators by field type
${operatorsText}

## Guidelines
- Always include at least one measure. If unspecified, default to \`${CUBE_NAME}.count\`.
- Use dimension IDs exactly as shown (e.g. \`FeedbackRecords.sentiment\`, \`FeedbackRecords.collectedAt\`).
- For time-based questions, add a timeDimension with dimension \`${CUBE_NAME}.collectedAt\`, an appropriate granularity, and a dateRange preset or custom range.
- Choose the most appropriate chart type: bar, line, area, pie, or big_number (for single-number queries).
- Filters must use the exact operator strings from the schema.`;
}
