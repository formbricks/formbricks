import { describe, expect, test } from "vitest";
import { isAppSurveyMissingTriggersToPublish } from "./publish-rule";

describe("isAppSurveyMissingTriggersToPublish", () => {
  const appSurvey = { type: "app", isOpenedByCreative: false } as const;

  test.each(["inProgress", "paused", "completed"] as const)(
    "refuses a %s app survey with no trigger and no creative that opens it",
    (status) => {
      expect(isAppSurveyMissingTriggersToPublish({ ...appSurvey, status, triggers: [] })).toBe(true);
    }
  );

  test("publishes an app survey with no trigger of its own when a creative opens it (ENG-3994)", () => {
    expect(
      isAppSurveyMissingTriggersToPublish({
        type: "app",
        status: "inProgress",
        triggers: [],
        isOpenedByCreative: true,
      })
    ).toBe(false);
  });

  test("publishes an app survey that has a trigger", () => {
    expect(
      isAppSurveyMissingTriggersToPublish({
        ...appSurvey,
        status: "inProgress",
        triggers: [{ actionClassId: "a" }],
      })
    ).toBe(false);
  });

  test("lets drafts and link surveys through", () => {
    expect(isAppSurveyMissingTriggersToPublish({ ...appSurvey, status: "draft", triggers: [] })).toBe(false);
    expect(
      isAppSurveyMissingTriggersToPublish({ ...appSurvey, type: "link", status: "inProgress", triggers: [] })
    ).toBe(false);
  });

  test.each([
    ["a null triggers array", null],
    ["an undefined triggers array", undefined],
    ["a hole the editor left for a removed trigger", [undefined]],
  ])("treats %s as no trigger", (_case, triggers) => {
    expect(isAppSurveyMissingTriggersToPublish({ ...appSurvey, status: "inProgress", triggers })).toBe(true);
  });
});
