import { describe, expect, test } from "vitest";
import { type TWorkflowRunContext } from "./context";
import { buildWorkflowSurveyLink, insertWorkflowSurveyLink } from "./survey-link";

const context: TWorkflowRunContext = {
  payload: { agent: { id: "A-42" }, call: { id: "K 771&x=1" }, channel: "call" },
  steps: {},
};

const surveyId = "cm9zr4q7i000108l84gozfggr";

describe("buildWorkflowSurveyLink", () => {
  test("puts accepted Embedded Data on the link, URL-encoded, in the survey's own spelling", () => {
    expect(
      buildWorkflowSurveyLink({
        publicDomain: "https://surveys.example.com/",
        surveyId,
        embeddedData: [
          { key: "agent_id", value: "#recall:payload.agent.id/fallback:#" },
          { key: "call_id", value: "#recall:payload.call.id/fallback:#" },
        ],
        acceptedKeys: ["Agent_ID", "call_id"],
        context,
      })
    ).toBe(`https://surveys.example.com/s/${surveyId}?Agent_ID=A-42&call_id=K%20771%26x%3D1`);
  });

  test("leaves off keys the survey doesn't accept and values that came out empty", () => {
    expect(
      buildWorkflowSurveyLink({
        publicDomain: "https://surveys.example.com",
        surveyId,
        embeddedData: [
          { key: "channel", value: "#recall:payload.channel/fallback:#" },
          { key: "lang", value: "de" },
          { key: "missing", value: "#recall:payload.nope/fallback:#" },
        ],
        acceptedKeys: ["channel", "missing"],
        context,
      })
    ).toBe(`https://surveys.example.com/s/${surveyId}?channel=call`);
  });

  test("a link without Embedded Data has no query", () => {
    expect(
      buildWorkflowSurveyLink({
        publicDomain: "https://surveys.example.com",
        surveyId,
        embeddedData: [],
        acceptedKeys: [],
        context,
      })
    ).toBe(`https://surveys.example.com/s/${surveyId}`);
  });
});

describe("insertWorkflowSurveyLink", () => {
  test("replaces every link token with an escaped anchor", () => {
    expect(
      insertWorkflowSurveyLink("<p>Go: #survey-link#</p><p>#survey-link#</p>", "https://x.test/s/a?b=1&c=2")
    ).toBe(
      '<p>Go: <a href="https://x.test/s/a?b=1&amp;c=2">https://x.test/s/a?b=1&amp;c=2</a></p>' +
        '<p><a href="https://x.test/s/a?b=1&amp;c=2">https://x.test/s/a?b=1&amp;c=2</a></p>'
    );
  });
});
