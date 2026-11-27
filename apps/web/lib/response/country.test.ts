import { describe, expect, test } from "vitest";
import { resolveResponseCountry } from "./country";

describe("resolveResponseCountry", () => {
  test("uses the CDN header when the client set no country", () => {
    expect(resolveResponseCountry(undefined, new Headers({ "CF-IPCountry": "DE" }))).toBe("DE");
    expect(resolveResponseCountry(undefined, new Headers({ "CloudFront-Viewer-Country": "US" }))).toBe("US");
  });

  test("prefers Cloudflare's header over CloudFront's", () => {
    const headers = new Headers({ "CF-IPCountry": "DE", "CloudFront-Viewer-Country": "US" });

    expect(resolveResponseCountry(undefined, headers)).toBe("DE");
  });

  test("an explicit client country wins over the CDN header, upper-cased", () => {
    expect(resolveResponseCountry(" fr ", new Headers({ "CF-IPCountry": "DE" }))).toBe("FR");
  });

  test("a client value that is not an assigned country code falls back to the CDN header", () => {
    const headers = new Headers({ "CF-IPCountry": "DE" });

    expect(resolveResponseCountry("Germany", headers)).toBe("DE");
    expect(resolveResponseCountry("D", headers)).toBe("DE");
    expect(resolveResponseCountry(49, headers)).toBe("DE");
    expect(resolveResponseCountry("ZZ", headers)).toBe("DE");
  });

  test("works without any CDN when the client set one", () => {
    expect(resolveResponseCountry("at", new Headers())).toBe("AT");
  });

  test("is unset with neither", () => {
    expect(resolveResponseCountry(undefined, new Headers())).toBeUndefined();
  });
});
