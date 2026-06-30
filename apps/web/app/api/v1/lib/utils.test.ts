import { describe, expect, test } from "vitest";
import { TResponseInput } from "@formbricks/types/responses";
import { buildPrismaResponseData } from "./utils";

const input = (language?: string): TResponseInput =>
  ({ surveyId: "svy_1", finished: false, data: {}, language }) as unknown as TResponseInput;

describe("buildPrismaResponseData — language canonicalization (ENG-1067)", () => {
  test("canonicalizes a legacy language code", () => {
    expect(buildPrismaResponseData(input("hi"), null, {}).language).toBe("hi-IN");
  });

  test("leaves an already-canonical code unchanged", () => {
    expect(buildPrismaResponseData(input("hi-IN"), null, {}).language).toBe("hi-IN");
  });

  test("preserves the 'default' sentinel", () => {
    expect(buildPrismaResponseData(input("default"), null, {}).language).toBe("default");
  });

  test("preserves an unresolvable value", () => {
    expect(buildPrismaResponseData(input("123"), null, {}).language).toBe("123");
  });

  test("leaves undefined language as-is", () => {
    expect(buildPrismaResponseData(input(undefined), null, {}).language).toBeUndefined();
  });

  test("treats blank/whitespace-only language as absent (not persisted)", () => {
    expect(buildPrismaResponseData(input(""), null, {}).language).toBeUndefined();
    expect(buildPrismaResponseData(input("   "), null, {}).language).toBeUndefined();
  });
});
