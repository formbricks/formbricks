import { describe, expect, test } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { findUnmappableCsvColumns, matchCsvColumnsToAttributeKeys } from "./csv-attribute-mapping";

const attributeKey = (id: string, key: string, name: string | null = null) =>
  ({ id, key, name }) as TContactAttributeKey;

const keys = [attributeKey("key-email", "email", "Email"), attributeKey("key-user-id", "userId", "User Id")];

describe("matchCsvColumnsToAttributeKeys", () => {
  test("maps a column to the first attribute key whose name or key it matches, ignoring case and separators", () => {
    expect(matchCsvColumnsToAttributeKeys(["EMAIL", "user_id"], keys)).toEqual({
      EMAIL: "key-email",
      user_id: "key-user-id",
    });
  });

  test("falls back to the attribute key when it has no name", () => {
    expect(matchCsvColumnsToAttributeKeys(["plan"], [attributeKey("key-plan", "plan")])).toEqual({
      plan: "key-plan",
    });
  });

  test("maps an unmatched column to its own name, to be created as a new attribute", () => {
    expect(matchCsvColumnsToAttributeKeys(["company"], keys)).toEqual({ company: "company" });
  });

  test("returns an empty map without columns", () => {
    expect(matchCsvColumnsToAttributeKeys([], keys)).toEqual({});
  });
});

describe("findUnmappableCsvColumns", () => {
  test("accepts columns mapped to existing attribute keys or to valid new keys", () => {
    expect(
      findUnmappableCsvColumns(["Email", "company"], { Email: "key-email", company: "company" }, keys)
    ).toEqual({ invalidColumns: [], reservedColumns: [] });
  });

  test("reports a column whose new key is not a safe identifier", () => {
    expect(findUnmappableCsvColumns(["Company Name"], { "Company Name": "Company Name" }, keys)).toEqual({
      invalidColumns: ["Company Name"],
      reservedColumns: [],
    });
  });

  test("reports a column whose new key is reserved for the default-attribute migration", () => {
    expect(findUnmappableCsvColumns(["first_name"], { first_name: "first_name" }, keys)).toEqual({
      invalidColumns: [],
      reservedColumns: ["first_name"],
    });
  });

  test("skips columns with no mapping", () => {
    expect(findUnmappableCsvColumns(["unmapped"], {}, keys)).toEqual({
      invalidColumns: [],
      reservedColumns: [],
    });
  });
});
