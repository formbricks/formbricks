import type { TFunction } from "i18next";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { describe, expect, test } from "vitest";
import {
  EMOTION_MEASURE_ORDER,
  EMOTION_VALUES,
  FEEDBACK_FIELDS,
  MEASURE_GROUP_ORDER,
  SELECTABLE_VALUE_DIMENSION_IDS,
  SENTIMENT_MEASURE_ORDER,
  SENTIMENT_VALUE_ORDER,
  formatCubeColumnHeader,
  getFieldById,
  getFilterOperatorsForType,
  getMeasureAxisLabel,
  getSentimentValueForMeasureId,
  getTranslatedDimensionValueLabel,
  getTranslatedFieldDescription,
  getTranslatedFieldLabel,
  isEnrichmentDimensionId,
  isNotEnrichedDimensionValue,
  isRatioMeasure,
  isSelectableValueDimension,
  sortMeasureIdsForCategoryAxis,
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
      expect(field?.label).toBe("Feedback Records");
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
      expect(formatCubeColumnHeader("FeedbackRecords.count")).toBe("Feedback Records");
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

    test("exposes CSAT, CES, NPS, rating and universal measures", () => {
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
          "FeedbackRecords.ratingAverage",
          "FeedbackRecords.ratingCount",
        ])
      );
      expect(ids).not.toContain("FeedbackRecords.averageScore");
    });

    test("every measure has a valid UX group", () => {
      for (const m of FEEDBACK_FIELDS.measures) {
        expect(MEASURE_GROUP_ORDER).toContain(m.group);
      }
    });

    test("labels buckets with the 'Domain: Detail' scheme", () => {
      // `group` only exists on measures, so look the ids up in the measures list directly.
      const getMeasureById = (id: string) => FEEDBACK_FIELDS.measures.find((m) => m.id === id);

      expect(getFieldById("FeedbackRecords.joyCount")?.label).toBe("Emotion: Joy");
      expect(getFieldById("FeedbackRecords.veryPositiveCount")?.label).toBe("Sentiment: Very positive");
      expect(getFieldById("FeedbackRecords.promoterCount")?.label).toBe("NPS: Promoters");
      expect(getMeasureById("FeedbackRecords.promoterCount")?.group).toBe("count");
      expect(getMeasureById("FeedbackRecords.npsAverage")?.group).toBe("average");
      expect(getMeasureById("FeedbackRecords.npsScore")?.group).toBe("score");
    });

    test("classifies scores and averages as ratios, and counts as additive", () => {
      // Drives two decisions that must not diverge: whether an empty bucket means 0 or "no value",
      // and whether per-group values may be folded into one.
      expect(isRatioMeasure("FeedbackRecords.npsScore")).toBe(true);
      expect(isRatioMeasure("FeedbackRecords.csatScore")).toBe(true);
      expect(isRatioMeasure("FeedbackRecords.npsAverage")).toBe(true);
      expect(isRatioMeasure("FeedbackRecords.sentimentAverage")).toBe(true);

      expect(isRatioMeasure("FeedbackRecords.count")).toBe(false);
      expect(isRatioMeasure("FeedbackRecords.promoterCount")).toBe(false);
      expect(isRatioMeasure("FeedbackRecords.uniqueRespondents")).toBe(false);

      // Not a measure, and not in the schema at all: both keep the additive default.
      expect(isRatioMeasure("FeedbackRecords.sourceName")).toBe(false);
      expect(isRatioMeasure("FeedbackRecords.notAMeasure")).toBe(false);
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

  describe("Response context (ENG-1555 metadata)", () => {
    const metadataDimensionIds = [
      "FeedbackRecords.metadataSource",
      "FeedbackRecords.metadataUrl",
      "FeedbackRecords.metadataBrowser",
      "FeedbackRecords.metadataOs",
      "FeedbackRecords.metadataDevice",
      "FeedbackRecords.metadataCountry",
      "FeedbackRecords.metadataAction",
      "FeedbackRecords.metadataFinished",
      "FeedbackRecords.metadataDurationSeconds",
      "FeedbackRecords.metadataEndingId",
      "FeedbackRecords.metadataSurveyType",
    ];

    test("exposes one dimension per key the ingestion allowlist writes", () => {
      const dimensionIds = FEEDBACK_FIELDS.dimensions.map((d) => d.id);
      expect(dimensionIds).toEqual(expect.arrayContaining(metadataDimensionIds));
    });

    test("types the two non-text keys as their own types rather than strings", () => {
      // The filter UI picks its operators off this type, so a boolean typed as a string would offer
      // `contains` on true/false and no gt/lt on the duration.
      expect(getFieldById("FeedbackRecords.metadataFinished")?.type).toBe("boolean");
      expect(getFieldById("FeedbackRecords.metadataDurationSeconds")?.type).toBe("number");
    });

    test("members exist in both deployed Cube schemas", () => {
      const dockerSchema = readDockerCubeSchema();
      const chartSchema = readChartCubeSchema();

      for (const id of metadataDimensionIds) {
        expect(dockerSchema).toContain(`    ${getCubeMemberName(id)}: {`);
        expect(chartSchema).toContain(`    ${getCubeMemberName(id)}: {`);
      }
    });

    test("reads the non-text keys through a guard instead of a bare cast", () => {
      // `metadata` is free-form jsonb any writer can fill, so a bare ::boolean / ::double precision
      // on a malformed value fails the whole chart query rather than that one row. The digit bounds
      // are part of the guard: an unbounded digit run still reads as a number but overflows or
      // underflows double precision, which raises 22003 for the whole query.
      for (const schema of [readDockerCubeSchema(), readChartCubeSchema()]) {
        expect(schema).toContain("LOWER(${CUBE}.metadata->>'finished') IN ('true', 'false')");
        expect(schema).toContain(
          "metadata->>'duration_seconds' ~ '\\\\A-?[0-9]{1,15}(\\\\.[0-9]{1,6})?\\\\Z'"
        );
      }
    });

    test("keeps every member's SQL free of JS replacement specials", () => {
      // Cube splices a member's SQL into its filter templates with String.prototype.replace, where
      // that SQL is the *replacement* argument — so `$'`, `` $` ``, `$&`, `$<name>`, `$1` and `$$`
      // are expansion tokens rather than literals there. A regex ending in `$'` is the easy way to
      // hit this: it swallowed the closing quote, spliced ` IS NULL` inside the string literal, and
      // turned `set` / `notSet` on metadataDurationSeconds into an HTTP 400. `$$` is the quiet one —
      // it collapses to a single `$` instead of erroring, so a dollar-quoted body would come out
      // subtly rewritten rather than rejected. Assert the class, not one pattern, and read it off
      // the evaluated model rather than the file text so a member added later cannot sidestep it.
      const REPLACEMENT_SPECIAL = /\$(['`&$]|<|\d)/;

      for (const path of [dockerCubeSchemaPath, chartCubeSchemaPath]) {
        let captured:
          | { dimensions: Record<string, { sql?: string }>; measures: Record<string, { sql?: string }> }
          | undefined;
        const sandbox = {
          CUBE: "TBL",
          cube: (_name: string, definition: typeof captured) => {
            captured = definition;
          },
        };
        createContext(sandbox);
        runInContext(readFileSync(path, "utf8"), sandbox);

        const members = [
          ...Object.entries(captured?.dimensions ?? {}),
          ...Object.entries(captured?.measures ?? {}),
        ];
        expect(members.length).toBeGreaterThan(0);

        const offenders = members
          .filter(
            ([, definition]) => typeof definition.sql === "string" && REPLACEMENT_SPECIAL.test(definition.sql)
          )
          .map(([name]) => name);
        expect(offenders).toEqual([]);
      }
    });

    test("offers a value pick-list for the low-cardinality keys only", () => {
      for (const id of [
        "FeedbackRecords.metadataSource",
        "FeedbackRecords.metadataSurveyType",
        "FeedbackRecords.metadataBrowser",
        "FeedbackRecords.metadataOs",
        "FeedbackRecords.metadataDevice",
        "FeedbackRecords.metadataCountry",
        "FeedbackRecords.metadataAction",
        "FeedbackRecords.metadataEndingId",
      ]) {
        expect(isSelectableValueDimension(id)).toBe(true);
      }
      // One bucket per path: a pick-list of URLs is the valueText problem again.
      expect(isSelectableValueDimension("FeedbackRecords.metadataUrl")).toBe(false);
    });

    test("labels resolve to i18n keys rather than the raw dimension id", () => {
      const t = ((key: string) => key) as unknown as TFunction;

      for (const id of metadataDimensionIds) {
        expect(getTranslatedFieldLabel(id, t)).toMatch(/^workspace\.analysis\.charts\.field_label_/);
      }
    });

    test("translates the descriptions that carry a chart-building caveat", () => {
      const t = ((key: string) => key) as unknown as TFunction;

      expect(getTranslatedFieldDescription("FeedbackRecords.metadataFinished", "fallback", t)).toBe(
        "workspace.analysis.charts.field_description_completed"
      );
      expect(getTranslatedFieldDescription("FeedbackRecords.metadataDurationSeconds", "fallback", t)).toBe(
        "workspace.analysis.charts.field_description_time_to_complete"
      );
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
          "FeedbackRecords.veryNegativeCount",
          "FeedbackRecords.negativeCount",
          "FeedbackRecords.neutralCount",
          "FeedbackRecords.positiveCount",
          "FeedbackRecords.veryPositiveCount",
          "FeedbackRecords.mixedCount",
          "FeedbackRecords.joyCount",
          "FeedbackRecords.angerCount",
          "FeedbackRecords.sadnessCount",
          "FeedbackRecords.fearCount",
          "FeedbackRecords.surpriseCount",
          "FeedbackRecords.disgustCount",
        ])
      );
    });

    test("orders sentiment count measures most-positive → mixed", () => {
      const expectedOrder = [
        "FeedbackRecords.veryPositiveCount",
        "FeedbackRecords.positiveCount",
        "FeedbackRecords.neutralCount",
        "FeedbackRecords.negativeCount",
        "FeedbackRecords.veryNegativeCount",
        "FeedbackRecords.mixedCount",
      ];
      const measureIds = FEEDBACK_FIELDS.measures.map((m) => m.id);
      const sentimentCountIds = measureIds.filter((id) => expectedOrder.includes(id));
      expect(sentimentCountIds).toEqual(expectedOrder);
    });

    test("orders emotion count measures by the fixed valence order", () => {
      const expectedOrder = [
        "FeedbackRecords.joyCount",
        "FeedbackRecords.surpriseCount",
        "FeedbackRecords.angerCount",
        "FeedbackRecords.sadnessCount",
        "FeedbackRecords.fearCount",
        "FeedbackRecords.disgustCount",
      ];
      const measureIds = FEEDBACK_FIELDS.measures.map((m) => m.id);
      expect(measureIds.filter((id) => expectedOrder.includes(id))).toEqual(expectedOrder);
    });

    test("measure display orders cover exactly their vocabularies", () => {
      expect([...EMOTION_MEASURE_ORDER].sort()).toEqual([...EMOTION_VALUES].sort());
      expect([...SENTIMENT_MEASURE_ORDER].sort()).toEqual([...SENTIMENT_VALUE_ORDER].sort());
    });

    test("maps each sentiment count measure id back to its enum value", () => {
      expect(getSentimentValueForMeasureId("FeedbackRecords.veryNegativeCount")).toBe("very_negative");
      expect(getSentimentValueForMeasureId("FeedbackRecords.negativeCount")).toBe("negative");
      expect(getSentimentValueForMeasureId("FeedbackRecords.neutralCount")).toBe("neutral");
      expect(getSentimentValueForMeasureId("FeedbackRecords.positiveCount")).toBe("positive");
      expect(getSentimentValueForMeasureId("FeedbackRecords.veryPositiveCount")).toBe("very_positive");
      expect(getSentimentValueForMeasureId("FeedbackRecords.mixedCount")).toBe("mixed");
      // non-sentiment measures resolve to nothing
      expect(getSentimentValueForMeasureId("FeedbackRecords.count")).toBeUndefined();
      expect(getSentimentValueForMeasureId("FeedbackRecords.joyCount")).toBeUndefined();
    });

    test("labels each sentiment count measure (no raw-id fallback)", () => {
      const t = ((key: string) => key) as TFunction;
      const sentimentCountIds = [
        "FeedbackRecords.veryNegativeCount",
        "FeedbackRecords.negativeCount",
        "FeedbackRecords.neutralCount",
        "FeedbackRecords.positiveCount",
        "FeedbackRecords.veryPositiveCount",
        "FeedbackRecords.mixedCount",
      ];
      for (const id of sentimentCountIds) {
        // resolves to an i18n key, not the raw dimension id
        expect(getTranslatedFieldLabel(id, t)).toMatch(/^workspace\.analysis\.charts\.field_label_/);
        expect(getTranslatedFieldLabel(id, t)).not.toBe(id);
      }
    });

    test("enrichment members exist in both deployed Cube schemas", () => {
      const dockerSchema = readDockerCubeSchema();
      const chartSchema = readChartCubeSchema();
      const members = [
        "sentiment",
        "sentimentScore",
        "emotions",
        "sentimentAverage",
        "veryNegativeCount",
        "negativeCount",
        "neutralCount",
        "positiveCount",
        "veryPositiveCount",
        "mixedCount",
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

  describe("getTranslatedFieldDescription", () => {
    // Returns something distinguishable from the key, so an assertion cannot pass on an id that
    // resolves to the *wrong* `field_description_*` key — which a key-echoing `t` would allow.
    const t = ((key: string) => `translated:${key}`) as TFunction;

    // The descriptions these ids carry are the copy that tells a user which of three
    // near-identical measures to pick. Routing them through `t()` is what puts them in front of a
    // non-English user; nothing else fails if a key is dropped from the map, because the fallback
    // silently serves the hardcoded English from FEEDBACK_FIELDS and `pnpm i18n` still passes.
    test.each([
      ["FeedbackRecords.valueId", "workspace.analysis.charts.field_description_value_option"],
      ["FeedbackRecords.valueText", "workspace.analysis.charts.field_description_value_text"],
      ["FeedbackRecords.count", "workspace.analysis.charts.field_description_count"],
      ["FeedbackRecords.uniqueRespondents", "workspace.analysis.charts.field_description_unique_respondents"],
      ["FeedbackRecords.uniqueResponses", "workspace.analysis.charts.field_description_unique_responses"],
    ])("resolves %s through i18n rather than the English fallback", (id, key) => {
      expect(getTranslatedFieldDescription(id, "english fallback", t)).toBe(`translated:${key}`);
    });

    test("falls back to the schema's own description for a member with no key", () => {
      expect(getTranslatedFieldDescription("FeedbackRecords.sourceType", "english fallback", t)).toBe(
        "english fallback"
      );
    });

    test("passes an absent description through rather than inventing one", () => {
      expect(getTranslatedFieldDescription("FeedbackRecords.sourceType", undefined, t)).toBeUndefined();
    });

    // The lookup is an object literal, so an id that collides with a prototype member must not
    // resolve through the prototype chain — the defect #8985 had to convert its own lookup to a Map
    // for. Unreachable today (every call site passes an id from the hardcoded FEEDBACK_FIELDS), so
    // this pins it rather than fixing something live.
    test("does not resolve an inherited property as a description", () => {
      expect(getTranslatedFieldDescription("constructor", "english fallback", t)).toBe("english fallback");
      expect(getTranslatedFieldDescription("toString", undefined, t)).toBeUndefined();
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
    });

    test("labels empty enrichment values as 'Not enriched'", () => {
      for (const dimension of ["FeedbackRecords.sentiment", "FeedbackRecords.emotions"]) {
        for (const value of ["", "   ", null, undefined]) {
          expect(getTranslatedDimensionValueLabel(dimension, value, t)).toBe(
            "workspace.analysis.charts.not_enriched"
          );
        }
      }
    });

    test("does not label empty values on non-enrichment dimensions", () => {
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sourceName", "", t)).toBeUndefined();
      expect(getTranslatedDimensionValueLabel("FeedbackRecords.sourceName", null, t)).toBeUndefined();
    });
  });

  describe("sortMeasureIdsForCategoryAxis", () => {
    test("sorts sentiment count measures into the sentiment scale order", () => {
      const pickerOrder = [
        "FeedbackRecords.veryPositiveCount",
        "FeedbackRecords.positiveCount",
        "FeedbackRecords.neutralCount",
        "FeedbackRecords.negativeCount",
        "FeedbackRecords.veryNegativeCount",
        "FeedbackRecords.mixedCount",
      ];
      expect(sortMeasureIdsForCategoryAxis(pickerOrder)).toEqual([
        "FeedbackRecords.veryNegativeCount",
        "FeedbackRecords.negativeCount",
        "FeedbackRecords.neutralCount",
        "FeedbackRecords.positiveCount",
        "FeedbackRecords.veryPositiveCount",
        "FeedbackRecords.mixedCount",
      ]);
    });

    test("keeps non-sentiment measures in their relative order, after sentiment ones", () => {
      const ids = [
        "FeedbackRecords.joyCount",
        "FeedbackRecords.positiveCount",
        "FeedbackRecords.count",
        "FeedbackRecords.veryNegativeCount",
      ];
      expect(sortMeasureIdsForCategoryAxis(ids)).toEqual([
        "FeedbackRecords.veryNegativeCount",
        "FeedbackRecords.positiveCount",
        "FeedbackRecords.joyCount",
        "FeedbackRecords.count",
      ]);
    });

    test("does not mutate the input array", () => {
      const ids = ["FeedbackRecords.positiveCount", "FeedbackRecords.veryNegativeCount"];
      sortMeasureIdsForCategoryAxis(ids);
      expect(ids).toEqual(["FeedbackRecords.positiveCount", "FeedbackRecords.veryNegativeCount"]);
    });
  });

  describe("getMeasureAxisLabel", () => {
    const t = ((key: string) => key) as TFunction;

    test("labels sentiment count measures with their short value label", () => {
      expect(getMeasureAxisLabel("FeedbackRecords.veryPositiveCount", t)).toBe(
        "workspace.analysis.charts.sentiment_value_very_positive"
      );
      expect(getMeasureAxisLabel("FeedbackRecords.mixedCount", t)).toBe(
        "workspace.analysis.charts.sentiment_value_mixed"
      );
    });

    test("labels emotion count measures with their short value label", () => {
      expect(getMeasureAxisLabel("FeedbackRecords.joyCount", t)).toBe(
        "workspace.analysis.charts.emotion_value_joy"
      );
      expect(getMeasureAxisLabel("FeedbackRecords.disgustCount", t)).toBe(
        "workspace.analysis.charts.emotion_value_disgust"
      );
    });

    test("falls back to the full column header for other measures", () => {
      expect(getMeasureAxisLabel("FeedbackRecords.count", t)).toBe(
        "workspace.analysis.charts.field_label_count"
      );
      // promoterCount is an NPS measure, not a sentiment/emotion enum measure
      expect(getMeasureAxisLabel("FeedbackRecords.promoterCount", t)).toBe(
        "workspace.analysis.charts.field_label_promoter_count"
      );
      expect(getMeasureAxisLabel("Some.unknownKey", t)).toBe("Unknown Key");
    });
  });

  describe("isNotEnrichedDimensionValue", () => {
    test("true only for empty values on sentiment/emotions dimensions", () => {
      expect(isNotEnrichedDimensionValue("FeedbackRecords.sentiment", "")).toBe(true);
      expect(isNotEnrichedDimensionValue("FeedbackRecords.sentiment", null)).toBe(true);
      expect(isNotEnrichedDimensionValue("FeedbackRecords.emotions", "  ")).toBe(true);
      // populated enrichment value → enriched, not gray
      expect(isNotEnrichedDimensionValue("FeedbackRecords.sentiment", "positive")).toBe(false);
      // empty value on a non-enrichment dimension → not the "not enriched" bucket
      expect(isNotEnrichedDimensionValue("FeedbackRecords.sourceName", "")).toBe(false);
    });
  });

  describe("isEnrichmentDimensionId", () => {
    test("recognizes the sentiment and emotions dimensions only", () => {
      expect(isEnrichmentDimensionId("FeedbackRecords.sentiment")).toBe(true);
      expect(isEnrichmentDimensionId("FeedbackRecords.emotions")).toBe(true);
      expect(isEnrichmentDimensionId("FeedbackRecords.sentimentScore")).toBe(false);
      expect(isEnrichmentDimensionId("FeedbackRecords.sourceName")).toBe(false);
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
      "metadataSourceNormalized",
      "metadataBrowserNormalized",
      "metadataOsNormalized",
      "metadataDeviceNormalized",
      "metadataCountryNormalized",
      "metadataActionNormalized",
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
