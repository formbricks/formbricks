import { describe, expect, test } from "vitest";
import { actionIds, makeBanner, makeFeedbackButton } from "./fixtures";
import { buildCreativePreviewText } from "./preview";

describe("buildCreativePreviewText", () => {
  test("names the creative, its kind, status, where it shows and what it opens", () => {
    expect(buildCreativePreviewText(makeFeedbackButton(), null)).toBe(
      'Creative "Pricing tab" (feedback button) is active. Shows on every page view. It opens the survey "Pricing feedback" as a popup.'
    );
  });

  test("a banner with a link, a share of visitors, conditions and a schedule", () => {
    const banner = makeBanner({
      destination: { type: "link", url: "https://example.com/offer", opensAs: "newTab" },
      schedule: { startAt: "2026-10-01T00:00:00.000Z", endAt: "2026-11-15T23:00:00.000Z" },
      distribution: {
        showOn: "pageView",
        triggers: [],
        displayPercentage: 25,
        conditions: { id: "g1", connector: "and", conditions: [] },
      },
    });

    expect(buildCreativePreviewText(banner, null)).toBe(
      'Creative "Autumn banner" (banner) is active. Shows on every page view, to 25% of visitors, where its Show when conditions hold. Runs 2026-10-01T00:00:00.000Z to 2026-11-15T23:00:00.000Z. It opens https://example.com/offer in a new tab.'
    );
  });

  test("one-sided schedules", () => {
    expect(
      buildCreativePreviewText(
        makeBanner({ schedule: { startAt: "2026-10-01T00:00:00.000Z", endAt: null } }),
        null
      )
    ).toContain("Runs from 2026-10-01T00:00:00.000Z.");
    expect(
      buildCreativePreviewText(
        makeBanner({ schedule: { startAt: null, endAt: "2026-11-01T00:00:00.000Z" } }),
        null
      )
    ).toContain("Runs until 2026-11-01T00:00:00.000Z.");
  });

  test.each([
    ["draft", null, "is a draft, not published."],
    ["scheduled", null, "is scheduled, not started yet."],
    ["archived", null, "is archived."],
    ["closed", null, "is closed."],
    ["paused", null, "is paused."],
    ["paused", "surveyNotActive", "is paused with its survey"],
    ["paused", "destinationMissing", "is paused, it needs a destination and has none."],
    ["paused", "actionMissing", "is paused, it shows on an action and has none."],
    ["closed", "scheduleEnded", "is closed, its end time has passed."],
  ] as const)("status %s with reason %s", (displayStatus, displayStatusReason, expected) => {
    expect(buildCreativePreviewText(makeBanner({ displayStatus, displayStatusReason }), null)).toContain(
      expected
    );
  });

  test("action triggers are named when known and counted when not", () => {
    const onAction = makeBanner({
      distribution: {
        showOn: "action",
        triggers: actionIds.map((actionClassId) => ({ actionClassId })),
        conditions: null,
        displayPercentage: null,
      },
    });

    expect(buildCreativePreviewText(onAction, ["Exit intent", "Cart abandoned"])).toContain(
      "Shows when one of these actions fires: Exit intent, Cart abandoned."
    );
    expect(buildCreativePreviewText(onAction, null)).toContain("Shows when one of its 2 actions fires.");
    expect(
      buildCreativePreviewText(
        makeBanner({
          distribution: {
            showOn: "action",
            triggers: [{ actionClassId: actionIds[0] }],
            conditions: null,
            displayPercentage: null,
          },
        }),
        null
      )
    ).toContain("Shows when its action fires.");
    expect(
      buildCreativePreviewText(
        makeBanner({
          distribution: { showOn: "action", triggers: [], conditions: null, displayPercentage: null },
        }),
        null
      )
    ).toContain("Shows when an action fires, but none is set.");
  });

  test("a creative that opens nothing, with its warnings", () => {
    const text = buildCreativePreviewText(
      makeFeedbackButton({
        destination: null,
        warnings: [{ code: "destinationMissing", message: "It needs a Destination." }],
      }),
      null
    );

    expect(text).toContain("It opens nothing.");
    expect(text).toContain("Needs attention: It needs a Destination.");
  });

  test("a survey that opens in a new tab", () => {
    expect(
      buildCreativePreviewText(
        makeFeedbackButton({
          destination: { type: "survey", surveyId: "x", surveyName: "Link survey", opensAs: "newTab" },
        }),
        null
      )
    ).toContain('It opens the survey "Link survey" in a new tab.');
  });
});
