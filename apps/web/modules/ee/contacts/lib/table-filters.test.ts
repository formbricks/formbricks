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
