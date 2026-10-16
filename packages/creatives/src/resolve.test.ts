import { describe, expect, test } from "vitest";
import type {
  TDeviceInfo,
  TShowConditionGroup,
  TShowConditionSingle,
} from "@formbricks/types/show-conditions";
import type { TShowConditionsContext } from "@formbricks/types/show-conditions-evaluate";
import { type TResolveInput, resolve } from "./resolve";
import { DEFAULT_CREATIVE_STYLE } from "./style";
import type { TBannerPayload, TCreativeStyle, TFeedbackButtonPayload } from "./types";

const NOW = Date.parse("2026-10-20T02:00:00.000Z");

const button = (overrides: Partial<TFeedbackButtonPayload> = {}): TFeedbackButtonPayload => ({
  id: "button-1",
  type: "feedbackButton",
  defaultLanguage: "en-US",
  style: DEFAULT_CREATIVE_STYLE,
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
  style: DEFAULT_CREATIVE_STYLE,
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

  test("draws each creative with the style the server computed for it", () => {
    const style: TCreativeStyle = {
      ...DEFAULT_CREATIVE_STYLE,
      element: { ...DEFAULT_CREATIVE_STYLE.element, borderRadius: 2, fontWeight: 400 },
      pageFont: true,
    };

    const result = resolve(input({ creatives: [button({ style })] }));

    expect(result.creatives[0]?.style).toEqual(style);
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
    const desktop: TDeviceInfo = { deviceType: "desktop", browser: "chrome", screenWidth: 1440 };
    const phone: TDeviceInfo = { deviceType: "phone", browser: "safari", screenWidth: 390 };

    const context = (overrides: Partial<TShowConditionsContext> = {}): TShowConditionsContext => ({
      url: "https://example.com/pricing?plan=pro",
      pageReferrer: "",
      visit: { pagesViewed: 3, uniquePagesViewed: 2, timeOnSite: 40, entryReferrer: "", visitedUrls: [] },
      device: desktop,
      ...overrides,
    });

    const onPage = (showConditionsContext: TShowConditionsContext) => ({ now: NOW, showConditionsContext });

    const when = (
      connector: "and" | "or",
      ...conditions: TShowConditionGroup["conditions"]
    ): TShowConditionGroup => ({ id: "group", connector, conditions });

    const urlContains = (value: string): TShowConditionSingle => ({
      id: `url-${value}`,
      leftOperand: { type: "page", value: "currentUrl" },
      operator: "contains",
      rightOperand: { type: "static", value },
    });

    const deviceIsNot = (value: string): TShowConditionSingle => ({
      id: `device-${value}`,
      leftOperand: { type: "device", value: "deviceType" },
      operator: "doesNotEqual",
      rightOperand: { type: "static", value },
    });

    const pagesViewedAtLeast = (value: number): TShowConditionSingle => ({
      id: `pages-${value}`,
      leftOperand: { type: "visit", value: "pagesViewed" },
      operator: "isGreaterThanOrEqual",
      rightOperand: { type: "static", value },
    });

    test("shows the creative on the pages its conditions match, and on no others", () => {
      const onPricing = button({ conditions: when("and", urlContains("/pricing")) });

      expect(shownIds(resolve(input({ creatives: [onPricing], page: onPage(context()) })))).toEqual([
        "button-1",
      ]);
      expect(
        shownIds(
          resolve(
            input({
              creatives: [onPricing],
              page: onPage(context({ url: "https://example.com/blog" })),
            })
          )
        )
      ).toEqual([]);
    });

    test("applies all or any of the conditions, as their group says", () => {
      const all = button({
        id: "all",
        conditions: when("and", urlContains("/pricing"), urlContains("/blog")),
      });
      const any = button({
        id: "any",
        conditions: when("or", urlContains("/pricing"), urlContains("/blog")),
      });

      expect(shownIds(resolve(input({ creatives: [all, any], page: onPage(context()) })))).toEqual(["any"]);
    });

    test("narrows a creative shown on an action too: the action alone isn't enough", () => {
      const onAction = button({
        showOn: "action",
        triggers: ["Checkout"],
        conditions: when("and", urlContains("/checkout")),
      });
      const page = { ...onPage(context()), firedActions: new Set(["Checkout"]) };

      expect(shownIds(resolve(input({ creatives: [onAction], page })))).toEqual([]);
    });

    test("checks the device type the SDK detected, not the window width", () => {
      const notOnPhones = button({ conditions: when("and", deviceIsNot("phone")) });

      // A desktop browser narrowed below the 768 px phone breakpoint is still a desktop.
      const narrowDesktop = context({ device: { ...desktop, screenWidth: 500 } });
      // A phone in landscape is wider than the breakpoint and still a phone.
      const widePhone = context({ device: { ...phone, screenWidth: 900 } });

      expect(shownIds(resolve(input({ creatives: [notOnPhones], page: onPage(narrowDesktop) })))).toEqual([
        "button-1",
      ]);
      expect(shownIds(resolve(input({ creatives: [notOnPhones], page: onPage(widePhone) })))).toEqual([]);
    });

    test("checks the visit, and fails visit conditions when there is no visit to check", () => {
      const returning = button({ conditions: when("and", pagesViewedAtLeast(3)) });

      expect(shownIds(resolve(input({ creatives: [returning], page: onPage(context()) })))).toEqual([
        "button-1",
      ]);
      expect(
        shownIds(resolve(input({ creatives: [returning], page: onPage(context({ visit: null })) })))
      ).toEqual([]);
    });

    test("never shows a creative with conditions when the page gives nothing to check them against", () => {
      const onPricing = button({ conditions: when("and", urlContains("/pricing")) });

      expect(shownIds(resolve(input({ creatives: [onPricing] })))).toEqual([]);
    });

    test("doesn't roll the share of visitors for a creative its conditions hide", () => {
      const rolled: string[] = [];
      resolve(
        input({
          creatives: [button({ displayPercentage: 50, conditions: when("and", urlContains("/blog")) })],
          page: onPage(context()),
          getShareRoll: (creativeId) => {
            rolled.push(creativeId);
            return 0;
          },
        })
      );

      expect(rolled).toEqual([]);
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
