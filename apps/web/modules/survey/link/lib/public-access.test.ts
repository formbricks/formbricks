import { describe, expect, test } from "vitest";
import {
  type TLinkSurveyAccessFields as TAccessFields,
  isLinkSurveyGoneError,
  isLinkSurveyOpenForResponses,
  isLinkSurveyServable,
} from "./public-access";

const survey = (overrides: Partial<TAccessFields> = {}): TAccessFields => ({
  type: "link",
  status: "inProgress",
  archivedAt: null,
  ...overrides,
});

describe("isLinkSurveyServable", () => {
  test.each([
    ["in progress", survey(), true],
    ["paused", survey({ status: "paused" }), true],
    ["completed", survey({ status: "completed" }), true],
    ["draft", survey({ status: "draft" }), false],
    ["archived", survey({ archivedAt: new Date("2026-10-01T00:00:00Z") }), false],
    ["archived while in progress", survey({ status: "inProgress", archivedAt: new Date() }), false],
    ["an app survey", survey({ type: "app" }), false],
  ])("%s → %s", (_label, input, expected) => {
    expect(isLinkSurveyServable(input)).toBe(expected);
  });
});

describe("isLinkSurveyOpenForResponses", () => {
  test.each([
    ["in progress", survey(), true],
    ["paused (also how a scheduled survey is stored)", survey({ status: "paused" }), false],
    ["completed", survey({ status: "completed" }), false],
    ["draft", survey({ status: "draft" }), false],
    ["archived while in progress", survey({ archivedAt: new Date() }), false],
    ["an app survey in progress", survey({ type: "app" }), false],
  ])("%s → %s", (_label, input, expected) => {
    expect(isLinkSurveyOpenForResponses(input)).toBe(expected);
  });
});

describe("isLinkSurveyGoneError", () => {
  const surveyId = "clsurvey00000000000000000";

  test("is true for the action's not-found answer for this survey", () => {
    expect(isLinkSurveyGoneError(`Survey with ID ${surveyId} not found`, surveyId)).toBe(true);
  });

  test.each([
    ["a wrong PIN", "INVALID_PIN"],
    ["a rate limit", "Maximum number of requests reached. Please try again later."],
    ["a generic server error", "Something went wrong while executing the operation."],
    ["another survey's not-found", "Survey with ID clother000000000000000000 not found"],
    ["no error at all", undefined],
  ])("is false for %s", (_label, serverError) => {
    expect(isLinkSurveyGoneError(serverError, surveyId)).toBe(false);
  });
});
