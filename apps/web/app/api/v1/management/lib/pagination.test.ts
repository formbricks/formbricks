import { describe, expect, test } from "vitest";
import { ValidationError } from "@formbricks/types/errors";
import { V1_MANAGEMENT_MAX_LIMIT, parseV1Pagination } from "./pagination";

const parse = (query: string, options?: Parameters<typeof parseV1Pagination>[1]) =>
  parseV1Pagination(new URLSearchParams(query), options);

describe("parseV1Pagination", () => {
  test("bounds a request that sends no pagination parameters", () => {
    expect(parse("")).toEqual({ limit: V1_MANAGEMENT_MAX_LIMIT, offset: 0 });
  });

  test("uses the endpoint's default page size when limit is absent", () => {
    expect(parse("", { defaultLimit: 25 })).toEqual({ limit: 25, offset: 0 });
  });

  test("keeps an in-range limit and offset", () => {
    expect(parse("limit=10&skip=30")).toEqual({ limit: 10, offset: 30 });
  });

  test("accepts a limit exactly at the ceiling", () => {
    expect(parse(`limit=${V1_MANAGEMENT_MAX_LIMIT}`).limit).toBe(V1_MANAGEMENT_MAX_LIMIT);
  });

  test.each(["251", "100000", "1e9", "Infinity", "251.5"])(
    "refuses limit=%s above the ceiling with a ValidationError instead of clamping it",
    (raw) => {
      expect(() => parse(`limit=${raw}`)).toThrow(ValidationError);
      expect(() => parse(`limit=${raw}`)).toThrow(`limit must not exceed ${V1_MANAGEMENT_MAX_LIMIT}`);
    }
  );

  test.each(["0", "-5", "abc", "NaN", ""])("falls back to the default for limit=%j", (raw) => {
    expect(parse(`limit=${raw}`, { defaultLimit: 25 }).limit).toBe(25);
  });

  test("truncates fractional values", () => {
    expect(parse("limit=7.9&skip=2.5")).toEqual({ limit: 7, offset: 2 });
  });

  test("clamps an offset beyond the database integer range", () => {
    expect(parse("skip=99999999999").offset).toBe(2_147_483_647);
  });

  test.each(["-1", "abc", ""])("treats offset=%j as 0", (raw) => {
    expect(parse(`skip=${raw}`).offset).toBe(0);
  });

  test("reads the offset from the configured parameter only", () => {
    expect(parse("offset=40&skip=5", { offsetParam: "offset" }).offset).toBe(40);
    expect(parse("offset=40")).toEqual({ limit: V1_MANAGEMENT_MAX_LIMIT, offset: 0 });
  });

  test("a default above the ceiling is still capped", () => {
    expect(parse("", { defaultLimit: 10_000 }).limit).toBe(V1_MANAGEMENT_MAX_LIMIT);
  });
});
