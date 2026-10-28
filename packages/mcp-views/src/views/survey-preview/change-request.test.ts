import { describe, expect, test } from "vitest";
import { buildChangeRequest } from "./change-request";

describe("buildChangeRequest", () => {
  test("names the survey by id and the question the person picked", () => {
    expect(
      buildChangeRequest({
        surveyId: "clsurvey1",
        surveyName: "Feedback",
        target: { number: 3, headline: "Why?" },
        request: "  make it optional ",
      })
    ).toBe('Change the survey "Feedback" (id clsurvey1), about question 3 ("Why?"): make it optional');
  });

  test("addresses the whole survey when no question is picked", () => {
    expect(
      buildChangeRequest({ surveyId: "x", surveyName: "S", target: null, request: "shorter" })
    ).toBe('Change the survey "S" (id x), about the survey as a whole: shorter');
  });
});
