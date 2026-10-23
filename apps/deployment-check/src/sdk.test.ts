import { describe, expect, test } from "vitest";
import { type TApiResponse } from "./api-client.ts";
import { describeSdkBundleProblem } from "./sdk.ts";

const reply = (status: number, text: string): TApiResponse => ({
  status,
  ok: status >= 200 && status < 300,
  text,
  json: undefined,
});

const BUNDLE =
  '(function(M,F){typeof exports=="object"?module.exports=F():(M=globalThis,M.formbricks=F())})(this,function(){});';

describe("describeSdkBundleProblem", () => {
  test("accepts the UMD bundle", () => {
    expect(describeSdkBundleProblem(reply(200, BUNDLE))).toBeUndefined();
  });

  test("rejects an HTML fallback page served with HTTP 200", () => {
    const html = `<!DOCTYPE html><html><body>${"x".repeat(2_000)}</body></html>`;
    expect(describeSdkBundleProblem(reply(200, html))).toBe("returned an HTML page instead of JavaScript");
  });

  test("rejects JavaScript that is not the SDK", () => {
    expect(describeSdkBundleProblem(reply(200, "console.log(1);".repeat(100)))).toBe(
      "returned 1500 bytes that are not the Formbricks SDK"
    );
  });

  test("reports a non-200 status", () => {
    expect(describeSdkBundleProblem(reply(404, "Not found"))).toBe("returned HTTP 404");
  });
});
