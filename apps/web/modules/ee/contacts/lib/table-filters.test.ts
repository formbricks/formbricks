import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getContactFilterProperties, toContactListParams } from "./table-filters";

const t = ((key: string) => key) as unknown as TFunction;
const now = new Date("2026-10-26T10:00:00Z");

const key = (overrides: Partial<TContactAttributeKey>): TContactAttributeKey =>
  ({
    id: "k",
    key: "plan",
    name: "Plan",
    description: null,
    type: "custom",
    dataType: "string",
    isUnique: false,
    workspaceId: "w",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as TContactAttributeKey;

describe("getContactFilterProperties", () => {
  test("offers one property per attribute with operators by data type", () => {
    const properties = getContactFilterProperties(
      t,
      [
        key({}),
        key({ key: "seats", name: null, dataType: "number" }),
        key({ key: "renewal", dataType: "date" }),
      ],
      async () => []
    );
    expect(properties.map((p) => [p.id, p.valueType, Boolean(p.loadOptions)])).toEqual([
      ["createdAt", "date", false],
      ["attribute.plan", "string", true],
      ["attribute.seats", "number", true],
      ["attribute.renewal", "date", false],
    ]);
    expect(properties[2].label).toBe("seats");
  });
});

describe("toContactListParams", () => {
  test("maps quick values, rules, search and sort", () => {
    expect(
      toContactListParams(
        [
          { property: "attribute.plan", operator: "in", values: ["pro", "team"] },
          { property: "attribute.seats", operator: "greaterThan", values: ["5"] },
          { property: "attribute.email", operator: "isSet", values: [] },
        ],
        " acme ",
        "createdAt",
        "UTC",
        now
      )
    ).toEqual([
      ["filter[attribute.plan][in]", "pro"],
      ["filter[attribute.plan][in]", "team"],
      ["filter[attribute.seats][greaterThan]", "5"],
      ["filter[attribute.email][isSet]", "true"],
      ["search", "acme"],
      ["sortBy", "createdAt"],
    ]);
  });

  test("resolves dates to the tightest ISO bounds in the reporting time zone", () => {
    expect(
      toContactListParams(
        [
          { property: "createdAt", operator: "preset", values: ["last_30_days"] },
          { property: "createdAt", operator: "isAfter", values: ["2026-10-20"] },
        ],
        "",
        "bogus",
        "UTC",
        now
      )
    ).toEqual([
      ["filter[createdAt][gte]", "2026-10-21T00:00:00.000Z"],
      ["filter[createdAt][lte]", "2026-10-26T23:59:59.999Z"],
      ["sortBy", "-createdAt"],
    ]);
  });

  test("answers null for filters nothing can match", () => {
    expect(
      toContactListParams(
        [
          { property: "attribute.plan", operator: "equals", values: ["pro"] },
          { property: "attribute.plan", operator: "equals", values: ["team"] },
        ],
        "",
        "-createdAt",
        "UTC",
        now
      )
    ).toBeNull();
    expect(
      toContactListParams(
        [
          { property: "attribute.plan", operator: "in", values: ["pro"] },
          { property: "attribute.plan", operator: "in", values: ["team"] },
        ],
        "",
        "-createdAt",
        "UTC",
        now
      )
    ).toBeNull();
    expect(
      toContactListParams(
        [
          { property: "attribute.renewal", operator: "isAfter", values: ["2026-10-20"] },
          { property: "attribute.renewal", operator: "isBefore", values: ["2026-10-01"] },
        ],
        "",
        "-createdAt",
        "UTC",
        now
      )
    ).toBeNull();
  });
});

describe("toContactListParams — stacked rules on one attribute", () => {
  const params = (filters: Parameters<typeof toContactListParams>[0]) =>
    toContactListParams(filters, "", "-createdAt", "UTC", now);

  test("numeric bounds keep the tightest value, not the last one", () => {
    expect(
      params([
        { property: "attribute.seats", operator: "greaterThan", values: ["90"] },
        { property: "attribute.seats", operator: "greaterThan", values: ["3"] },
        { property: "attribute.seats", operator: "lessEqual", values: ["500"] },
        { property: "attribute.seats", operator: "lessEqual", values: ["200"] },
      ])
    ).toEqual([
      ["filter[attribute.seats][greaterThan]", "90"],
      ["filter[attribute.seats][lessEqual]", "200"],
      ["sortBy", "-createdAt"],
    ]);
  });

  test("date bounds keep the latest isAfter and the earliest isBefore", () => {
    expect(
      params([
        { property: "attribute.renewal", operator: "isAfter", values: ["2026-10-20"] },
        { property: "attribute.renewal", operator: "isAfter", values: ["2026-10-01"] },
        { property: "attribute.renewal", operator: "isBefore", values: ["2026-12-01"] },
        { property: "attribute.renewal", operator: "isBefore", values: ["2026-12-31"] },
      ])
    ).toEqual([
      ["filter[attribute.renewal][gte]", "2026-10-21T00:00:00.000Z"],
      ["filter[attribute.renewal][lte]", "2026-11-30T23:59:59.999Z"],
      ["sortBy", "-createdAt"],
    ]);
  });

  test("repeatable text rules send every value", () => {
    expect(
      params([
        { property: "attribute.plan", operator: "doesNotContain", values: ["trial"] },
        { property: "attribute.plan", operator: "doesNotContain", values: ["legacy"] },
        { property: "attribute.plan", operator: "doesNotContain", values: ["trial"] },
      ])
    ).toEqual([
      ["filter[attribute.plan][doesNotContain]", "trial"],
      ["filter[attribute.plan][doesNotContain]", "legacy"],
      ["sortBy", "-createdAt"],
    ]);
  });
});
