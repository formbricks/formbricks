import { describe, expect, test, vi } from "vitest";
import { getCrossOriginRefusal } from "./origin-check";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://app.example.com",
  // Mid-rename: both auth URLs configured, one of them with a path and a trailing slash.
  AUTH_TRUSTED_ORIGINS: ["https://auth.example.com/some/path/", "not a url"],
  BETTER_AUTH_ENV_TRUSTED_ORIGINS: ["https://extra.example.org"],
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

  test("trusts BETTER_AUTH_TRUSTED_ORIGINS, as sign-in does", () => {
    expect(getCrossOriginRefusal(request("POST", { origin: "https://extra.example.org" }))).toBeNull();
  });

  describe("without Sec-Fetch-Site, an Origin naming the request's own host (Next's server-action rule)", () => {
    test.each([
      ["a LAN address, by Host", "http://192.168.1.20:3000", { host: "192.168.1.20:3000" }],
      ["an alternate hostname, by Host", "https://forms.internal", { host: "forms.internal" }],
      [
        "the first X-Forwarded-Host, over Host",
        "https://forms.internal",
        { host: "web:3000", "x-forwarded-host": "forms.internal, proxy.local" },
      ],
      ["either scheme: Next compares hosts only", "http://forms.internal", { host: "forms.internal" }],
    ])("lets %s through", (_label, origin, headers) => {
      expect(getCrossOriginRefusal(request("POST", { origin, ...headers }))).toBeNull();
    });

    test.each([
      ["a host other than Host", "https://evil.example.net", { host: "forms.internal" }],
      ["the same name on another port", "https://forms.internal:8443", { host: "forms.internal" }],
      [
        "Host when X-Forwarded-Host names another host",
        "https://web:3000",
        { host: "web:3000", "x-forwarded-host": "forms.internal" },
      ],
      [
        "a later X-Forwarded-Host entry",
        "https://evil.example.net",
        { host: "forms.internal", "x-forwarded-host": "forms.internal, evil.example.net" },
      ],
      ["an opaque origin", "null", { host: "null" }],
      ["an unparsable origin", "not a url", { host: "forms.internal" }],
    ])("refuses %s", (_label, origin, headers) => {
      expect(getCrossOriginRefusal(request("PUT", { origin, ...headers }))).toBe("untrusted_origin");
    });

    test("never overrides Sec-Fetch-Site: a cross-site request matching Host is still refused", () => {
      expect(
        getCrossOriginRefusal(
          request("POST", {
            "sec-fetch-site": "cross-site",
            origin: "https://forms.internal",
            host: "forms.internal",
          })
        )
      ).toBe("sec_fetch_site");
    });
  });
});
