import { describe, expect, test } from "vitest";
import {
  buildAttributeFilterCondition,
  buildV3ContactsCursorWhere,
  buildV3ContactsOrderBy,
  buildV3ContactsWhere,
} from "./contacts-where";
import type { TV3ContactAttributeFilter } from "./parse-v3-contacts-list-query";

const workspaceId = "clws0000000000000000000001";
const attributeKeyId = "clak0000000000000000000001";

const str = (operator: string, values: string[] = ["Pro"]) =>
  ({ key: "plan", attributeKeyId, dataType: "string", operator, values }) as TV3ContactAttributeFilter;
const num = (operator: string, values: number[] = [5]) =>
  ({ key: "seats", attributeKeyId, dataType: "number", operator, values }) as TV3ContactAttributeFilter;
const date = (operator: string, values: Date[] = [new Date("2026-01-01T00:00:00.000Z")]) =>
  ({ key: "renewal", attributeKeyId, dataType: "date", operator, values }) as TV3ContactAttributeFilter;

const some = (condition: object) => ({ attributes: { some: { attributeKeyId, ...condition } } });

describe("buildAttributeFilterCondition — string", () => {
  test.each([
    ["in", str("in", ["Pro", "Team"]), some({ value: { in: ["Pro", "Team"], mode: "insensitive" } })],
    ["equals", str("equals"), some({ value: { equals: "Pro", mode: "insensitive" } })],
    [
      "notEquals",
      str("notEquals"),
      some({ AND: [{ value: { not: "" } }, { NOT: { value: { equals: "Pro", mode: "insensitive" } } }] }),
    ],
    ["contains", str("contains"), some({ value: { contains: "Pro", mode: "insensitive" } })],
    [
      "doesNotContain",
      str("doesNotContain"),
      some({ AND: [{ value: { not: "" } }, { NOT: { value: { contains: "Pro", mode: "insensitive" } } }] }),
    ],
    ["startsWith", str("startsWith"), some({ value: { startsWith: "Pro", mode: "insensitive" } })],
    ["endsWith", str("endsWith"), some({ value: { endsWith: "Pro", mode: "insensitive" } })],
    ["isSet", str("isSet", []), some({ value: { not: "" } })],
    ["isNotSet", str("isNotSet", []), { attributes: { none: { attributeKeyId, value: { not: "" } } } }],
  ])("%s", (_label, filter, expected) => {
    expect(buildAttributeFilterCondition(filter)).toEqual(expected);
  });

  test("ANDs one condition per value of a repeated operator", () => {
    expect(buildAttributeFilterCondition(str("contains", ["a", "b"]))).toEqual({
      AND: [
        some({ value: { contains: "a", mode: "insensitive" } }),
        some({ value: { contains: "b", mode: "insensitive" } }),
      ],
    });
  });

  test("escapes LIKE wildcards in pattern operators", () => {
    expect(buildAttributeFilterCondition(str("contains", ["50%_off"]))).toEqual(
      some({ value: { contains: String.raw`50\%\_off`, mode: "insensitive" } })
    );
  });
});

describe("buildAttributeFilterCondition — number", () => {
  test.each([
    ["in", num("in", [1, 2]), some({ valueNumber: { in: [1, 2] } })],
    ["equals", num("equals"), some({ valueNumber: { equals: 5 } })],
    [
      "notEquals",
      num("notEquals"),
      some({ AND: [{ valueNumber: { not: null } }, { NOT: { valueNumber: { equals: 5 } } }] }),
    ],
    ["greaterThan", num("greaterThan"), some({ valueNumber: { gt: 5 } })],
    ["greaterEqual", num("greaterEqual"), some({ valueNumber: { gte: 5 } })],
    ["lessThan", num("lessThan"), some({ valueNumber: { lt: 5 } })],
    ["lessEqual", num("lessEqual"), some({ valueNumber: { lte: 5 } })],
    ["isSet", num("isSet", []), some({ valueNumber: { not: null } })],
    [
      "isNotSet",
      num("isNotSet", []),
      { attributes: { none: { attributeKeyId, valueNumber: { not: null } } } },
    ],
  ])("%s", (_label, filter, expected) => {
    expect(buildAttributeFilterCondition(filter)).toEqual(expected);
  });
});

describe("buildAttributeFilterCondition — date", () => {
  const value = new Date("2026-01-01T00:00:00.000Z");
  test.each([
    ["gte", date("gte"), some({ valueDate: { gte: value } })],
    ["lte", date("lte"), some({ valueDate: { lte: value } })],
    ["isSet", date("isSet", []), some({ valueDate: { not: null } })],
    [
      "isNotSet",
      date("isNotSet", []),
      { attributes: { none: { attributeKeyId, valueDate: { not: null } } } },
    ],
  ])("%s", (_label, filter, expected) => {
    expect(buildAttributeFilterCondition(filter)).toEqual(expected);
  });
});

describe("buildV3ContactsWhere", () => {
  test("is the workspace scope alone without filters", () => {
    expect(buildV3ContactsWhere({ workspaceId, filters: [] })).toEqual({ workspaceId });
  });

  test("keeps today's search semantics and ANDs every filter under the workspace scope", () => {
    const createdAtGte = new Date("2026-01-01T00:00:00.000Z");
    const where = buildV3ContactsWhere({
      workspaceId,
      search: "ada",
      createdAtGte,
      filters: [str("equals"), num("greaterThan")],
    });

    expect(where).toEqual({
      workspaceId,
      OR: [
        { attributes: { some: { value: { contains: "ada", mode: "insensitive" } } } },
        { id: { contains: "ada", mode: "insensitive" } },
      ],
      AND: [
        some({ value: { equals: "Pro", mode: "insensitive" } }),
        some({ valueNumber: { gt: 5 } }),
        { createdAt: { gte: createdAtGte } },
      ],
    });
  });

  test("escapes LIKE wildcards in the search so `%` does not match every contact", () => {
    const where = buildV3ContactsWhere({ workspaceId, search: "50%_off", filters: [] });

    expect(where.OR).toEqual([
      { attributes: { some: { value: { contains: String.raw`50\%\_off`, mode: "insensitive" } } } },
      { id: { contains: String.raw`50\%\_off`, mode: "insensitive" } },
    ]);
  });
});

describe("keyset helpers", () => {
  const cursor = { value: "2026-01-01T00:00:00.000Z", id: "clct0000000000000000000001" };
  const at = new Date(cursor.value);

  test("newest-first walks backwards on (createdAt, id)", () => {
    expect(buildV3ContactsOrderBy("-createdAt")).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(buildV3ContactsCursorWhere(cursor, "-createdAt")).toEqual({
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }],
    });
  });

  test("oldest-first walks forwards on (createdAt, id)", () => {
    expect(buildV3ContactsOrderBy("createdAt")).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(buildV3ContactsCursorWhere(cursor, "createdAt")).toEqual({
      OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: cursor.id } }],
    });
  });
});
