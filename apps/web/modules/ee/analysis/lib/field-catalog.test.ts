import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { ZV3ChartField } from "@/app/api/v3/charts/lib/resources";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { ANSWER_MEMBER } from "./answer-filter";
import {
  CHART_DATE_PRESETS,
  CHART_FIELD_CATALOG,
  FILTER_ONLY_FIELDS,
  TOPIC_CHART_FIELDS,
  createChartFieldLookup,
  getChartField,
  getChartFieldCatalog,
  isFilterOnlyField,
  queryNamesTopicField,
} from "./field-catalog";

/** Every member the Cube model defines, read off the schema file the Cube image serves. */
const cubeSchema = readFileSync(
  resolve(process.cwd(), "../../docker/cube/schema/FeedbackRecords.js"),
  "utf8"
);
const cubeMembers = [...cubeSchema.matchAll(/^ {6}(\w+): \{$/gm)].map(
  (match) => `FeedbackRecords.${match[1]}`
);

describe("field catalog (ENG-6584)", () => {
  test("lists no hidden member: not the tenant id, not the internal record id, no normalized companion", () => {
    const names = CHART_FIELD_CATALOG.map((field) => field.name);

    expect(names).not.toContain("FeedbackRecords.tenantId");
    expect(names).not.toContain("FeedbackRecords.id");
    expect(names.filter((name) => name.endsWith("Normalized"))).toEqual([]);
    // The Cube model really does define them, so this asserts a choice rather than an absence.
    expect(cubeMembers).toEqual(
      expect.arrayContaining([
        "FeedbackRecords.tenantId",
        "FeedbackRecords.id",
        "FeedbackRecords.valueTextNormalized",
      ])
    );
  });

  test("lists only members the Cube model defines, each once, besides the virtual answer filter", () => {
    const names = CHART_FIELD_CATALOG.map((field) => field.name);

    // The answer filter is no column: Cube's queryRewrite expands it before the model is read.
    expect(names.filter((name) => !cubeMembers.includes(name))).toEqual([ANSWER_MEMBER]);
    expect(cubeMembers).not.toContain(ANSWER_MEMBER);
    expect(new Set(names).size).toBe(names.length);
  });

  test("names every field with its data-source prefix and classifies time dimensions", () => {
    expect(CHART_FIELD_CATALOG.every((field) => field.name.startsWith("FeedbackRecords."))).toBe(true);
    expect(getChartField("FeedbackRecords.collectedAt")).toMatchObject({
      kind: "timeDimension",
      type: "time",
      granularities: expect.arrayContaining(["day", "month"]),
    });
    expect(getChartField("FeedbackRecords.npsScore")).toMatchObject({ kind: "measure", type: "number" });
    expect(getChartField("FeedbackRecords.sourceName")).toMatchObject({
      kind: "dimension",
      valueLookup: true,
    });
    expect(getChartField("FeedbackRecords.valueText")).toMatchObject({ valueLookup: false });
  });

  test("offers the app's presets plus all-time as date ranges", () => {
    expect(CHART_DATE_PRESETS).toEqual([...DATE_RANGE_PRESETS, "all-time"]);
  });

  test("lists the answer filter as a filter-only field with equals and notEquals (ENG-6894)", () => {
    expect(getChartField(ANSWER_MEMBER)).toMatchObject({
      kind: "dimension",
      type: "string",
      filterOperators: ["equals", "notEquals"],
      valueLookup: false,
    });
    expect(FILTER_ONLY_FIELDS.has(ANSWER_MEMBER)).toBe(true);
  });
});

describe("a dataset's field catalog (ENG-6893)", () => {
  const dataset = {
    embeddedFields: [
      { name: "FeedbackRecords.ed_plan_64879f7d", key: "plan" },
      { name: "FeedbackRecords.ed_0a1b2c3d", key: "区域" },
    ],
  };

  test("is the shared catalog for a dataset without embedded data", () => {
    expect(getChartFieldCatalog()).toEqual(CHART_FIELD_CATALOG);
    expect(getChartFieldCatalog({ embeddedFields: [] })).toEqual(CHART_FIELD_CATALOG);
  });

  test("adds each embedded-data key as a string dimension labelled with the key", () => {
    const catalog = getChartFieldCatalog(dataset);

    expect(catalog.slice(CHART_FIELD_CATALOG.length)).toEqual([
      expect.objectContaining({
        name: "FeedbackRecords.ed_plan_64879f7d",
        label: "plan",
        kind: "dimension",
        type: "string",
        valueLookup: true,
      }),
      expect.objectContaining({ name: "FeedbackRecords.ed_0a1b2c3d", label: "区域" }),
    ]);
    expect(catalog[CHART_FIELD_CATALOG.length].filterOperators).toEqual(
      getChartField("FeedbackRecords.sourceName")?.filterOperators
    );
  });

  test("names each embedded field's key as its own property, not only as its label (C16)", () => {
    const catalog = getChartFieldCatalog(dataset);

    expect(catalog.slice(CHART_FIELD_CATALOG.length).map((field) => field.key)).toEqual(["plan", "区域"]);
    // Every other field has no key.
    expect(CHART_FIELD_CATALOG.every((field) => field.key === undefined)).toBe(true);
    // The public catalog schema carries it.
    expect(ZV3ChartField.parse(catalog[CHART_FIELD_CATALOG.length]).key).toBe("plan");
  });

  test("finds a dataset's embedded field's numeric twin, a filter-only number", () => {
    const twin = createChartFieldLookup(dataset)("FeedbackRecords.edn_plan_64879f7d");
    expect(twin).toMatchObject({ type: "number", key: "plan", valueLookup: false });
    expect(twin?.filterOperators).toContain("gt");
    expect(isFilterOnlyField("FeedbackRecords.edn_plan_64879f7d")).toBe(true);
    expect(isFilterOnlyField("FeedbackRecords.ed_plan_64879f7d")).toBe(false);
    expect(createChartFieldLookup()("FeedbackRecords.edn_plan_64879f7d")).toBeUndefined();
  });

  test("finds a dataset's embedded field only in that dataset", () => {
    expect(createChartFieldLookup(dataset)("FeedbackRecords.ed_plan_64879f7d")?.label).toBe("plan");
    expect(createChartFieldLookup(dataset)("FeedbackRecords.npsScore")?.kind).toBe("measure");
    expect(createChartFieldLookup()("FeedbackRecords.ed_plan_64879f7d")).toBeUndefined();
    expect(
      createChartFieldLookup({ embeddedFields: [] })("FeedbackRecords.ed_plan_64879f7d")
    ).toBeUndefined();
  });
});

describe("topic fields (ENG-6989)", () => {
  const TOPIC_NAMES = [
    "FeedbackRecords.topic",
    "FeedbackRecords.subtopic",
    "FeedbackRecords.responseTopic",
    "FeedbackRecords.responseSubtopic",
  ];
  const active = {
    embeddedFields: [],
    topics: { status: "active" as const, labels: { topics: ["Billing"], subtopics: ["Billing › Refunds"] } },
  };

  test("are members the Cube model defines, and not in the catalog every dataset gets", () => {
    expect(TOPIC_CHART_FIELDS.map((field) => field.name)).toEqual(TOPIC_NAMES);
    expect(TOPIC_NAMES.filter((name) => !cubeMembers.includes(name))).toEqual([]);
    expect(CHART_FIELD_CATALOG.map((field) => field.name)).not.toEqual(
      expect.arrayContaining([TOPIC_NAMES[0]])
    );
  });

  test("are listed only for a dataset with an active taxonomy", () => {
    const listed = (dataset?: Parameters<typeof getChartFieldCatalog>[0]) =>
      getChartFieldCatalog(dataset)
        .map((field) => field.name)
        .filter((name) => TOPIC_NAMES.includes(name));

    expect(listed(active)).toEqual(TOPIC_NAMES);
    expect(listed()).toEqual([]);
    expect(listed({ embeddedFields: [] })).toEqual([]);
    for (const status of ["inactive", "forbidden", "unavailable"] as const) {
      expect(listed({ embeddedFields: [], topics: { status } })).toEqual([]);
    }
  });

  test("resolve on any dataset, so a saved chart keeps validating once its taxonomy is gone", () => {
    for (const name of TOPIC_NAMES) {
      expect(getChartField(name)).toMatchObject({ kind: "dimension", type: "string", valueLookup: true });
      expect(createChartFieldLookup()(name)?.name).toBe(name);
      expect(
        createChartFieldLookup({
          embeddedFields: [{ name: "FeedbackRecords.ed_plan_64879f7d", key: "plan" }],
        })(name)?.name
      ).toBe(name);
    }
  });

  test("take every string operator on the record's own topic, but only exact ones on the response's", () => {
    expect(getChartField("FeedbackRecords.topic")?.filterOperators).toContain("notEquals");
    expect(getChartField("FeedbackRecords.subtopic")?.filterOperators).toContain("contains");
    expect(getChartField("FeedbackRecords.responseTopic")?.filterOperators).toEqual([
      "equals",
      "set",
      "notSet",
    ]);
    expect(getChartField("FeedbackRecords.responseSubtopic")?.filterOperators).toEqual([
      "equals",
      "set",
      "notSet",
    ]);
  });

  test("fit the public catalog schema", () => {
    for (const field of TOPIC_CHART_FIELDS) {
      expect(() =>
        ZV3ChartField.parse({ ...field, filterOperators: [...field.filterOperators], granularities: [] })
      ).not.toThrow();
    }
  });

  test("are found wherever a query names one, and only there", () => {
    expect(
      queryNamesTopicField({ measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.topic"] })
    ).toBe(true);
    expect(
      queryNamesTopicField({
        measures: ["FeedbackRecords.npsScore"],
        filters: [{ or: [{ member: "FeedbackRecords.responseSubtopic", operator: "set" }] }],
      })
    ).toBe(true);
    expect(
      queryNamesTopicField({
        measures: ["FeedbackRecords.count"],
        order: { "FeedbackRecords.subtopic": "asc" },
      })
    ).toBe(true);
    // A filter value that looks like a member is a value, not a member.
    expect(
      queryNamesTopicField({
        measures: ["FeedbackRecords.count"],
        filters: [
          { member: "FeedbackRecords.sourceName", operator: "equals", values: ["FeedbackRecords.topic"] },
        ],
      })
    ).toBe(false);
    expect(queryNamesTopicField(null)).toBe(false);
  });
});
