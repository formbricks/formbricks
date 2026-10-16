import { describe, expect, test } from "vitest";
import { type TResolveInput, resolve } from "./resolve";
import type { TBannerPayload, TFeedbackButtonPayload } from "./types";

const NOW = Date.parse("2026-10-20T02:00:00.000Z");

const button = (overrides: Partial<TFeedbackButtonPayload> = {}): TFeedbackButtonPayload => ({
  id: "button-1",
  type: "feedbackButton",
  defaultLanguage: "en-US",
  content: { label: { "en-US": "Feedback", "de-DE": "Feedback geben" }, icon: null },
  position: { desktop: { edge: "right", offset: 50 }, phone: null },
  destination: { type: "survey", surveyId: "survey-1", opensAs: "popup" },
  showOn: "pageView",
  triggers: [],
  conditions: null,
  displayPercentage: null,
  startAt: null,
  endAt: null,
  ...overrides,
});

const banner = (overrides: Partial<TBannerPayload> = {}): TBannerPayload => ({
  id: "banner-1",
  type: "banner",
  defaultLanguage: "en-US",
  content: {
    message: { "en-US": [{ text: "Maintenance tonight. " }, { text: "Details", href: "/maintenance" }] },
    button: null,
    dismissible: true,
    accessibleName: null,
  },
  position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
  destination: null,
  showOn: "pageView",
  triggers: [],
  conditions: null,
  displayPercentage: null,
  startAt: null,
  endAt: null,
  ...overrides,
});

const input = (overrides: Partial<TResolveInput> = {}): TResolveInput => ({
  creatives: [button()],
  surveys: [{ id: "survey-1" }],
  page: { now: NOW },
  getShareRoll: () => 0,
  ...overrides,
});

const shownIds = (result: ReturnType<typeof resolve>): string[] => result.creatives.map(({ id }) => id);

describe("resolve", () => {
  test("shows a feedback button on every page view, labelled in its default language", () => {
    const result = resolve(input());

    expect(result.creatives).toEqual([
      expect.objectContaining({
        id: "button-1",
        type: "feedbackButton",
        label: "Feedback",
        position: { desktop: { edge: "right", offset: 50 }, phone: null },
        destination: { type: "survey", surveyId: "survey-1", opensAs: "popup" },
      }),
    ]);
  });

  test("shows a banner as a notice with its message runs and no button", () => {
    const result = resolve(input({ creatives: [banner()] }));

    expect(result.creatives).toEqual([
      expect.objectContaining({
        id: "banner-1",
        type: "banner",
        message: [{ text: "Maintenance tonight. " }, { text: "Details", href: "/maintenance" }],
        buttonLabel: null,
        dismissible: true,
        destination: null,
      }),
    ]);
  });

  describe("schedule", () => {
    test("shows from its start time, to the minute", () => {
      const startsNow = button({ startAt: "2026-10-20T02:00:00.000Z" });
      const startsInAMinute = button({ id: "later", startAt: "2026-10-20T02:01:00.000Z" });

      expect(shownIds(resolve(input({ creatives: [startsNow, startsInAMinute] })))).toEqual(["button-1"]);
    });

    test("is gone at its end time", () => {
      const endsNow = button({ endAt: "2026-10-20T02:00:00.000Z" });
      const endsInAMinute = button({ id: "still-on", endAt: "2026-10-20T02:01:00.000Z" });

      expect(shownIds(resolve(input({ creatives: [endsNow, endsInAMinute] })))).toEqual(["still-on"]);
    });

    test("names the next start or end time still ahead, so the SDK can wake up for it", () => {
      const result = resolve(
        input({
          creatives: [
            button({ id: "a", startAt: "2026-10-20T01:00:00.000Z", endAt: "2026-10-20T04:00:00.000Z" }),
            button({ id: "b", startAt: "2026-10-20T03:00:00.000Z" }),
          ],
        })
      );

      expect(result.nextChangeAt).toBe(Date.parse("2026-10-20T03:00:00.000Z"));
    });

    test("names no next change when nothing is scheduled", () => {
      expect(resolve(input()).nextChangeAt).toBeNull();
    });
  });

  describe("destination", () => {
    test("hides a creative whose popup survey the SDK can't open", () => {
      expect(shownIds(resolve(input({ surveys: [] })))).toEqual([]);
    });

    test("shows a creative that opens a link survey or a link without needing a popup survey", () => {
      const linkSurvey = button({
        id: "link-survey",
        destination: { type: "survey", surveyId: "s2", opensAs: "newTab", url: "https://app.test/s/s2" },
      });
      const link = button({ id: "link", destination: { type: "link", url: "https://example.com" } });

      expect(shownIds(resolve(input({ creatives: [linkSurvey, link], surveys: [] })))).toEqual([
        "link-survey",
        "link",
      ]);
    });

    test("hides a feedback button with nothing to open", () => {
      expect(shownIds(resolve(input({ creatives: [button({ destination: null })] })))).toEqual([]);
    });
  });

  describe("show on", () => {
    test("shows an action creative only once one of its actions fired on the page", () => {
      const onAction = button({ showOn: "action", triggers: ["Checkout"] });

      expect(shownIds(resolve(input({ creatives: [onAction] })))).toEqual([]);
      expect(
        shownIds(
          resolve(input({ creatives: [onAction], page: { now: NOW, firedActions: new Set(["Login"]) } }))
        )
      ).toEqual([]);
      expect(
        shownIds(
          resolve(input({ creatives: [onAction], page: { now: NOW, firedActions: new Set(["Checkout"]) } }))
        )
      ).toEqual(["button-1"]);
    });
  });

  describe("show when", () => {
    const conditions = {
      id: "group",
      connector: "and" as const,
      conditions: [
        {
          id: "c1",
          leftOperand: { type: "page" as const, value: "currentUrl" as const },
          operator: "contains" as const,
          rightOperand: { type: "static" as const, value: "/pricing" },
        },
      ],
    };

    test("hands the conditions to the evaluator and shows the creative only when they pass", () => {
      const withConditions = button({ conditions });
      const seen: unknown[] = [];

      const passing = resolve(
        input({
          creatives: [withConditions],
          passesConditions: (value) => {
            seen.push(value);
            return true;
          },
        })
      );
      const failing = resolve(input({ creatives: [withConditions], passesConditions: () => false }));

      expect(seen).toEqual([conditions]);
      expect(shownIds(passing)).toEqual(["button-1"]);
      expect(shownIds(failing)).toEqual([]);
    });

    test("never shows a creative with conditions when no evaluator is given", () => {
      expect(shownIds(resolve(input({ creatives: [button({ conditions })] })))).toEqual([]);
    });
  });

  describe("share of visitors", () => {
    test("shows the creative to visitors whose roll falls inside the share", () => {
      const half = button({ displayPercentage: 50 });

      expect(shownIds(resolve(input({ creatives: [half], getShareRoll: () => 49.9 })))).toEqual(["button-1"]);
      expect(shownIds(resolve(input({ creatives: [half], getShareRoll: () => 50 })))).toEqual([]);
    });

    test("rolls only for creatives that have a share", () => {
      const rolled: string[] = [];
      resolve(
        input({
          creatives: [button(), button({ id: "half", displayPercentage: 50 })],
          getShareRoll: (creativeId) => {
            rolled.push(creativeId);
            return 0;
          },
        })
      );

      expect(rolled).toEqual(["half"]);
    });
  });

  describe("language", () => {
    test("falls back to the default language text", () => {
      const result = resolve(input({ creatives: [button({ defaultLanguage: "de-DE" })] }));

      expect(result.creatives[0]).toEqual(expect.objectContaining({ label: "Feedback geben" }));
    });
  });
});
