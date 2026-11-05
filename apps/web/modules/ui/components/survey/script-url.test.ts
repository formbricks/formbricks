import { describe, expect, test } from "vitest";
import { getSurveysScriptUrl } from "./script-url";

describe("getSurveysScriptUrl", () => {
  test("loads the renderer under the release version, so a release never gets the last one's CDN copy", () => {
    expect(getSurveysScriptUrl("https://surveys.example.com", "6.2.0")).toBe(
      "https://surveys.example.com/js/surveys.umd.cjs?v=6.2.0"
    );
  });

  test("loads it from the page's own origin when no app URL is given", () => {
    expect(getSurveysScriptUrl(undefined, "6.2.0")).toBe("/js/surveys.umd.cjs?v=6.2.0");
  });

  test("keeps today's unversioned URL for a build without a release version", () => {
    expect(getSurveysScriptUrl("https://surveys.example.com", undefined)).toBe(
      "https://surveys.example.com/js/surveys.umd.cjs"
    );
    expect(getSurveysScriptUrl(undefined, undefined)).toBe("/js/surveys.umd.cjs");
  });

  test("escapes a version that is not URL-safe", () => {
    expect(getSurveysScriptUrl(undefined, "6.2.0+build 7")).toBe("/js/surveys.umd.cjs?v=6.2.0%2Bbuild%207");
  });
});
