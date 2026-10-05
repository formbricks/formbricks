import { describe, expect, test } from "vitest";
import { getFollowUpsAvailability } from "./availability";

describe("getFollowUpsAvailability", () => {
  test("offers and allows creation where follow-ups are entitled and Workflows are not available", () => {
    expect(
      getFollowUpsAvailability({
        isSurveyFollowUpsAllowed: true,
        isWorkflowsAllowed: false,
        isRestricted: false,
      })
    ).toEqual({ isCreationOffered: true, canCreate: true, isSending: true });
  });

  test("a restricted survey keeps the entry point but cannot create, and its follow-ups do not send", () => {
    expect(
      getFollowUpsAvailability({
        isSurveyFollowUpsAllowed: true,
        isWorkflowsAllowed: false,
        isRestricted: true,
      })
    ).toEqual({ isCreationOffered: true, canCreate: false, isSending: false });
  });

  test("with Workflows available no new follow-up is offered, but existing ones still send", () => {
    expect(
      getFollowUpsAvailability({
        isSurveyFollowUpsAllowed: true,
        isWorkflowsAllowed: true,
        isRestricted: false,
      })
    ).toEqual({ isCreationOffered: false, canCreate: false, isSending: true });
  });

  test("a lapsed entitlement neither offers creation nor sends", () => {
    expect(
      getFollowUpsAvailability({
        isSurveyFollowUpsAllowed: false,
        isWorkflowsAllowed: false,
        isRestricted: false,
      })
    ).toEqual({ isCreationOffered: false, canCreate: false, isSending: false });
  });
});
