import { describe, expect, test } from "vitest";
import { toLinkedSurveyOption } from "./destination-options";
import type { TDestinationSurveyFacts } from "./repository";

const survey = (patch: Partial<TDestinationSurveyFacts> = {}): TDestinationSurveyFacts => ({
  id: "linked",
  name: "Site feedback",
  type: "app",
  status: "inProgress",
  archivedAt: null,
  singleUse: { enabled: false, isEncrypted: true },
  pin: null,
  visibility: "workspace",
  visibilityVersion: 0,
  visibilityProjectedVersion: 0,
  ...patch,
});

describe("toLinkedSurveyOption", () => {
  test("shows a survey that can still be a Destination as it is", () => {
    expect(toLinkedSurveyOption(survey({ type: "link", status: "paused" }))).toEqual({
      id: "linked",
      name: "Site feedback",
      type: "link",
      status: "paused",
      visibility: "workspace",
    });
  });

  test("keeps an archived survey's archivedAt: it isn't Active, whatever its status", () => {
    const archivedAt = new Date("2026-10-01T00:00:00.000Z");
    expect(toLinkedSurveyOption(survey({ archivedAt })).archivedAt).toBe(archivedAt);
  });

  test("flags a survey that can no longer be a Destination, a pending visibility change included", () => {
    const flagged = [
      survey({ visibility: "restricted" }),
      survey({ visibilityVersion: 2, visibilityProjectedVersion: 1 }),
      survey({ singleUse: { enabled: true, isEncrypted: true } }),
      survey({ pin: "1234" }),
    ].map(toLinkedSurveyOption);

    expect(flagged.map(({ visibility, notAllowed }) => ({ visibility, notAllowed }))).toEqual([
      { visibility: "restricted", notAllowed: true },
      { visibility: "restricted", notAllowed: true },
      { visibility: "workspace", notAllowed: true },
      { visibility: "workspace", notAllowed: true },
    ]);
  });
});
