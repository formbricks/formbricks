import { describe, expect, test } from "vitest";
import {
  ATTRIBUTION_COOKIE_NAME,
  buildAttributionQuerySuffix,
  getAttributionPropertiesFromCookies,
  pickAttributionParams,
} from "./attribution";

const makeCookieStore = (value?: string) => ({
  get: (name: string) => (name === ATTRIBUTION_COOKIE_NAME && value !== undefined ? { value } : undefined),
});

describe("pickAttributionParams", () => {
  test("returns only whitelisted, non-empty params", () => {
    const params = new URLSearchParams(
      "page=home&utm_source=twitter&utm_medium=&other=ignored&initial_source=blog"
    );

    expect(pickAttributionParams(params)).toEqual({
      page: "home",
      utm_source: "twitter",
      initial_source: "blog",
    });
  });

  test("trims values and drops whitespace-only values", () => {
    const params = new URLSearchParams("page=%20%20&utm_campaign=%20launch%20");

    expect(pickAttributionParams(params)).toEqual({ utm_campaign: "launch" });
  });

  test("returns an empty object for null params", () => {
    expect(pickAttributionParams(null)).toEqual({});
  });
});

describe("getAttributionPropertiesFromCookies", () => {
  // Next's cookie store already percent-decodes the value, so the helper receives plain JSON.
  test("parses a plain JSON cookie into whitelisted properties", () => {
    const cookieValue = JSON.stringify({ page: "home", utm_source: "twitter", not_allowed: "x" });

    expect(getAttributionPropertiesFromCookies(makeCookieStore(cookieValue))).toEqual({
      page: "home",
      utm_source: "twitter",
    });
  });

  test("does not double-decode: preserves values containing literal percent sequences", () => {
    // The client wrote encodeURIComponent(JSON.stringify(...)) and Next decoded it once,
    // so a value like "a%20b" arrives here verbatim and must NOT be decoded again to "a b".
    const cookieValue = JSON.stringify({ utm_campaign: "a%20b", utm_term: "50%25off" });

    expect(getAttributionPropertiesFromCookies(makeCookieStore(cookieValue))).toEqual({
      utm_campaign: "a%20b",
      utm_term: "50%25off",
    });
  });

  test("returns an empty object when the cookie is missing", () => {
    expect(getAttributionPropertiesFromCookies(makeCookieStore())).toEqual({});
  });

  test("returns an empty object for malformed JSON", () => {
    expect(getAttributionPropertiesFromCookies(makeCookieStore("not-json"))).toEqual({});
  });

  test("ignores non-string values in the cookie", () => {
    const cookieValue = JSON.stringify({ page: 123, utm_source: "twitter" });

    expect(getAttributionPropertiesFromCookies(makeCookieStore(cookieValue))).toEqual({
      utm_source: "twitter",
    });
  });
});

describe("buildAttributionQuerySuffix", () => {
  test("builds an encoded query suffix from whitelisted params", () => {
    const params = new URLSearchParams("page=home&utm_source=twitter&other=x");

    expect(buildAttributionQuerySuffix(params)).toBe("page=home&utm_source=twitter");
  });

  test("returns an empty string when there is nothing to forward", () => {
    expect(buildAttributionQuerySuffix(new URLSearchParams("other=x"))).toBe("");
    expect(buildAttributionQuerySuffix(null)).toBe("");
  });
});
