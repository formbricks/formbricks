import { describe, expect, test } from "vitest";
import { z } from "zod";
import { checkEntriesMax, checkNumberRange, checkStringMax } from "./value-bounds";

const issuesOf = (value: unknown, check: (value: unknown, ctx: z.RefinementCtx) => void) =>
  z
    .unknown()
    .superRefine(check)
    .safeParse(value)
    .error?.issues.map(({ path, message }) => ({ path: path.join("."), message })) ?? [];

describe("checkStringMax", () => {
  const check = (value: unknown, ctx: z.RefinementCtx) => checkStringMax(ctx, value as string, 3, ["a", 0]);

  test("takes a string at the cap and names the field and the cap one past it", () => {
    expect(issuesOf("abc", check)).toEqual([]);
    expect(issuesOf("abcd", check)).toEqual([
      { path: "a.0", message: "Too big: expected string to have <=3 characters" },
    ]);
  });
});

describe("checkNumberRange", () => {
  const check =
    (int: boolean) =>
    (value: unknown, ctx: z.RefinementCtx): void =>
      checkNumberRange(ctx, value as number, { min: -2, max: 2, int }, ["n"]);

  test("takes both ends and refuses either side", () => {
    expect(issuesOf(-2, check(false))).toEqual([]);
    expect(issuesOf(2, check(false))).toEqual([]);
    expect(issuesOf(2.5, check(false))).toEqual([
      { path: "n", message: "Too big: expected number to be <=2" },
    ]);
    expect(issuesOf(-3, check(false))).toEqual([
      { path: "n", message: "Too small: expected number to be >=-2" },
    ]);
  });

  test("refuses a fraction where an integer is asked for", () => {
    expect(issuesOf(1.5, check(true))).toEqual([
      { path: "n", message: "Invalid input: expected int, received number" },
    ]);
  });
});

describe("checkEntriesMax", () => {
  const check = (value: unknown, ctx: z.RefinementCtx) => checkEntriesMax(ctx, value as object, 2, ["r"]);

  test("counts an object's keys and an array's items", () => {
    expect(issuesOf({ a: 1, b: 2 }, check)).toEqual([]);
    expect(issuesOf({ a: 1, b: 2, c: 3 }, check)).toEqual([
      { path: "r", message: "Too big: expected object to have <=2 entries" },
    ]);
    expect(issuesOf([1, 2, 3], check)).toEqual([
      { path: "r", message: "Too big: expected array to have <=2 entries" },
    ]);
  });
});
