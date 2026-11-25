import { describe, expect, test, vi } from "vitest";
import { getCrossOriginRefusal, isJsonContentType, mediaTypeOf } from "./origin-check";

vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://app.example.com",
  AUTH_TRUSTED_ORIGINS: ["https://app.example.com", "https://legacy.example.com"],
  BETTER_AUTH_ENV_TRUSTED_ORIGINS: ["https://partner.example.com", "https://*.wild.example.com"],
}));

const request = (method: string, headers: Record<string, string> = {}) =>
  new Request("https://app.example.com/api/v3/responses/batch-delete", { method, headers });

describe("getCrossOriginRefusal", () => {
  test.each(["GET", "HEAD", "OPTIONS"])("%s is never refused, whatever the headers say", (method) => {
    expect(getCrossOriginRefusal(request(method, { "sec-fetch-site": "cross-site" }))).toBeNull();
  });

  test("Sec-Fetch-Site same-origin passes", () => {
    expect(getCrossOriginRefusal(request("POST", { "sec-fetch-site": "same-origin" }))).toBeNull();
  });

  test.each(["none", "same-site", "cross-site", "bogus"])("Sec-Fetch-Site %s is refused", (site) => {
    expect(getCrossOriginRefusal(request("POST", { "sec-fetch-site": site }))).toBe("sec_fetch_site");
  });

  test("a present Sec-Fetch-Site decides alone: a trusted Origin does not rescue same-site", () => {
    expect(
      getCrossOriginRefusal(
        request("DELETE", { "sec-fetch-site": "same-site", origin: "https://app.example.com" })
      )
    ).toBe("sec_fetch_site");
  });

  test("without Sec-Fetch-Site, a trusted Origin passes", () => {
    expect(getCrossOriginRefusal(request("POST", { origin: "https://legacy.example.com" }))).toBeNull();
  });

  test("an origin listed in BETTER_AUTH_TRUSTED_ORIGINS passes exactly", () => {
    expect(getCrossOriginRefusal(request("POST", { origin: "https://partner.example.com" }))).toBeNull();
  });

  test("a wildcard entry stays sign-in-only and does not match a dashboard write", () => {
    expect(getCrossOriginRefusal(request("POST", { origin: "https://tenant.wild.example.com" }))).toBe(
      "untrusted_origin"
    );
  });

  test("without Sec-Fetch-Site, an Origin naming the request's own host passes", () => {
    expect(
      getCrossOriginRefusal(request("POST", { origin: "http://192.168.1.5:3000", host: "192.168.1.5:3000" }))
    ).toBeNull();
  });

  test("the host comparison ignores case", () => {
    expect(
      getCrossOriginRefusal(
        request("POST", { origin: "https://forms.example.org", host: "Forms.Example.ORG" })
      )
    ).toBeNull();
  });

  test("the first X-Forwarded-Host takes precedence over Host", () => {
    expect(
      getCrossOriginRefusal(
        request("POST", {
          origin: "https://forms.example.org",
          "x-forwarded-host": "forms.example.org, internal",
          host: "internal",
        })
      )
    ).toBeNull();
  });

  test.each([
    "https://evil.example",
    "https://sibling.example.com",
    "null",
    "not a url",
    "https://app.example.com.evil.example",
  ])("without Sec-Fetch-Site, Origin %s is refused", (origin) => {
    expect(getCrossOriginRefusal(request("POST", { origin, host: "app.example.com" }))).toBe(
      "untrusted_origin"
    );
  });

  test("neither header is refused: no non-browser caller may use a session route", () => {
    expect(getCrossOriginRefusal(request("POST"))).toBe("no_origin");
  });
});

describe("content type", () => {
  test("mediaTypeOf drops parameters and case", () => {
    expect(mediaTypeOf("Application/JSON; charset=utf-8")).toBe("application/json");
    expect(mediaTypeOf(null)).toBe("");
  });

  test("application/json is accepted with or without a charset; form types are not", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("multipart/form-data; boundary=x")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});
