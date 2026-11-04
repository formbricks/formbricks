import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { type TEmbeddedValueResponse, projectReservedValues } from "@formbricks/types/embedded-data-resolver";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  type TFilterValueRow,
  type TMetaFilterValueRow,
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

interface TRows {
  contact?: TFilterValueRow[];
  meta?: TMetaFilterValueRow[];
  data?: TFilterValueRow[];
  variables?: TFilterValueRow[];
}

/** Routes each tagged-template call to its rows by the table/column it reads. */
const mockRows = (rows: TRows) => {
  vi.mocked(prisma.$queryRaw).mockImplementation(((strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes(`r."contactAttributes"`)) return Promise.resolve(rows.contact ?? []);
    if (sql.includes("jsonb_typeof(r.meta)")) return Promise.resolve(rows.meta ?? []);
    if (sql.includes("r.data -> k.key")) return Promise.resolve(rows.data ?? []);
    if (sql.includes("r.variables -> k.key")) return Promise.resolve(rows.variables ?? []);
    throw new Error(`unexpected query: ${sql}`);
  }) as unknown as typeof prisma.$queryRaw);
};

const callFor = (fragment: string) =>
  vi
    .mocked(prisma.$queryRaw)
    .mock.calls.find(([strings]) =>
      (strings as unknown as TemplateStringsArray).join("?").includes(fragment)
    );

describe("getSurveyFilteringValues (ENG-3755)", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  test("queries distinct values scoped to the survey and passes keys as bound parameters", async () => {
    mockRows({});
    await getSurveyFilteringValues(asRead());

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    for (const [strings, ...values] of vi.mocked(prisma.$queryRaw).mock.calls) {
      const sql = (strings as unknown as TemplateStringsArray).join("?");
      expect(sql).toContain("DISTINCT");
      expect(sql).toContain(`WHERE r."surveyId" = ?`);
      expect(values).toContain("survey_1");
      // Survey-provided keys never reach the SQL text.
      expect(sql).not.toContain("campaign");
      expect(sql).not.toContain("var_plan");
    }

    const [, dataKeys] = callFor("r.data -> k.key")!;
    expect(dataKeys).toEqual(["campaign", "score"]);
    const [, variableKeys, , limit] = callFor("r.variables -> k.key")!;
    expect(variableKeys).toEqual(["var_plan"]);
    expect(limit).toBe(MAX_FILTER_VALUE_OPTIONS);
  });

  test("skips the data and variables queries when the survey declares no such fields", async () => {
    mockRows({});
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

  test("contact attributes: toString of each distinct value, grouped by key", async () => {
    mockRows({
      contact: [row("email", "a@x.test"), row("email", "b@x.test"), row("plan", "pro"), row("seats", 3)],
    });
    const { contactAttributes } = await getSurveyFilteringValues(asRead());

    expect(contactAttributes).toEqual({ email: ["a@x.test", "b@x.test"], plan: ["pro"], seats: ["3"] });
  });

  test("meta: nested objects flatten, url only registers its key, non-strings and empties are skipped", async () => {
    mockRows({
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
    const { meta } = await getSurveyFilteringValues(asRead());

    expect(meta).toEqual({
      country: ["DE"],
      // Unchanged behavior: meta has always returned the raw referrer; the reserved list redacts it.
      pageReferrer: ["https://r.test/a?x=1"],
      url: [],
      browser: ["Chrome"],
    });
  });

  test("reserved values: projected through the catalog, query strings redacted, numbers coerced", async () => {
    mockRows({
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
    const { reservedValues } = await getSurveyFilteringValues(asRead());

    expect(reservedValues.pageReferrer).toEqual(["https://r.test/a"]);
    expect(reservedValues.source).toEqual(["7", "link"]);
    // The DB keeps the separator, so a trailing space before `?` stays part of the path.
    expect(reservedValues.url).toEqual(["https://example.test/p%20", "https://example.test/p"]);
    expect(reservedValues.country).toBeUndefined();
    expect(reservedValues.browser).toEqual(["Chrome"]);
  });

  test("reserved values keep the anonymize gate", async () => {
    mockRows({ meta: [metaRow("country", "DE"), metaRow("utmSource", "ads")] });
    const { reservedValues } = await getSurveyFilteringValues(asRead({ isAnonymizeResponsesEnabled: true }));

    expect(reservedValues.country).toBeUndefined();
    expect(reservedValues.utmSource).toEqual(["ads"]);
  });

  test("reserved values stay capped at MAX_FILTER_VALUE_OPTIONS, keeping the first rows in query order", async () => {
    mockRows({
      meta: Array.from({ length: 60 }, (_, i) => metaRow("pagePath", `/p/${String(i).padStart(2, "0")}`)),
    });
    const { reservedValues } = await getSurveyFilteringValues(asRead());

    expect(reservedValues.pagePath).toHaveLength(MAX_FILTER_VALUE_OPTIONS);
    expect(reservedValues.pagePath[0]).toBe("/p/00");
    expect(reservedValues.pagePath.at(-1)).toBe("/p/49");
  });

  test("hidden fields: every declared key present, numbers stringified, empty strings skipped", async () => {
    mockRows({
      data: [row("campaign", ""), row("campaign", "spring"), row("score", 0), row("score", 42.5)],
    });
    const { hiddenFields } = await getSurveyFilteringValues(asRead());

    expect(hiddenFields).toEqual({ campaign: ["spring"], score: ["0", "42.5"] });
  });

  test("hidden fields: a declared key with no stored values still gets an empty list", async () => {
    mockRows({ data: [row("campaign", "spring")] });
    const { hiddenFields } = await getSurveyFilteringValues(asRead());

    expect(hiddenFields).toEqual({ campaign: ["spring"], score: [] });
  });

  test("variable values: string-typed computed fields only", async () => {
    mockRows({ variables: [row("var_plan", "gold"), row("var_plan", "silver"), row("var_points", "5")] });
    const { variableValues } = await getSurveyFilteringValues(asRead());

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
