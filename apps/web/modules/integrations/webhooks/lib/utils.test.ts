import { describe, expect, test } from "vitest";
import { getEndpointStatusClassName, getNewWebhookInputProblem } from "./utils";

const complete = {
  url: "https://example.com/hook",
  triggerCount: 1,
  allSurveys: false,
  surveyCount: 1,
};

describe("getNewWebhookInputProblem", () => {
  test("is null for a complete input", () => {
    expect(getNewWebhookInputProblem(complete)).toBeNull();
  });

  test("accepts no selected surveys when the webhook covers all surveys", () => {
    expect(getNewWebhookInputProblem({ ...complete, allSurveys: true, surveyCount: 0 })).toBeNull();
  });

  test("reports a missing URL first", () => {
    expect(getNewWebhookInputProblem({ ...complete, url: "", triggerCount: 0 })).toBe("missing_url");
  });

  test("reports missing triggers before missing surveys", () => {
    expect(getNewWebhookInputProblem({ ...complete, triggerCount: 0, surveyCount: 0 })).toBe(
      "missing_trigger"
    );
  });

  test("reports missing surveys", () => {
    expect(getNewWebhookInputProblem({ ...complete, surveyCount: 0 })).toBe("missing_survey");
  });

  test("rejects a Discord webhook URL", () => {
    expect(getNewWebhookInputProblem({ ...complete, url: "https://discord.com/api/webhooks/123/abc" })).toBe(
      "discord_url"
    );
  });

  test("throws for a value that is not a URL, as the form's catch expects", () => {
    expect(() => getNewWebhookInputProblem({ ...complete, url: "not a url" })).toThrow();
  });
});

describe("getEndpointStatusClassName", () => {
  test.each([
    [true, "border-green-500 bg-green-50"],
    [false, "border-red-200 bg-red-50"],
    [undefined, "border-slate-200 bg-white"],
  ])("styles an endpoint test result of %s", (result, className) => {
    expect(getEndpointStatusClassName(result)).toBe(className);
  });
});
