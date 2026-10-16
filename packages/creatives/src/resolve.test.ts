import { describe, expect, test } from "vitest";
import { type TResolveInput, resolve } from "./resolve";
import { DEFAULT_CREATIVE_STYLE } from "./style";
import type { TBannerPayload, TCreativeLanguage, TCreativeStyle, TFeedbackButtonPayload } from "./types";

const NOW = Date.parse("2026-10-20T02:00:00.000Z");

const language = (code: string, { isDefault = false, enabled = true, alias = null as string | null } = {}) =>
  ({ default: isDefault, enabled, language: { code, alias } }) satisfies TCreativeLanguage;

const button = (overrides: Partial<TFeedbackButtonPayload> = {}): TFeedbackButtonPayload => ({
  id: "button-1",
  type: "feedbackButton",
  defaultLanguage: "en-US",
  languages: [language("en-US", { isDefault: true }), language("de-DE")],
  autoSelectLanguage: false,
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
  languages: [language("en-US", { isDefault: true })],
  autoSelectLanguage: false,
  style: DEFAULT_CREATIVE_STYLE,
  content: {
    message: { "en-US": [{ text: "Maintenance tonight. " }, { text: "Details", href: "/maintenance" }] },
    button: null,
    dismissible: true,
    accessibleName: null,
  },
  labels: { siteNotice: { "en-US": "Site notice" }, dismiss: { "en-US": "Dismiss" } },
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
    const visitor = (explicit: string | null, browser: string[] = []) => ({
      now: NOW,
      language: { explicit, browser },
    });
    const labels = (result: ReturnType<typeof resolve>) =>
      result.creatives.map((view) => (view.type === "feedbackButton" ? view.label : view.message));

    test("shows the texts in the language the site set", () => {
      expect(labels(resolve(input({ page: visitor("de-DE") })))).toEqual(["Feedback geben"]);
    });

    test("shows the default language when the site set none", () => {
      expect(labels(resolve(input({ page: visitor(null) })))).toEqual(["Feedback"]);
      expect(labels(resolve(input()))).toEqual(["Feedback"]);
    });

    test("matches the language the site set by alias, ignoring case", () => {
      const aliased = button({
        languages: [language("en-US", { isDefault: true }), language("de-DE", { alias: "german" })],
      });

      expect(labels(resolve(input({ creatives: [aliased], page: visitor("German") })))).toEqual([
        "Feedback geben",
      ]);
      expect(labels(resolve(input({ page: visitor("DE-de") })))).toEqual(["Feedback geben"]);
    });

    describe("falls back to the default language instead of hiding the creative", () => {
      test("when the creative lacks the visitor's language", () => {
        expect(labels(resolve(input({ page: visitor("fr-FR") })))).toEqual(["Feedback"]);
      });

      test("when the visitor's language is disabled", () => {
        const disabled = button({
          languages: [language("en-US", { isDefault: true }), language("de-DE", { enabled: false })],
        });

        expect(labels(resolve(input({ creatives: [disabled], page: visitor("de-DE") })))).toEqual([
          "Feedback",
        ]);
      });

      test("text by text, when one translation is missing or empty", () => {
        const partlyTranslated = banner({
          languages: [language("en-US", { isDefault: true }), language("de-DE")],
          content: {
            message: { "en-US": [{ text: "Down tonight." }], "de-DE": [{ text: " " }] },
            button: { label: { "en-US": "Status", "de-DE": "Statusseite" } },
            dismissible: true,
            accessibleName: { "en-US": "Service notice", "de-DE": "" },
          },
          destination: { type: "link", url: "https://example.com/status" },
        });

        expect(resolve(input({ creatives: [partlyTranslated], page: visitor("de-DE") })).creatives).toEqual([
          expect.objectContaining({
            message: [{ text: "Down tonight." }],
            buttonLabel: "Statusseite",
            accessibleName: "Service notice",
          }),
        ]);
      });
    });

    test("uses the browser's languages, in order, only when its survey uses browser language", () => {
      const followsBrowser = button({ autoSelectLanguage: true });
      const browser = ["fr-FR", "de-DE"];

      expect(labels(resolve(input({ creatives: [followsBrowser], page: visitor(null, browser) })))).toEqual([
        "Feedback geben",
      ]);
      expect(labels(resolve(input({ page: visitor(null, browser) })))).toEqual(["Feedback"]);
    });

    test("prefers the language the site set over the browser's", () => {
      const followsBrowser = button({ autoSelectLanguage: true });

      expect(
        labels(resolve(input({ creatives: [followsBrowser], page: visitor("en-US", ["de-DE"]) })))
      ).toEqual(["Feedback"]);
    });

    test("names the banner region and its Dismiss control in the visitor's language", () => {
      const german = banner({
        languages: [language("en-US", { isDefault: true }), language("de-DE")],
        content: {
          message: { "en-US": [{ text: "Down tonight." }], "de-DE": [{ text: "Heute Nacht offline." }] },
          button: null,
          dismissible: true,
          accessibleName: null,
        },
        labels: {
          siteNotice: { "en-US": "Site notice", "de-DE": "Website-Hinweis" },
          dismiss: { "en-US": "Dismiss", "de-DE": "Schließen" },
        },
      });

      expect(resolve(input({ creatives: [german], page: visitor("de-DE") })).creatives).toEqual([
        expect.objectContaining({ accessibleName: "Website-Hinweis", dismissLabel: "Schließen" }),
      ]);
      expect(resolve(input({ creatives: [german], page: visitor("fr-FR") })).creatives).toEqual([
        expect.objectContaining({ accessibleName: "Site notice", dismissLabel: "Dismiss" }),
      ]);
    });

    describe("hides a creative whose popup survey the visitor's language would skip", () => {
      const multilingual = {
        id: "survey-1",
        languages: [language("en-US", { isDefault: true }), language("de-DE", { alias: "de" })],
      };

      test("when the survey lacks the language the site set", () => {
        const surveys = [multilingual];

        expect(shownIds(resolve(input({ surveys, page: visitor("fr-FR") })))).toEqual([]);
        expect(shownIds(resolve(input({ surveys, page: visitor("de") })))).toEqual(["button-1"]);
      });

      test("but not when the survey has a single language, which the SDK never skips", () => {
        const surveys = [{ id: "survey-1", languages: [language("en-US", { isDefault: true })] }];

        expect(shownIds(resolve(input({ surveys, page: visitor("fr-FR") })))).toEqual(["button-1"]);
      });

      test("but not for the browser's languages, which fall back to the survey's default", () => {
        const surveys = [{ ...multilingual, autoSelectLanguage: true }];

        expect(shownIds(resolve(input({ surveys, page: visitor(null, ["fr-FR"]) })))).toEqual(["button-1"]);
      });

      test("but not for a link survey, whose link page falls back to its default", () => {
        const linkSurvey = button({
          destination: { type: "survey", surveyId: "s2", opensAs: "newTab", url: "https://app.test/s/s2" },
        });

        expect(
          shownIds(resolve(input({ creatives: [linkSurvey], surveys: [], page: visitor("fr-FR") })))
        ).toEqual(["button-1"]);
      });
    });

    test("opens a link survey in the language the site set, leaving plain links untouched", () => {
      const linkSurvey = button({
        destination: { type: "survey", surveyId: "s2", opensAs: "newTab", url: "https://app.test/s/s2" },
      });
      const link = button({ id: "link", destination: { type: "link", url: "https://example.com/help" } });

      const destinations = (page: TResolveInput["page"]) =>
        resolve(input({ creatives: [linkSurvey, link], page })).creatives.map((view) => view.destination);

      expect(destinations(visitor("fr-FR"))).toEqual([
        { type: "survey", surveyId: "s2", opensAs: "newTab", url: "https://app.test/s/s2?lang=fr-FR" },
        { type: "link", url: "https://example.com/help" },
      ]);
      expect(destinations(visitor(null, ["fr-FR"]))[0]).toEqual(
        expect.objectContaining({ url: "https://app.test/s/s2" })
      );
    });

    describe("without the full matcher (the surveys bundle not loaded yet)", () => {
      test("says the choice is pending when no code or alias matches exactly", () => {
        const surveys = [
          { id: "survey-1", languages: [language("en-US", { isDefault: true }), language("de-DE")] },
        ];
        const result = resolve(input({ surveys, page: visitor("de-AT") }));

        // Hidden until the full matcher says whether `de-AT` reaches `de-DE`.
        expect(shownIds(result)).toEqual([]);
        expect(result.languagePending).toBe(true);
      });

      test("is settled when the language the site set matches exactly", () => {
        expect(resolve(input({ page: visitor("de-DE") })).languagePending).toBe(false);
      });

      test("is settled when the first browser language matches exactly, pending when a later one does", () => {
        const followsBrowser = button({ autoSelectLanguage: true });

        expect(
          resolve(input({ creatives: [followsBrowser], page: visitor(null, ["de-DE", "en-GB"]) }))
            .languagePending
        ).toBe(false);
        expect(
          resolve(input({ creatives: [followsBrowser], page: visitor(null, ["en-GB", "de-DE"]) }))
            .languagePending
        ).toBe(true);
      });

      test("is settled for a creative and survey with one language each", () => {
        const surveys = [{ id: "survey-1", languages: [] }];
        const singleLanguage = button({ languages: [language("en-US", { isDefault: true })] });

        expect(
          resolve(input({ creatives: [singleLanguage], surveys, page: visitor("de-AT") })).languagePending
        ).toBe(false);
      });
    });

    test("uses the full matcher when given, for the survey and the creative alike", () => {
      const surveys = [
        { id: "survey-1", languages: [language("en-US", { isDefault: true }), language("de-DE")] },
      ];
      const seen: unknown[] = [];
      // Stands in for the surveys bundle's `resolveSurveyLanguage`: `de-AT` reaches `de-DE` by base language.
      const resolveLanguage: TResolveInput["resolveLanguage"] = (request) => {
        seen.push(request);
        return request.explicitLanguage === "de-AT" ? "de-DE" : "default";
      };

      const result = resolve(input({ surveys, page: visitor("de-AT"), resolveLanguage }));

      expect(labels(result)).toEqual(["Feedback geben"]);
      expect(result.languagePending).toBe(false);
      expect(seen).toEqual([
        expect.objectContaining({ explicitLanguage: "de-AT", unmatchedExplicitLanguage: "skip" }),
        expect.objectContaining({ explicitLanguage: "de-AT", unmatchedExplicitLanguage: "fallback" }),
      ]);
    });
  });
});
