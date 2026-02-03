import fs from "fs";
import path from "path";

/**
 * Parses the Cube.js schema file to extract measures and dimensions
 * This keeps the schema as the single source of truth for AI query generation
 */

interface MeasureInfo {
  name: string;
  description: string;
}

interface DimensionInfo {
  name: string;
  description: string;
  type: "string" | "number" | "time";
}

// Path to schema file - self-contained within the analytics folder
const SCHEMA_FILE_PATH = path.join(process.cwd(), "app", "api", "analytics", "_schema", "FeedbackRecords.js");

/**
 * Extract description from a schema property object
 */
function extractDescription(objStr: string): string {
  const descMatch = objStr.match(/description:\s*`([^`]+)`/);
  return descMatch ? descMatch[1] : "";
}

/**
 * Extract type from a dimension object
 */
function extractType(objStr: string): "string" | "number" | "time" {
  const typeMatch = objStr.match(/type:\s*`(string|number|time)`/);
  return (typeMatch?.[1] as "string" | "number" | "time") || "string";
}

/**
 * Helper to extract content inside the first matching brace block
 */
function extractInnerBlockContent(content: string, startRegex: RegExp): string | null {
  const match = content.match(startRegex);
  if (!match) return null;

  // Backtrack to find the opening brace in the match
  const braceIndex = match[0].lastIndexOf("{");
  if (braceIndex === -1) return null; // Should not happen given regex usage

  // Actually we can just start scanning from the end of the match if the regex ends with {
  // But let's be safer: start counting from the opening brace.
  const absoluteStartIndex = match.index! + braceIndex;

  let braceCount = 1;
  let i = absoluteStartIndex + 1;

  while (braceCount > 0 && i < content.length) {
    if (content[i] === "{") braceCount++;
    else if (content[i] === "}") braceCount--;
    i++;
  }

  if (braceCount === 0) {
    return content.substring(absoluteStartIndex + 1, i - 1);
  }

  return null;
}

/**
 * Parse measures from the schema file
 */
function parseMeasures(schemaContent: string): MeasureInfo[] {
  const measures: MeasureInfo[] = [];

  const measuresBlock = extractInnerBlockContent(schemaContent, /measures:\s*\{/);
  if (!measuresBlock) return measures;

  // Match each measure: measureName: { ... }
  const measureRegex = /(\w+):\s*\{/g;
  let match;

  while ((match = measureRegex.exec(measuresBlock)) !== null) {
    const name = match[1];
    const startIndex = match.index + match[0].length;

    // Find the matching closing brace
    let braceCount = 1;
    let endIndex = startIndex;

    while (braceCount > 0 && endIndex < measuresBlock.length) {
      if (measuresBlock[endIndex] === "{") braceCount++;
      if (measuresBlock[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const body = measuresBlock.substring(startIndex, endIndex - 1);
    const description = extractDescription(body);

    if (description) {
      measures.push({ name, description });
    }
  }

  return measures;
}

/**
 * Parse dimensions from a specific cube
 */
function parseDimensionsFromCube(cubeContent: string, cubeName: string): DimensionInfo[] {
  const dimensions: DimensionInfo[] = [];

  const dimensionsBlock = extractInnerBlockContent(cubeContent, /dimensions:\s*\{/);
  if (!dimensionsBlock) return dimensions;

  // Match each dimension: dimensionName: { ... }
  const dimensionRegex = /(\w+):\s*\{/g;
  let match;

  while ((match = dimensionRegex.exec(dimensionsBlock)) !== null) {
    const name = match[1];
    const startIndex = match.index + match[0].length;

    // Find the matching closing brace
    let braceCount = 1;
    let endIndex = startIndex;

    while (braceCount > 0 && endIndex < dimensionsBlock.length) {
      if (dimensionsBlock[endIndex] === "{") braceCount++;
      if (dimensionsBlock[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const body = dimensionsBlock.substring(startIndex, endIndex - 1);
    const description = extractDescription(body);
    const type = extractType(body);

    // Skip primaryKey dimensions (like 'id') and internal dimensions
    if (body.includes("primaryKey: true") || name === "feedbackRecordId") {
      continue;
    }

    if (description) {
      dimensions.push({
        name: cubeName === "FeedbackRecords" ? name : `${cubeName}.${name}`,
        description,
        type,
      });
    }
  }

  return dimensions;
}

/**
 * Parse dimensions from the schema file
 */
function parseDimensions(schemaContent: string): DimensionInfo[] {
  const dimensions: DimensionInfo[] = [];

  // Extract dimensions from FeedbackRecords cube
  const feedbackRecordsMatch = schemaContent.match(/cube\(`FeedbackRecords`,\s*\{([\s\S]*?)\n\}\);/);
  if (feedbackRecordsMatch) {
    const feedbackRecordsDimensions = parseDimensionsFromCube(feedbackRecordsMatch[1], "FeedbackRecords");
    dimensions.push(...feedbackRecordsDimensions);
  }

  // Extract dimensions from TopicsUnnested cube
  const topicsUnnestedMatch = schemaContent.match(/cube\(`TopicsUnnested`,\s*\{([\s\S]*?)\n\}\);/);
  if (topicsUnnestedMatch) {
    const topicsDimensions = parseDimensionsFromCube(topicsUnnestedMatch[1], "TopicsUnnested");
    dimensions.push(...topicsDimensions);
  }

  return dimensions;
}

/**
 * Read and parse the schema file
 */
export function parseSchemaFile(): {
  measures: MeasureInfo[];
  dimensions: DimensionInfo[];
} {
  try {
    const schemaContent = fs.readFileSync(SCHEMA_FILE_PATH, "utf-8");
    const measures = parseMeasures(schemaContent);
    const dimensions = parseDimensions(schemaContent);

    return { measures, dimensions };
  } catch (error) {
    console.error("Error parsing schema file:", error);
    // Fallback to empty arrays if parsing fails
    return { measures: [], dimensions: [] };
  }
}

/**
 * Generate the schema context string for AI query generation
 */
export function generateSchemaContext(): string {
  const { measures, dimensions } = parseSchemaFile();
  const CUBE_NAME = "FeedbackRecords";

  const measuresList = measures.map((m) => `- ${CUBE_NAME}.${m.name} - ${m.description}`).join("\n");

  const dimensionsList = dimensions
    .map((d) => {
      const typeLabel = d.type === "time" ? " (time dimension)" : ` (${d.type})`;
      // Dimensions from TopicsUnnested already have the cube prefix
      const fullName = d.name.includes(".") ? d.name : `${CUBE_NAME}.${d.name}`;
      return `- ${fullName} - ${d.description}${typeLabel}`;
    })
    .join("\n");

  const categoricalDimensions = dimensions
    .filter(
      (d) =>
        d.type === "string" &&
        !d.name.includes("responseId") &&
        !d.name.includes("userIdentifier") &&
        !d.name.includes("feedbackRecordId")
    )
    .map((d) => (d.name.includes(".") ? d.name : `${CUBE_NAME}.${d.name}`))
    .join(", ");

  return `
You are a CubeJS query generator. Your task is to convert natural language requests into valid CubeJS query JSON objects.

Available Cubes: ${CUBE_NAME}, TopicsUnnested

MEASURES (use these in the "measures" array):
${measuresList}

DIMENSIONS (use these in the "dimensions" array):
${dimensionsList}

TIME DIMENSIONS:
- ${CUBE_NAME}.collectedAt can be used with granularity: 'day', 'week', 'month', 'year'
- Use "timeDimensions" array for time-based queries with dateRange like "last 7 days", "last 30 days", "this month", etc.

CHART TYPE SUGGESTIONS:
- If query has timeDimensions → suggest "bar" or "line"
- If query has categorical dimensions (${categoricalDimensions}) → suggest "donut" or "bar"
- If query has only measures → suggest "kpi"
- If query compares multiple measures → suggest "bar"

FILTERS:
- Use "filters" array to include/exclude records based on dimension values
- Filter format: { "member": "CubeName.dimensionName", "operator": "operator" } OR { "member": "CubeName.dimensionName", "operator": "operator", "values": [...] }
- Common operators:
  * "set" - dimension is not null/empty (Set "values" to null)
    Example: { "member": "${CUBE_NAME}.emotion", "operator": "set", "values": null }
  * "notSet" - dimension is null/empty (Set "values" to null)
    Example: { "member": "${CUBE_NAME}.emotion", "operator": "notSet", "values": null }
  * "equals" - exact match (REQUIRES "values" field)
    Example: { "member": "${CUBE_NAME}.emotion", "operator": "equals", "values": ["happy"] }
  * "notEquals" - not equal (REQUIRES "values" field)
    Example: { "member": "${CUBE_NAME}.emotion", "operator": "notEquals", "values": ["sad"] }
  * "contains" - contains text (REQUIRES "values" field)
    Example: { "member": "${CUBE_NAME}.emotion", "operator": "contains", "values": ["happy"] }
- Examples for common user requests:
  * "only records with emotion" or "for records that have emotion" → { "member": "${CUBE_NAME}.emotion", "operator": "set", "values": null }
  * "exclude records without emotion" or "do not include records without emotion" → { "member": "${CUBE_NAME}.emotion", "operator": "set", "values": null }
  * "exclude records with emotion" or "do not include records with emotion" → { "member": "${CUBE_NAME}.emotion", "operator": "notSet", "values": null }
  * "only happy emotions" → { "member": "${CUBE_NAME}.emotion", "operator": "equals", "values": ["happy"] }

IMPORTANT RULES:
1. Always return valid JSON only, no markdown or code blocks
2. Use exact measure/dimension names as listed above
3. Include "chartType" field: "bar", "line", "donut", "kpi", or "area"
4. For time queries, use timeDimensions array with granularity and dateRange
5. Return format: { "measures": [...], "dimensions": [...], "timeDimensions": [...], "filters": [...], "chartType": "..." }
6. If user asks about trends over time, use timeDimensions
7. If user asks "by X", add X as a dimension
8. If user asks for counts or totals, use ${CUBE_NAME}.count
9. If user asks for NPS, use ${CUBE_NAME}.npsScore
10. If user asks about topics, use TopicsUnnested.topic (NOT ${CUBE_NAME}.topic)
11. CRITICAL: If user says "only records with X", "exclude records without X", or "for records that have X", add a filter with operator "set" for that dimension
12. CRITICAL: If user says "exclude records with X", "do not include records with X", or "without X", add a filter with operator "notSet" for that dimension
13. Always include filters when user explicitly mentions including/excluding records based on dimension values
`.trim();
}

export const CUBE_NAME = "FeedbackRecords";
