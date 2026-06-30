import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  FEEDBACK_FIELDS,
  formatCubeColumnHeader,
  getFieldById,
  getFilterOperatorsForType,
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
});
