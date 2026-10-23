import { describe, expect, test } from "vitest";
import { HubQueryValueError, assertSerializableHubQuery } from "./hub-query-guard";

describe("assertSerializableHubQuery", () => {
  test("accepts scalars, non-empty arrays, an empty string, and absent values", () => {
    expect(() =>
      assertSerializableHubQuery({
        tenant_id: "dir_1",
        source_type: ["survey", "review"],
        source_id: "",
        value_number_min: 0,
        has_sentiment: false,
        cursor: undefined,
      })
    ).not.toThrow();
  });

  // The SDK omits an empty array, so `{ tenant_id, source_type: [] }` would list the whole tenant.
  test("rejects an empty array, naming the parameter", () => {
    expect(() => assertSerializableHubQuery({ tenant_id: "dir_1", source_type: [] })).toThrow(
      /"source_type" is an empty array/
    );
  });

  test.each([
    ["null, which the SDK would drop", null],
    ["a Date, which the SDK would send as bracketed keys", new Date(0)],
    ["a nested object", { gte: 1 }],
  ])("rejects %s", (_label, value) => {
    expect(() => assertSerializableHubQuery({ since: value })).toThrow(HubQueryValueError);
  });

  test.each([
    ["undefined", [undefined]],
    ["null", ["survey", null]],
    ["an object", [{ a: 1 }]],
  ])("rejects an array holding %s", (_label, value) => {
    expect(() => assertSerializableHubQuery({ source_type: value })).toThrow(/"source_type" holds/);
  });
});
