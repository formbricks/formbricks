import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { type TEmbeddedValueResponse, projectReservedValues } from "@formbricks/types/embedded-data-resolver";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  type TFilterValueRow,
  type TFilterValueRows,
  type TMetaFilterValueRow,
  type TNotShownFilterRow,
  buildFilteringValues,
  getRecordedNotShown,
  getSurveyFilteringValues,
  metaRowsToSlices,
  toReservedProjectionSlice,
} from "./filtering-values";
import { MAX_FILTER_VALUE_OPTIONS, getReservedFilterEntries } from "./utils";

vi.mock("@formbricks/database", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

const survey = {
  id: "survey_1",
  name: "Filter values",
  blocks: [],
  questions: [],
  type: "link",
  status: "inProgress",
  workspaceId: "ws_1",
  createdBy: "u_1",
  createdAt: new Date(),
  updatedAt: new Date(),
  isCaptureIpEnabled: true,
  hiddenFields: { enabled: true, fieldIds: ["campaign", "score"] },
  variables: [
    { id: "var_plan", name: "plan_name", type: "text" as const, value: "" },
    { id: "var_points", name: "points", type: "number" as const, value: 0 },
  ],
};
const asRead = (over: Partial<TSurvey> = {}): TSurvey =>
  ({
    ...survey,
    ...over,
    embeddedFields: embeddedFieldsFromLegacyInput({ ...survey, ...over } as Partial<TSurvey>),
  }) as unknown as TSurvey;

/** jsonb `value::text` as Postgres renders it. */
const json = (value: unknown): string => JSON.stringify(value);
const row = (key: string, value: unknown): TFilterValueRow => ({ key, value: json(value) });
const metaRow = (key: string, value: unknown, nestedKey: string | null = null): TMetaFilterValueRow => ({
  key,
  nestedKey,
  value: json(value),
});

/** Rows for `buildFilteringValues`; a query left out returned nothing. */
const build = (rows: Partial<TFilterValueRows>, surveyOver: Partial<TSurvey> = {}) =>
  buildFilteringValues(asRead(surveyOver), {
    contactAttributes: [],
    meta: [],
    data: [],
    variables: [],
    ...rows,
  });

/** The `$queryRaw` call that bound exactly this key list. */
const callBinding = (keys: string[]) =>
  vi
    .mocked(prisma.$queryRaw)
    .mock.calls.find(([, ...values]) =>
      values.some((value) => JSON.stringify(value) === JSON.stringify(keys))
    );

describe("getSurveyFilteringValues (ENG-3755)", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  });

  test("queries distinct values scoped to the survey and passes keys as bound parameters", async () => {
    await getSurveyFilteringValues(asRead());

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    for (const [strings, ...values] of vi.mocked(prisma.$queryRaw).mock.calls) {
      const sql = (strings as unknown as TemplateStringsArray).join("?");
      expect(values).toContain("survey_1");
      // Survey-provided keys never reach the SQL text.
      expect(sql).not.toContain("campaign");
      expect(sql).not.toContain("var_plan");
    }

    expect(callBinding(["campaign", "score"])).toBeDefined();
    expect(callBinding(["var_plan"])).toContain(MAX_FILTER_VALUE_OPTIONS);
  });

  test("skips the data and variables queries when the survey declares no such fields", async () => {
    const result = await getSurveyFilteringValues(
      asRead({ hiddenFields: { enabled: true, fieldIds: [] }, variables: [] })
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      contactAttributes: {},
      meta: {},
      hiddenFields: {},
      reservedValues: {},
      variableValues: {},
    });
  });
});

describe("getRecordedNotShown (ENG-6951)", () => {
  const flowSurvey = {
    id: "survey_1",
    blocks: [
      {
        id: "block_1",
        elements: [
          { id: "fav", type: "multipleChoiceSingle", choices: [{ id: "a" }, { id: "b" }] },
          { id: "grid", type: "matrix", rows: [{ id: "r1" }], columns: [{ id: "c1" }] },
        ],
      },
    ],
  } as unknown as TSurvey;

  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  test("binds the survey and every id it holds as parameters, never as SQL text", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    await getRecordedNotShown(flowSurvey);

    const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0];
    const sql = (strings as unknown as TemplateStringsArray).join("?");
    expect(values).toContain("survey_1");
    expect(values).toContainEqual(["block_1"]);
    expect(values).toContainEqual(["fav", "grid"]);
    expect(values).toContainEqual(["options", "options", "rows", "columns"]);
    expect(values).toContainEqual(["a", "b", "r1", "c1"]);
    expect(sql).not.toMatch(/block_1|fav|grid/);
  });

  test("folds the rows into one record", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { list: "blocks", elementId: null, id: "block_1" },
      { list: "elements", elementId: null, id: "fav" },
      { list: "options", elementId: "fav", id: "a" },
      { list: "options", elementId: "fav", id: "b" },
      { list: "columns", elementId: "grid", id: "c1" },
    ] satisfies TNotShownFilterRow[]);

    expect(await getRecordedNotShown(flowSurvey)).toEqual({
      blocks: ["block_1"],
      elements: ["fav"],
      options: { fav: ["a", "b"] },
      columns: { grid: ["c1"] },
    });
  });
});

describe("buildFilteringValues (ENG-3755)", () => {
  test("contact attributes: toString of each distinct value, grouped by key", () => {
    const { contactAttributes } = build({
      contactAttributes: [
        row("email", "a@x.test"),
        row("email", "b@x.test"),
        row("plan", "pro"),
        row("seats", 3),
      ],
    });

    expect(contactAttributes).toEqual({ email: ["a@x.test", "b@x.test"], plan: ["pro"], seats: ["3"] });
  });

  test("meta: nested objects flatten, url only registers its key, non-strings and empties are skipped", () => {
    const { meta } = build({
      meta: [
        metaRow("country", ""),
        metaRow("country", "DE"),
        metaRow("pageReferrer", "https://r.test/a?x=1"),
        metaRow("screenWidth", 1280),
        metaRow("url", "https://x.test/p?"),
        metaRow("url", null),
        metaRow("userAgent", "Chrome", "browser"),
        metaRow("userAgent", "", "device"),
        metaRow("userAgent", 5, "os"),
      ],
    });

    expect(meta).toEqual({
      country: ["DE"],
      // Unchanged behavior: meta has always returned the raw referrer; the reserved list redacts it.
      pageReferrer: ["https://r.test/a?x=1"],
      url: [],
      browser: ["Chrome"],
    });
  });

  test("reserved values: projected through the catalog, query strings redacted, numbers coerced", () => {
    const { reservedValues } = build({
      meta: [
        metaRow("pageReferrer", "https://r.test/a?x=1"),
        metaRow("pageReferrer", "https://r.test/a?x=2"),
        metaRow("source", 7),
        metaRow("source", "link"),
        metaRow("url", "https://Example.test:443/p ?"),
        metaRow("url", "https://example.test/p?"),
        metaRow("url", null),
        metaRow("country", ""),
        metaRow("userAgent", "Chrome", "browser"),
      ],
    });

    expect(reservedValues.pageReferrer).toEqual(["https://r.test/a"]);
    expect(reservedValues.source).toEqual(["7", "link"]);
    // The DB keeps the separator, so a trailing space before `?` stays part of the path.
    expect(reservedValues.url).toEqual(["https://example.test/p%20", "https://example.test/p"]);
    expect(reservedValues.country).toBeUndefined();
    expect(reservedValues.browser).toEqual(["Chrome"]);
  });

  test("reserved values keep the anonymize gate", () => {
    const { reservedValues } = build(
      { meta: [metaRow("country", "DE"), metaRow("utmSource", "ads")] },
      { isAnonymizeResponsesEnabled: true }
    );

    expect(reservedValues.country).toBeUndefined();
    expect(reservedValues.utmSource).toEqual(["ads"]);
  });

  test("reserved values stay capped at MAX_FILTER_VALUE_OPTIONS, keeping the first rows in query order", () => {
    const { reservedValues } = build({
      meta: Array.from({ length: 60 }, (_, i) => metaRow("pagePath", `/p/${String(i).padStart(2, "0")}`)),
    });

    expect(reservedValues.pagePath).toHaveLength(MAX_FILTER_VALUE_OPTIONS);
    expect(reservedValues.pagePath[0]).toBe("/p/00");
    expect(reservedValues.pagePath.at(-1)).toBe("/p/49");
  });

  test("hidden fields: every declared key present, numbers stringified, empty strings skipped", () => {
    const { hiddenFields } = build({
      data: [row("campaign", ""), row("campaign", "spring"), row("score", 0), row("score", 42.5)],
    });

    expect(hiddenFields).toEqual({ campaign: ["spring"], score: ["0", "42.5"] });
  });

  test("hidden fields: a declared key with no stored values still gets an empty list", () => {
    const { hiddenFields } = build({ data: [row("campaign", "spring")] });

    expect(hiddenFields).toEqual({ campaign: ["spring"], score: [] });
  });

  test("variable values: string-typed computed fields only", () => {
    const { variableValues } = build({
      variables: [row("var_plan", "gold"), row("var_plan", "silver"), row("var_points", "5")],
    });

    expect(variableValues).toEqual({ var_plan: ["gold", "silver"] });
  });
});

describe("one-path reserved projection (guard)", () => {
  // getSurveyFilteringValues projects each distinct meta value on its own. That equals projecting the
  // full response only while every string-typed reserved filter entry reads a single meta path. An
  // entry that reads `data`, `language`, or combines two paths turns this red.
  test("projecting meta one path at a time matches projecting the whole response", () => {
    const entries = getReservedFilterEntries(asRead()).filter((entry) => entry.dataType === "string");
    const meta = {
      source: "link",
      url: "https://x.test/p?token=1",
      country: "DE",
      action: "click",
      ipAddress: "10.0.0.1",
      pagePath: "/p",
      pageReferrer: "https://r.test/?q=1",
      utmSource: "a",
      utmMedium: "b",
      utmCampaign: "c",
      utmTerm: "d",
      utmContent: "e",
      timezone: "Europe/Berlin",
      locale: "de-DE",
      visitEntryReferrer: "https://v.test/?q",
      visitUrls: "/a|/b",
      openedByCreativeId: "cr_1",
      openedByCreativeName: "Banner",
      userAgent: { browser: "Chrome", os: "Mac OS", device: "desktop" },
    };
    const full: TEmbeddedValueResponse = {
      id: "r_1",
      surveyId: "survey_1",
      createdAt: new Date(),
      updatedAt: new Date(),
      finished: true,
      language: "de",
      data: { anything: "x" },
      variables: { anything: "y" },
      ttc: { _total: 1000 },
      meta,
    };

    const rows: TMetaFilterValueRow[] = Object.entries(meta).flatMap(([key, value]) =>
      typeof value === "object"
        ? Object.entries(value).map(([nestedKey, nested]) => metaRow(key, nested, nestedKey))
        : [metaRow(key, value)]
    );
    const onePath = Object.assign(
      {},
      ...metaRowsToSlices(rows).map((slice) =>
        projectReservedValues(entries, toReservedProjectionSlice("survey_1", slice))
      )
    );

    expect(onePath).toEqual(projectReservedValues(entries, full));
    expect(Object.keys(onePath).sort()).toEqual(entries.map((entry) => entry.name).sort());
  });
});
