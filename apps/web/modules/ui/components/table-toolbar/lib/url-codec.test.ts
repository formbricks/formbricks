import { describe, expect, test } from "vitest";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import {
  TABLE_FILTER_OPERATORS,
  type TFilterProperty,
  type TRuleOperator,
  type TTableFilter,
  type TTableFilterOperator,
} from "./types";
import {
  buildTableSearchParams,
  datePresetFromSlug,
  datePresetToSlug,
  isCalendarDay,
  parseTableFilters,
  serializeTableFilters,
} from "./url-codec";

const properties: TFilterProperty[] = [
  {
    id: "status",
    label: "Status",
    valueType: "enum",
    quick: true,
    ruleOperators: ["equals", "notEquals"],
    options: [
      { value: "draft", label: "Draft" },
      { value: "inProgress", label: "In progress" },
      { value: "paused", label: "Paused" },
    ],
  },
  { id: "createdAt", label: "Created", valueType: "date", quick: true, ruleOperators: ["isBefore"] },
  { id: "score", label: "Score", valueType: "number", ruleOperators: ["greaterThan", "isSet"] },
  { id: "source", label: "Source", valueType: "enum", quick: true, loadOptions: async () => [] },
  {
    id: "archived",
    label: "Archived",
    valueType: "enum",
    hidden: true,
    options: [{ value: "true", label: "x" }],
  },
];

const parse = (query: string) => parseTableFilters(new URLSearchParams(query), properties);

const roundTrip = (filters: TTableFilter[]) => {
  const params = new URLSearchParams();
  for (const [key, value] of serializeTableFilters(filters)) params.append(key, value);
  return parseTableFilters(params, properties);
};

describe("parseTableFilters", () => {
  test("reads repeated keys as the values of one quick filter", () => {
    expect(parse("filter[status][in]=draft&filter[status][in]=inProgress")).toEqual([
      { property: "status", operator: "in", values: ["draft", "inProgress"] },
    ]);
  });

  test("drops unknown properties, operators a property does not take, and values outside its list", () => {
    expect(
      parse(
        "filter[nope][in]=x&filter[status][contains]=dr&filter[status][in]=bogus&filter[score][lessThan]=3"
      )
    ).toEqual([]);
  });

  test("drops a non-numeric value for a number rule", () => {
    expect(parse("filter[score][greaterThan]=abc")).toEqual([]);
    expect(parse("filter[score][greaterThan]=8")).toEqual([
      { property: "score", operator: "greaterThan", values: ["8"] },
    ]);
  });

  test("keeps any value for a property whose values are loaded on demand", () => {
    expect(parse("filter[source][in]=Acme%2C%20Inc")).toEqual([
      { property: "source", operator: "in", values: ["Acme, Inc"] },
    ]);
  });

  test("reads isSet without a value", () => {
    expect(parse("filter[score][isSet]=true")).toEqual([
      { property: "score", operator: "isSet", values: [] },
    ]);
  });

  test("joins gte and lte on a date quick filter into one range, ordered", () => {
    expect(parse("filter[createdAt][lte]=2026-10-01&filter[createdAt][gte]=2026-10-26")).toEqual([
      { property: "createdAt", operator: "between", values: ["2026-10-01", "2026-10-26"] },
    ]);
  });

  test("accepts a one-day range", () => {
    expect(parse("filter[createdAt][gte]=2026-10-05&filter[createdAt][lte]=2026-10-05")).toEqual([
      { property: "createdAt", operator: "between", values: ["2026-10-05", "2026-10-05"] },
    ]);
  });

  test("drops half a range and impossible days", () => {
    expect(parse("filter[createdAt][gte]=2026-10-01")).toEqual([]);
    expect(parse("filter[createdAt][gte]=2026-02-30&filter[createdAt][lte]=2026-03-01")).toEqual([]);
  });

  test("a preset wins over a range on the same property", () => {
    expect(
      parse(
        "filter[createdAt][preset]=last_7_days&filter[createdAt][gte]=2026-10-01&filter[createdAt][lte]=2026-10-02"
      )
    ).toEqual([{ property: "createdAt", operator: "preset", values: ["last_7_days"] }]);
  });

  test("drops an unknown preset", () => {
    expect(parse("filter[createdAt][preset]=last_8_days")).toEqual([]);
  });

  test("reads hidden view switches", () => {
    expect(parse("filter[archived][in]=true")).toEqual([
      { property: "archived", operator: "in", values: ["true"] },
    ]);
  });

  test("caps the values of one filter", () => {
    const query = Array.from({ length: 150 }, (_, i) => `filter[source][in]=v${i}`).join("&");
    expect(parse(query)[0].values).toHaveLength(100);
  });

  test("de-duplicates repeated values", () => {
    expect(parse("filter[status][in]=draft&filter[status][in]=draft")[0].values).toEqual(["draft"]);
  });
});

describe("serializeTableFilters", () => {
  test("round-trips every filter form", () => {
    const filters: TTableFilter[] = [
      { property: "status", operator: "in", values: ["draft", "inProgress"] },
      { property: "status", operator: "notEquals", values: ["draft"] },
      { property: "createdAt", operator: "between", values: ["2026-10-01", "2026-10-26"] },
      { property: "score", operator: "isSet", values: [] },
      { property: "score", operator: "greaterThan", values: ["8"] },
    ];
    expect(roundTrip(filters)).toEqual(expect.arrayContaining(filters));
    expect(roundTrip(filters)).toHaveLength(filters.length);
  });

  test("keeps several rules on one property and operator apart", () => {
    const filters: TTableFilter[] = [
      { property: "status", operator: "notEquals", values: ["draft"] },
      { property: "status", operator: "notEquals", values: ["inProgress"] },
      { property: "score", operator: "greaterThan", values: ["3"] },
      { property: "score", operator: "greaterThan", values: ["8"] },
    ];
    expect(roundTrip(filters)).toEqual(filters);
  });

  test("writes a range as gte and lte", () => {
    expect(
      serializeTableFilters([
        { property: "createdAt", operator: "between", values: ["2026-10-01", "2026-10-26"] },
      ])
    ).toEqual([
      ["filter[createdAt][gte]", "2026-10-01"],
      ["filter[createdAt][lte]", "2026-10-26"],
    ]);
  });
});

describe("buildTableSearchParams", () => {
  test("keeps unrelated params and replaces filters, search and sort", () => {
    const current = new URLSearchParams("tab=1&filter[status][in]=draft&search=old&sortBy=name");
    const next = buildTableSearchParams(current, {
      filters: [{ property: "status", operator: "in", values: ["inProgress"] }],
      search: "  new  ",
      sortBy: null,
    });
    expect(next.toString()).toBe("tab=1&filter%5Bstatus%5D%5Bin%5D=inProgress&search=new");
  });
});

describe("date presets and calendar days", () => {
  test("presets survive the slug round trip", () => {
    expect(datePresetFromSlug(datePresetToSlug("last 7 days"))).toBe("last 7 days");
    expect(datePresetFromSlug("bogus")).toBeNull();
  });

  test("isCalendarDay accepts real days only", () => {
    expect(isCalendarDay("2024-02-29")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2026-1-1")).toBe(false);
  });
});

describe("every operator round-trips through the URL", () => {
  const ruleOperators = TABLE_FILTER_OPERATORS.filter(
    (operator): operator is TRuleOperator =>
      !["in", "preset", "between", "isBefore", "isAfter"].includes(operator)
  );
  const allProperties: TFilterProperty[] = [
    {
      id: "text",
      label: "Text",
      valueType: "string",
      quick: true,
      loadOptions: async () => [],
      ruleOperators,
    },
    {
      id: "day",
      label: "Day",
      valueType: "date",
      quick: true,
      ruleOperators: ["isBefore", "isAfter", "isSet", "isNotSet"],
      datePresets: DATE_RANGE_PRESETS,
    },
  ];

  const sample = (operator: TTableFilterOperator): TTableFilter => {
    switch (operator) {
      case "preset":
        return { property: "day", operator, values: [datePresetToSlug(DATE_RANGE_PRESETS[0])] };
      case "between":
        return { property: "day", operator, values: ["2026-01-01", "2026-01-31"] };
      case "isBefore":
      case "isAfter":
        return { property: "day", operator, values: ["2026-01-15"] };
      case "isSet":
      case "isNotSet":
        return { property: "text", operator, values: [] };
      case "in":
      case "includesOneOf":
      case "includesAllOf":
        return { property: "text", operator, values: ["a", "b, c"] };
      default:
        return { property: "text", operator, values: ["42"] };
    }
  };

  test.each([...TABLE_FILTER_OPERATORS])("%s", (operator) => {
    const filter = sample(operator);
    const params = new URLSearchParams();
    for (const [key, value] of serializeTableFilters([filter])) params.append(key, value);
    expect(parseTableFilters(params, allProperties)).toEqual([filter]);
  });

  test("value-less operators also round-trip on a date property", () => {
    for (const operator of ["isSet", "isNotSet"] as const) {
      const filter: TTableFilter = { property: "day", operator, values: [] };
      const params = new URLSearchParams();
      for (const [key, value] of serializeTableFilters([filter])) params.append(key, value);
      expect(parseTableFilters(params, allProperties)).toEqual([filter]);
    }
  });
});

describe("a link that ticks every value", () => {
  test("keeps it as ticked, like the menu does", () => {
    expect(parse("filter[status][in]=draft&filter[status][in]=inProgress&filter[status][in]=paused")).toEqual(
      [{ property: "status", operator: "in", values: ["draft", "inProgress", "paused"] }]
    );
  });
});
