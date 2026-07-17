import { describe, expect, test } from "vitest";
import { resolveConsentRedirectUrl } from "./consent-redirect";

describe("resolveConsentRedirectUrl", () => {
  test("reads `url` from the real accept shape ({ redirect: true, url })", () => {
    expect(
      resolveConsentRedirectUrl({ redirect: true, url: "https://client.example/callback?code=abc&state=xyz" })
    ).toBe("https://client.example/callback?code=abc&state=xyz");
  });

  test("reads the error `url` from the deny shape", () => {
    expect(
      resolveConsentRedirectUrl({
        redirect: true,
        url: "https://client.example/callback?error=access_denied",
      })
    ).toBe("https://client.example/callback?error=access_denied");
  });

  test("allows loopback and custom-scheme redirect targets (native MCP clients)", () => {
    expect(resolveConsentRedirectUrl({ url: "http://127.0.0.1:52765/callback?code=abc" })).toBe(
      "http://127.0.0.1:52765/callback?code=abc"
    );
    expect(resolveConsentRedirectUrl({ url: "cursor://anysphere.cursor-mcp/callback?code=abc" })).toBe(
      "cursor://anysphere.cursor-mcp/callback?code=abc"
    );
  });

  test("falls back to `redirect_uri` when only that is present (documented/legacy shape)", () => {
    expect(resolveConsentRedirectUrl({ redirect_uri: "https://client.example/cb?code=abc" })).toBe(
      "https://client.example/cb?code=abc"
    );
  });

  test("prefers `url` over `redirect_uri` when both are present", () => {
    expect(
      resolveConsentRedirectUrl({ url: "https://a.example/cb", redirect_uri: "https://b.example/cb" })
    ).toBe("https://a.example/cb");
  });

  test("returns null for missing/empty/non-object/non-string values (→ toast)", () => {
    expect(resolveConsentRedirectUrl({})).toBeNull();
    expect(resolveConsentRedirectUrl({ url: "" })).toBeNull();
    expect(resolveConsentRedirectUrl({ url: "   " })).toBeNull();
    expect(resolveConsentRedirectUrl({ url: 123 })).toBeNull();
    expect(resolveConsentRedirectUrl(null)).toBeNull();
    expect(resolveConsentRedirectUrl(undefined)).toBeNull();
    expect(resolveConsentRedirectUrl("https://client.example/cb")).toBeNull();
  });

  test("rejects dangerous schemes (XSS guard for the location.href sink)", () => {
    expect(resolveConsentRedirectUrl({ url: "javascript:alert(1)" })).toBeNull();
    expect(resolveConsentRedirectUrl({ url: "  JavaScript:alert(1)" })).toBeNull();
    expect(resolveConsentRedirectUrl({ url: "data:text/html,<script>alert(1)</script>" })).toBeNull();
    // falls through to the fallback, which is also dangerous → null
    expect(resolveConsentRedirectUrl({ url: "javascript:1", redirect_uri: "data:x" })).toBeNull();
  });
});
