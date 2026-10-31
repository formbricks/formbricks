import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { standardColumnGroups, standardHeaders } from "./standard-columns";
import { extractSurveyDetails } from "./utils";

const survey = {
  id: "survey-1",
  isVerifyEmailEnabled: true,
  languages: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  embeddedFields: [],
  blocks: [
    {
      id: "b1",
      name: "Block 1",
      elements: [
        { id: "q-text", type: "openText", headline: { default: "Your name" }, code: "name", required: false },
        {
          id: "q-multi",
          type: "multipleChoiceMulti",
          headline: { default: "Fruits" },
          required: false,
          shuffleOption: "none",
          choices: [{ id: "apple", label: { default: "Apple" } }],
        },
      ],
    },
  ],
} as unknown as TSurvey;

const groups = (isQuotasAllowed: boolean, responses = [] as never[]) =>
  standardColumnGroups({ survey, details: extractSurveyDetails(survey, responses), isQuotasAllowed });

describe("standardColumnGroups", () => {
  test("all groups together are the header row of today's file", () => {
    expect(standardHeaders(groups(true))).toEqual([
      "No.",
      "Response ID",
      "Timestamp",
      "Finished",
      "Quotas",
      "Survey ID",
      "Formbricks ID (internal)",
      "User ID",
      "Tags",
      ...extractSurveyDetails(survey, []).metaDataFields,
      "1. Your name",
      "2. Fruits",
      "2. Fruits - Option ID",
      "Verified Email",
    ]);
  });

  test("the Quotas column is only there when quotas are", () => {
    expect(groups(false).some((group) => group.id === "quotas")).toBe(false);
  });

  test("a question is one entry however many columns it owns, labelled with its code and headline", () => {
    const multi = groups(false).find((group) => group.id === "q:q-multi");
    expect(multi?.headers).toEqual(["2. Fruits", "2. Fruits - Option ID"]);
    expect(multi?.label).toBe("2 · Fruits");
    expect(groups(false).find((group) => group.id === "q:q-text")?.label).toBe("name · Your name");
  });

  test("switched-off groups drop their headers and keep the order of the rest", () => {
    const headers = standardHeaders(groups(false), ["no", "q:q-multi", "tags"]);
    expect(headers).not.toContain("No.");
    expect(headers).not.toContain("2. Fruits");
    expect(headers).not.toContain("Tags");
    expect(headers.slice(0, 2)).toEqual(["Response ID", "Timestamp"]);
    expect(headers).toContain("1. Your name");
  });
});
