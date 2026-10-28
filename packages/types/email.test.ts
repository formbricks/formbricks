import { describe, expect, test } from "vitest";
import { ZLinkSurveyEmailData } from "./email";

const valid = {
  surveyId: "clsurvey00000000000000000",
  email: "respondent@example.com",
  locale: "en-US",
};

// ENG-4043: the public verify-email action parses its input with this schema, so it is the boundary
// that decides what an anonymous caller can put into an email sent from the instance.
describe("ZLinkSurveyEmailData", () => {
  test("accepts what the verify-email screen sends", () => {
    expect(ZLinkSurveyEmailData.safeParse({ ...valid, suId: "su", surveyLanguageCode: "de" }).success).toBe(
      true
    );
  });

  test("drops a survey name and logo sent by the caller", () => {
    const parsed = ZLinkSurveyEmailData.parse({
      ...valid,
      surveyName: "Call +1 555 0100 about your refund",
      logoUrl: "https://attacker.example/logo.png",
    });

    expect(parsed).not.toHaveProperty("surveyName");
    expect(parsed).not.toHaveProperty("logoUrl");
  });

  test.each([
    ["an address list", "a@example.com, b@example.com"],
    ["a named address", "Support <a@example.com>"],
    ["something that is not an address", "respondent"],
    ["an address over 255 characters", `${"a".repeat(64)}@${"b".repeat(190)}.com`],
  ])("rejects %s before any email is sent", (_label, email) => {
    expect(ZLinkSurveyEmailData.safeParse({ ...valid, email }).success).toBe(false);
  });

  test("rejects a survey id that is not a cuid2", () => {
    expect(ZLinkSurveyEmailData.safeParse({ ...valid, surveyId: "../surveys" }).success).toBe(false);
  });
});
