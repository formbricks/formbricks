import { describe, expect, test } from "vitest";
import { SURVEY_FOLLOW_UPS_SUNSET_DATE, shouldShowFollowUpsTab } from "./deprecation";

describe("shouldShowFollowUpsTab", () => {
  test("keeps the tab for a survey that already has follow-ups", () => {
    expect(
      shouldShowFollowUpsTab({
        followUpCount: 1,
        isSurveyFollowUpsAllowed: true,
        isWorkflowsAllowed: true,
      })
    ).toBe(true);
  });

  test("keeps the tab for existing follow-ups even once the entitlement has lapsed", () => {
    // A Cloud trial or a downgrade revokes the entitlement while the survey keeps carrying the
    // follow-ups; hiding them would hide live automation from its owner.
    expect(
      shouldShowFollowUpsTab({
        followUpCount: 2,
        isSurveyFollowUpsAllowed: false,
        isWorkflowsAllowed: false,
      })
    ).toBe(true);
  });

  test("keeps the tab with no follow-ups when Workflows cannot replace it", () => {
    // Self-hosted without an enterprise license: follow-ups are free, Workflows are not.
    expect(
      shouldShowFollowUpsTab({
        followUpCount: 0,
        isSurveyFollowUpsAllowed: true,
        isWorkflowsAllowed: false,
      })
    ).toBe(true);
  });

  test("hides the empty tab once Workflows are available", () => {
    expect(
      shouldShowFollowUpsTab({
        followUpCount: 0,
        isSurveyFollowUpsAllowed: true,
        isWorkflowsAllowed: true,
      })
    ).toBe(false);
  });

  test("hides the empty tab for organizations that are not entitled to follow-ups", () => {
    // These used to get an upgrade prompt selling a deprecated feature.
    expect(
      shouldShowFollowUpsTab({
        followUpCount: 0,
        isSurveyFollowUpsAllowed: false,
        isWorkflowsAllowed: false,
      })
    ).toBe(false);

    expect(
      shouldShowFollowUpsTab({
        followUpCount: 0,
        isSurveyFollowUpsAllowed: false,
        isWorkflowsAllowed: true,
      })
    ).toBe(false);
  });
});

describe("SURVEY_FOLLOW_UPS_SUNSET_DATE", () => {
  test("is the announced removal date", () => {
    expect(SURVEY_FOLLOW_UPS_SUNSET_DATE.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});
