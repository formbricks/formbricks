import { describe, expect, test } from "vitest";
import { getUserIdFromSearchParams, hasUserIdSearchParam } from "./user-id";

describe("getUserIdFromSearchParams", () => {
  test("returns the first case-insensitive userId value in URL order", () => {
    const searchParams = new URLSearchParams("foo=bar&UserID=first&userId=second");

    expect(getUserIdFromSearchParams(searchParams)).toBe("first");
  });

  test("keeps the exact decoded value without trimming or case normalization", () => {
    const searchParams = new URLSearchParams("userId=%20Test%40Example.com%20");

    expect(getUserIdFromSearchParams(searchParams)).toBe(" Test@Example.com ");
  });

  test("ignores empty values", () => {
    const searchParams = new URLSearchParams("userId=");

    expect(getUserIdFromSearchParams(searchParams)).toBeUndefined();
  });

  test("returns undefined when no userId parameter exists", () => {
    const searchParams = new URLSearchParams("source=email");

    expect(getUserIdFromSearchParams(searchParams)).toBeUndefined();
  });

  test("supports plain Next.js searchParams objects", () => {
    expect(getUserIdFromSearchParams({ source: "email", UserID: "from-object" })).toBe("from-object");
  });

  test("supports array values in plain searchParams objects", () => {
    expect(getUserIdFromSearchParams({ userId: ["first", "second"] })).toBe("first");
  });
});

describe("hasUserIdSearchParam", () => {
  test("returns true when a non-empty userId parameter exists", () => {
    expect(hasUserIdSearchParam(new URLSearchParams("userId=abc"))).toBe(true);
  });

  test("returns false when the userId parameter is empty", () => {
    expect(hasUserIdSearchParam(new URLSearchParams("userId="))).toBe(false);
  });
});
