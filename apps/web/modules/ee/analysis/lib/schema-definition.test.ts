import type { TFunction } from "i18next";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  FEEDBACK_FIELDS,
  SELECTABLE_VALUE_DIMENSION_IDS,
  SENTIMENT_VALUE_ORDER,
  formatCubeColumnHeader,
  getFieldById,
  getFilterOperatorsForType,
  getTranslatedDimensionValueLabel,
  isSelectableValueDimension,
  sortRowsByEnumDimension,
} from "./schema-definition";

const chartCubeSchemaPath = fileURLToPath(
  new URL("../../../../../../charts/formbricks/cube/schema/FeedbackRecords.js", import.meta.url)
);
const dockerCubeSchemaPath = fileURLToPath(
  new URL("../../../../../../docker/cube/schema/FeedbackRecords.js", import.meta.url)
);

const readChartCubeSchema = (): string => readFileSync(chartCubeSchemaPath, "utf8");
const readDockerCubeSchema = (): string => readFileSync(dockerCubeSchemaPath, "utf8");
const getCubeMemberName = (id: string): string => id.replace("FeedbackRecords.", "");

describe("schema-definition", () => {
  describe("getFilterOperatorsForType", () => {
    test("returns string operators", () => {
      const ops = getFilterOperatorsForType("string");
      expect(ops).toContain("equals");
      expect(ops).toContain("contains");
      expect(ops).toContain("set");
    });

    test("returns number operators", () => {
      const ops = getFilterOperatorsForType("number");
      expect(ops).toContain("gt");
      expect(ops).toContain("gte");
      expect(ops).toContain("lt");
      expect(ops).toContain("lte");
    });

    test("returns time operators", () => {
      const ops = getFilterOperatorsForType("time");
      expect(ops).toContain("equals");
      expect(ops).toContain("set");
    });
  });

  describe("getFieldById", () => {
    test("returns dimension by id", () => {
      const field = getFieldById("FeedbackRecords.sourceType");
      expect(field).toBeDefined();
      expect(field?.label).toBe("Source Type");
      expect(field?.type).toBe("string");
    });

    test("returns measure by id", () => {
      const field = getFieldById("FeedbackRecords.count");
      expect(field).toBeDefined();
      expect(field?.label).toBe("Count");
    });

    test("returns undefined for unknown id", () => {
      expect(getFieldById("Unknown.field")).toBeUndefined();
    });
  });

  describe("formatCubeColumnHeader", () => {
    test("extracts granularity label for time dimension key", () => {
      expect(formatCubeColumnHeader("FeedbackRecords.collectedAt.day")).toBe("Day");
      expect(formatCubeColumnHeader("FeedbackRecords.collectedAt.month")).toBe("Month");
    });

    test("returns field label for known dimension/measure", () => {
      expect(formatCubeColumnHeader("FeedbackRecords.sourceType")).toBe("Source Type");
      expect(formatCubeColumnHeader("FeedbackRecords.count")).toBe("Count");
    });

    test("converts last segment to title case for unknown keys", () => {
      expect(formatCubeColumnHeader("Some.camelCaseKey")).toBe("Camel Case Key");
    });

    test("handles key with no dots", () => {
      expect(formatCubeColumnHeader("singleKey")).toBe("Single Key");
    });
  });

  describe("FEEDBACK_FIELDS", () => {
    test("has dimensions and measures", () => {
      expect(FEEDBACK_FIELDS.dimensions.length).toBeGreaterThan(0);
      expect(FEEDBACK_FIELDS.measures.length).toBeGreaterThan(0);
    });

    test("exposes CSAT, CES, NPS and universal measures", () => {
      const ids = FEEDBACK_FIELDS.measures.map((m) => m.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          "FeedbackRecords.count",
          "FeedbackRecords.uniqueRespondents",
          "FeedbackRecords.uniqueResponses",
          "FeedbackRecords.npsScore",
          "FeedbackRecords.npsAverage",
          "FeedbackRecords.csatScore",
          "FeedbackRecords.csatAverage",
          "FeedbackRecords.csatSatisfiedCount",
          "FeedbackRecords.csatCount",
          "FeedbackRecords.cesAverage",
          "FeedbackRecords.cesCount",
        ])
      );
      expect(ids).not.toContain("FeedbackRecords.averageScore");
    });

    test("only exposes members present in the deployed Cube schema", () => {
      const chartCubeSchema = readChartCubeSchema();
      const exposedMembers = [...FEEDBACK_FIELDS.measures, ...FEEDBACK_FIELDS.dimensions].map(({ id }) =>
        getCubeMemberName(id)
      );

      for (const member of exposedMembers) {
        expect(chartCubeSchema).toContain(`    ${member}: {`);
      }
    });

    test("keeps the Helm and Docker Cube schemas in sync", () => {
      expect(readChartCubeSchema()).toBe(readDockerCubeSchema());
    });
  });

  describe("Hub enrichment fields (sentiment + emotions)", () => {
    test("exposes the enrichment dimensions and measures", () => {
      const dimensionIds = FEEDBACK_FIELDS.dimensions.map((d) => d.id);
      expect(dimensionIds).toEqual(
        expect.arrayContaining([
          "FeedbackRecords.sentiment",
          "FeedbackRecords.sentimentScore",
          "FeedbackRecords.emotions",
        ])
      );

      const measureIds = FEEDBACK_FIELDS.measures.map((m) => m.id);
      expect(measureIds).toEqual(
        expect.arrayContaining([
          "FeedbackRecords.sentimentAverage",
          "FeedbackRecords.joyCount",
          "FeedbackRecords.angerCount",
          "FeedbackRecords.sadnessCount",
          "FeedbackRecords.fearCount",
          "FeedbackRecords.surpriseCount",
          "FeedbackRecords.disgustCount",
        ])
      );
    });

    test("enrichment members exist in both deployed Cube schemas", () => {
      const dockerSchema = readDockerCubeSchema();
      const chartSchema = readChartCubeSchema();
      const members = [
        "sentiment",
        "sentimentScore",
        "emotions",
        "sentimentAverage",
        "joyCount",
        "angerCount",
        "sadnessCount",
        "fearCount",
        "surpriseCount",
        "disgustCount",
      ];

      for (const member of members) {
        expect(dockerSchema).toContain(`    ${member}: {`);
        expect(chartSchema).toContain(`    ${member}: {`);
      }
    });
  });

  describe("getTranslatedDimensionValueLabel", () => {
    const t = ((key: string) => key) as TFunction;

    test("maps sentiment tokens to their i18n keys", () => {
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sentiment", "very_negative", t)).toBe(
        "workspace.analysis.charts.sentiment_value_very_negative"
      );
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sentiment", "mixed", t)).toBe(
        "workspace.analysis.charts.sentiment_value_mixed"
      );
    });

    test("translates each token of a comma-separated emotions set", () => {
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.emotions", "anger, joy", t)).toBe(
        "workspace.analysis.charts.emotion_value_anger, workspace.analysis.charts.emotion_value_joy"
      );
    });

    test("returns undefined for unknown tokens and non-enum dimensions", () => {
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sentiment", "great", t)).toBeUndefined();
      expect(
        getTranslatedDimensionValueLabel("FeedbackRecords.emotions", "anger, ecstasy", t)
      ).toBeUndefined();
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sourceName", "anger", t)).toBeUndefined();
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sentiment", 3, t)).toBeUndefined();
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sentiment", "", t)).toBeUndefined();
    });
  });

  describe("sortRowsByEnumDimension", () => {
    test("sorts sentiment rows on the scale with mixed last and unknowns at the end", () => {
      const rows = [
        { "FeedbackRecords.sentiment": "mixed" },
        { "FeedbackRecords.sentiment": "positive" },
        { "FeedbackRecords.sentiment": "surprising" },
        { "FeedbackRecords.sentiment": "very_negative" },
        { "FeedbackRecords.sentiment": "neutral" },
      ];

      const sorted = sortRowsByEnumDimension(rows, "FeedbackRecords.sentiment");

      expect(sorted.map((r) => r["FeedbackRecords.sentiment"])).toEqual([
        "very_negative",
        "neutral",
        "positive",
        "mixed",
        "surprising",
      ]);
      // input untouched
      expect(rows[0]["FeedbackRecords.sentiment"]).toBe("mixed");
    });

    test("covers the full sentiment scale order", () => {
      expect(SENTIMENT_VALUE_ORDER).toEqual([
        "very_negative",
        "negative",
        "neutral",
        "positive",
        "very_positive",
        "mixed",
      ]);
    });

    test("leaves rows of other dimensions unchanged", () => {
      const rows = [{ "FeedbackRecords.sourceName": "b" }, { "FeedbackRecords.sourceName": "a" }];
      expect(sortRowsByEnumDimension(rows, "FeedbackRecords.sourceName")).toBe(rows);
    });
  });

  describe("isSelectableValueDimension", () => {
    test("accepts low-cardinality string dimensions", () => {
      expect(isSelectableValueDimension("FeedbackRecords.sourceName")).toBe(true);
      expect(isSelectableValueDimension("FeedbackRecords.sourceType")).toBe(true);
      expect(isSelectableValueDimension("FeedbackRecords.language")).toBe(true);
      expect(isSelectableValueDimension("FeedbackRecords.fieldLabel")).toBe(true);
      expect(isSelectableValueDimension("FeedbackRecords.sentiment")).toBe(true);
    });

    test("rejects free-text, numeric, time, and unknown fields", () => {
      expect(isSelectableValueDimension("FeedbackRecords.valueText")).toBe(false);
      // multi-label set — equals on a picked combination is a trap, filter via contains
      expect(isSelectableValueDimension("FeedbackRecords.emotions")).toBe(false);
      expect(isSelectableValueDimension("FeedbackRecords.valueNumber")).toBe(false);
      expect(isSelectableValueDimension("FeedbackRecords.collectedAt")).toBe(false);
      expect(isSelectableValueDimension("FeedbackRecords.userId")).toBe(false);
      expect(isSelectableValueDimension("Unknown.field")).toBe(false);
    });

    test("every selectable dimension is a defined string dimension", () => {
      for (const id of SELECTABLE_VALUE_DIMENSION_IDS) {
        const field = getFieldById(id);
        expect(field).toBeDefined();
        expect(field?.type).toBe("string");
      }
    });
  });

  describe("normalized companion dimensions", () => {
    // Hidden LOWER(TRIM(...)) companions selected by the Cube queryRewrite for
    // case-insensitive equals/notEquals. Must exist in the deployed schema.
    const normalizedMembers = [
      "sourceTypeNormalized",
      "sourceNameNormalized",
      "fieldTypeNormalized",
      "fieldLabelNormalized",
      "fieldGroupLabelNormalized",
      "languageNormalized",
      "valueTextNormalized",
    ];

    test("are present in both Cube schemas with a LOWER(TRIM(...)) sql and hidden", () => {
      const dockerSchema = readDockerCubeSchema();
      const chartSchema = readChartCubeSchema();

      for (const member of normalizedMembers) {
        expect(dockerSchema).toContain(`    ${member}: {`);
        expect(chartSchema).toContain(`    ${member}: {`);
      }
      expect(dockerSchema).toContain("LOWER(TRIM(source_name))");
      expect(dockerSchema).toContain("shown: false");
    });

    test("are not exposed as user-facing dimensions", () => {
      const exposedIds = FEEDBACK_FIELDS.dimensions.map((d) => d.id);
      for (const member of normalizedMembers) {
        expect(exposedIds).not.toContain(`FeedbackRecords.${member}`);
      }
    });
  });
});
