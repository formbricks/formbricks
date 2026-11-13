import { describe, expect, test } from "vitest";
import type { TWorkflowSendEmailActionConfig } from "@formbricks/workflows";
import {
  appendSurveyLinkToken,
  removeSurveyLinkToken,
  updateEmbeddedDataRow,
  withSurveyLinkSurvey,
  withoutSurveyLink,
} from "./email-survey-link";

const config = {
  to: "",
  from: "team@example.com",
  replyTo: [],
  subject: "How was your call?",
  body: "<p>Hi, thanks for calling.</p>",
  attachResponseData: false,
} as TWorkflowSendEmailActionConfig;

describe("survey link token", () => {
  test("is placed at the end of the body once", () => {
    const once = appendSurveyLinkToken(config.body);
    expect(once).toBe("<p>Hi, thanks for calling.</p><p>#survey-link#</p>");
    expect(appendSurveyLinkToken(once)).toBe(once);
  });

  test("is taken out of the body with its paragraph", () => {
    expect(removeSurveyLinkToken("<p>Hi</p><p>#survey-link#</p>")).toBe("<p>Hi</p>");
    expect(removeSurveyLinkToken("<p>Answer here: #survey-link#</p>")).toBe("<p>Answer here: </p>");
  });
});

describe("survey link config", () => {
  test("picking a survey links it and places the link, keeping Embedded Data rows", () => {
    const linked = withSurveyLinkSurvey(
      { ...config, surveyLink: { surveyId: "old", embeddedData: [{ key: "agent_id", value: "x" }] } },
      "cm9zr4mps000008l8btfy1vtz"
    );
    expect(linked).toEqual({
      surveyLink: { surveyId: "cm9zr4mps000008l8btfy1vtz", embeddedData: [{ key: "agent_id", value: "x" }] },
      body: "<p>Hi, thanks for calling.</p><p>#survey-link#</p>",
    });
  });

  test("removing the link removes its token too", () => {
    expect(withoutSurveyLink({ ...config, body: "<p>Hi</p><p>#survey-link#</p>" })).toEqual({
      surveyLink: undefined,
      body: "<p>Hi</p>",
    });
  });

  test("edits one Embedded Data row", () => {
    expect(
      updateEmbeddedDataRow(
        [
          { key: "a", value: "1" },
          { key: "b", value: "2" },
        ],
        1,
        { value: "#recall:payload.agent.id/fallback:#" }
      )
    ).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "#recall:payload.agent.id/fallback:#" },
    ]);
  });
});
