import { describe, expect, test } from "vitest";
import { parseShowSurveyResult } from "./read-result";

const survey = {
  id: "clsurvey1",
  name: "Feedback",
  type: "link",
  status: "inProgress",
  defaultLanguage: "en-US",
  languages: [{ code: "en-US", default: true, enabled: true }],
  blocks: [],
  endings: [],
};

const meta = {
  appUrl: "https://app.example.com",
  rendererUrl: "https://app.example.com/js/surveys.umd.cjs",
  surveyUrl: "https://app.example.com/s/clsurvey1",
  render: { survey: { type: "link", languages: [] }, styling: {}, isBrandingEnabled: true },
  settings: { triggers: [], displayOption: "displayOnce" },
  problems: ["Fix me", 3],
};

describe("parseShowSurveyResult", () => {
  test("reads the survey, the render data and the problems", () => {
    const parsed = parseShowSurveyResult({ structuredContent: { data: survey }, _meta: { formbricks: meta } });
    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.survey.name).toBe("Feedback");
    expect(parsed.data.meta?.rendererUrl).toBe(meta.rendererUrl);
    expect(parsed.data.meta?.problems).toEqual(["Fix me"]);
  });

  test("still shows the review when the render data is missing or malformed", () => {
    const missing = parseShowSurveyResult({ structuredContent: { data: survey } });
    const malformed = parseShowSurveyResult({
      structuredContent: { data: survey },
      _meta: { formbricks: { appUrl: 1 } },
    });
    expect(missing.kind === "ok" && missing.data.meta).toBeNull();
    expect(malformed.kind === "ok" && malformed.data.meta).toBeNull();
  });

  test("collects warnings next to the survey, as text or as objects", () => {
    const parsed = parseShowSurveyResult({
      structuredContent: { data: survey, warnings: ["one", { message: "two" }, { detail: "three" }, 4] },
    });
    expect(parsed.kind === "ok" && parsed.data.warnings).toEqual(["one", "two", "three"]);
  });

  test("reports a failed call with the server's detail", () => {
    const parsed = parseShowSurveyResult({
      isError: true,
      content: [{ type: "text", text: "{}" }],
      structuredContent: { error: { status: 403, detail: "You are not authorized to access this resource" } },
    });
    expect(parsed).toEqual({ kind: "error", message: "You are not authorized to access this resource" });
  });

  test("reports a result that holds no survey", () => {
    expect(parseShowSurveyResult({ structuredContent: { data: { nope: true } } })).toEqual({ kind: "unreadable" });
    expect(parseShowSurveyResult({})).toEqual({ kind: "unreadable" });
  });
});
