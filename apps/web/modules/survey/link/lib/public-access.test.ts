import { describe, expect, test } from "vitest";
import {
  type TLinkSurveyAccessFields as TAccessFields,
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
