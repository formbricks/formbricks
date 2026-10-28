import { describe, expect, test } from "vitest";
import { buildShowSurveySummary } from "./summary";

const survey = {
  name: "Feedback",
  type: "link",
  status: "inProgress",
  defaultLanguage: "en-US",
  languages: [
    { code: "en-US", default: true },
    { code: "de-DE", default: false },
  ],
  blocks: [
    {
      name: "Intro",
      elements: [
        { type: "nps", required: true, headline: { "en-US": "How likely <b>are you</b>?", "de-DE": "Wie?" } },
        { type: "openText", required: false, headline: { "en-US": "Why?" } },
      ],
    },
  ],
  endings: [
    { type: "endScreen", headline: { "en-US": "Thanks" } },
    { type: "redirectToUrl", url: "https://example.com" },
  ],
};

describe("buildShowSurveySummary", () => {
  test("states what was shown and the counts", () => {
    const text = buildShowSurveySummary(survey);
    expect(text).toContain('Showing the survey "Feedback"');
    expect(text).toContain("link survey; in progress; 1 block; 2 questions; languages: en-US (default), de-DE");
    expect(text).toContain("nothing they enter in the preview is stored");
  });

  test("outlines questions in the default language as plain text, with endings", () => {
    const text = buildShowSurveySummary(survey);
    expect(text).toContain("1. [nps, required] How likely are you ?");
    expect(text).toContain("2. [openText, optional] Why?");
    expect(text).toContain("Ending 1: Thanks");
    expect(text).toContain("Ending 2: redirect to https://example.com");
  });

  test("caps a long outline and points at structuredContent", () => {
    const many = {
      ...survey,
      blocks: [{ name: "B", elements: Array.from({ length: 60 }, () => ({ type: "openText", headline: { "en-US": "Q" } })) }],
    };
    const text = buildShowSurveySummary(many);
    expect(text).toContain("more lines; the full survey is in structuredContent");
    expect(text.split("\n").length).toBeLessThan(60);
  });

  test("survives a shape it does not recognise", () => {
    expect(buildShowSurveySummary(undefined)).toBe("Showing the survey to the user in an interactive preview.");
    expect(buildShowSurveySummary({ blocks: "nope", endings: [null] })).toContain("0 blocks");
  });
});
