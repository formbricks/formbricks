import { describe, expect, test, vi } from "vitest";
import { getCrossOriginRefusal } from "./origin-check";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://app.example.com",
  // Mid-rename: both auth URLs configured, one of them with a path and a trailing slash.
  AUTH_TRUSTED_ORIGINS: ["https://auth.example.com/some/path/", "not a url"],
}));

const request = (method: string, headers: Record<string, string> = {}) =>
  new Request("https://app.example.com/api/internal/things", { method, headers });

describe("getCrossOriginRefusal", () => {
  test.each(["GET", "HEAD", "OPTIONS", "get"])("lets a safe %s through with no headers at all", (method) => {
    expect(getCrossOriginRefusal(request(method))).toBeNull();
  });

  test.each(["POST", "PUT", "PATCH", "DELETE"])("lets a same-origin %s through", (method) => {
    expect(getCrossOriginRefusal(request(method, { "sec-fetch-site": "same-origin" }))).toBeNull();
  });

  test.each(["same-site", "cross-site", "none", "garbage"])(
    "refuses Sec-Fetch-Site %s, without falling back to Origin",
    (site) => {
      // A trusted Origin must not rescue a request the browser itself labelled as not same-origin:
      // `same-site` is exactly the sibling-subdomain case this check exists for.
      expect(
        getCrossOriginRefusal(request("POST", { "sec-fetch-site": site, origin: "https://app.example.com" }))
      ).toBe("sec_fetch_site");
    }
  );

  test("falls back to Origin when Sec-Fetch-Site is absent (older browser, plain HTTP)", () => {
    expect(getCrossOriginRefusal(request("POST", { origin: "https://app.example.com" }))).toBeNull();
  });

  test("trusts every configured auth origin, compared as an origin, not as the configured URL", () => {
    expect(getCrossOriginRefusal(request("PATCH", { origin: "https://auth.example.com" }))).toBeNull();
  });

  test.each([
    ["a sibling subdomain", "https://marketing.example.com"],
    ["the right host on the wrong scheme", "http://app.example.com"],
    ["the right host on another port", "https://app.example.com:8443"],
    ["an opaque origin", "null"],
  ])("refuses %s as Origin", (_label, origin) => {
    expect(getCrossOriginRefusal(request("DELETE", { origin }))).toBe("untrusted_origin");
  });

  test("refuses an unsafe request with neither header (fail-safe)", () => {
    expect(getCrossOriginRefusal(request("POST"))).toBe("no_origin");
  });

  test("ignores Host and X-Forwarded-Host entirely", () => {
    expect(
      getCrossOriginRefusal(
        request("POST", {
          origin: "https://evil.example.net",
          host: "evil.example.net",
          "x-forwarded-host": "evil.example.net",
        })
      )
    ).toBe("untrusted_origin");
  });
});
