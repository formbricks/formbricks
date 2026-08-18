// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createWebSurveyMetaSnapshot, readBrowserContextMeta } from "./browser-context";

/**
 * A real DOM environment, so these exercise the accessors rather than a mock of them. Each test sets
 * the runtime it wants and restores it afterwards, because a leaked `window.innerWidth` would make
 * the freeze test pass for the wrong reason.
 *
 * happy-dom refuses a cross-origin `replaceState`, so everything runs on the document's own origin.
 */
const ORIGIN = "http://localhost:3000";

const setLocation = (pathAndQuery: string): void => {
  window.history.replaceState({}, "", `${ORIGIN}${pathAndQuery}`);
};

const setDimension = (key: "innerWidth" | "innerHeight", value: unknown): void => {
  Object.defineProperty(window, key, { value, configurable: true, writable: true });
};

const setScreen = (width: number, height: number): void => {
  Object.defineProperty(window, "screen", {
    value: { width, height },
    configurable: true,
    writable: true,
  });
};

const setReferrer = (value: string): void => {
  Object.defineProperty(document, "referrer", { value, configurable: true });
};

let originalScreen: PropertyDescriptor | undefined;
let originalIntl: typeof Intl;

beforeEach(() => {
  originalScreen = Object.getOwnPropertyDescriptor(window, "screen");
  originalIntl = globalThis.Intl;
  setLocation("/pricing");
  setScreen(2560, 1440);
  setDimension("innerWidth", 1280);
  setDimension("innerHeight", 800);
  setReferrer("");
});

afterEach(() => {
  if (originalScreen) Object.defineProperty(window, "screen", originalScreen);
  globalThis.Intl = originalIntl;
  vi.restoreAllMocks();
});

describe("readBrowserContextMeta", () => {
  test("reads the page, viewport and screen the survey was displayed in", () => {
    setLocation("/pricing?plan=team");
    setReferrer("https://news.example.org/weekly");

    const meta = readBrowserContextMeta();

    expect(meta.url).toBe(`${ORIGIN}/pricing?plan=team`);
    expect(meta.pagePath).toBe("/pricing");
    expect(meta.pageReferrer).toBe("https://news.example.org/weekly");
    expect(meta.screenWidth).toBe(2560);
    expect(meta.screenHeight).toBe(1440);
    expect(meta.viewportWidth).toBe(1280);
    expect(meta.viewportHeight).toBe(800);
    // `url` and `source` predate this snapshot and must keep behaving exactly as before.
    expect(meta.url).toBe(`${ORIGIN}/pricing?plan=team`);
  });

  test("parses every utm_* param from the page's own query string", () => {
    setLocation("/p?utm_source=news&utm_medium=email&utm_campaign=august&utm_term=pricing&utm_content=hero");

    expect(readBrowserContextMeta()).toMatchObject({
      utmSource: "news",
      utmMedium: "email",
      utmCampaign: "august",
      utmTerm: "pricing",
      utmContent: "hero",
    });
  });

  test("omits utm params that are absent or empty rather than storing empty strings", () => {
    // `""` and `undefined` are not the same fact: an absent key means "no campaign", while an empty
    // string would show up in exports and filters as a campaign whose name happens to be blank.
    setLocation("/p?utm_source=news&utm_medium=&utm_term=%20");

    const meta = readBrowserContextMeta();

    expect(meta.utmSource).toBe("news");
    expect(meta).not.toHaveProperty("utmMedium");
    expect(meta).not.toHaveProperty("utmTerm");
    expect(meta).not.toHaveProperty("utmCampaign");
    expect(meta).not.toHaveProperty("utmContent");
  });

  test("omits pageReferrer when the respondent arrived directly", () => {
    setReferrer("");

    expect(readBrowserContextMeta()).not.toHaveProperty("pageReferrer");
  });

  test("omits the timezone rather than throwing when the runtime has no Intl API", () => {
    // A privacy build, a locked-down WebView, or a stripped JS engine. Losing one optional
    // analytics field is acceptable; taking the whole survey render down with a TypeError is not.
    // @ts-expect-error -- deliberately modelling a runtime that does not provide Intl.
    globalThis.Intl = undefined;

    const meta = readBrowserContextMeta();

    expect(meta).not.toHaveProperty("timezone");
    // Everything either side of the failed read still made it through.
    expect(meta.pagePath).toBe("/pricing");
    expect(meta.viewportWidth).toBe(1280);
  });

  test("omits the timezone when Intl exists but resolves no zone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({}) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);

    expect(readBrowserContextMeta()).not.toHaveProperty("timezone");
  });

  test("omits dimensions that are missing, zero or not finite", () => {
    // A hidden or not-yet-laid-out document reports 0. Recording it would be indistinguishable from
    // a real measurement of a zero-pixel viewport.
    setDimension("innerWidth", 0);
    setDimension("innerHeight", Number.NaN);
    // @ts-expect-error -- modelling a runtime without `screen`.
    delete window.screen;

    const meta = readBrowserContextMeta();

    expect(meta).not.toHaveProperty("viewportWidth");
    expect(meta).not.toHaveProperty("viewportHeight");
    expect(meta).not.toHaveProperty("screenWidth");
    expect(meta).not.toHaveProperty("screenHeight");
    expect(meta.pagePath).toBe("/pricing");
  });

  test("rounds fractional dimensions, which a zoomed browser reports", () => {
    setDimension("innerWidth", 1279.6);

    expect(readBrowserContextMeta().viewportWidth).toBe(1280);
  });
});

describe("createWebSurveyMetaSnapshot", () => {
  test("freezes the viewport at display: a resize between two submits does not change it", () => {
    // THE acceptance criterion. `getWebSurveyMeta` used to re-read the runtime on every submit
    // (packages/surveys/src/components/general/survey.tsx), so a respondent who rotated a phone
    // between question three and submit silently rewrote the viewport the response reports.
    setDimension("innerWidth", 1280);
    setDimension("innerHeight", 800);

    const getMeta = createWebSurveyMetaSnapshot(true);

    // First submit.
    const firstSubmit = getMeta();
    expect(firstSubmit.viewportWidth).toBe(1280);
    expect(firstSubmit.viewportHeight).toBe(800);

    // The respondent rotates the device / resizes the window mid-survey.
    setDimension("innerWidth", 390);
    setDimension("innerHeight", 844);
    window.dispatchEvent(new Event("resize"));

    // Second submit — same response, so it must still report what was on screen at display.
    const secondSubmit = getMeta();
    expect(secondSubmit.viewportWidth).toBe(1280);
    expect(secondSubmit.viewportHeight).toBe(800);
    // Frozen by identity, not just by value: nothing re-measured and rebuilt the object.
    expect(secondSubmit).toBe(firstSubmit);

    // And a snapshot taken *after* the resize does see the new size — proving the assertion above
    // is the freeze working, not the reader being unable to observe a change at all.
    expect(createWebSurveyMetaSnapshot(true)().viewportWidth).toBe(390);
  });

  test("freezes the page too: a mid-survey pushState does not rewrite the url", () => {
    setLocation("/pricing");

    const getMeta = createWebSurveyMetaSnapshot(true);
    expect(getMeta().pagePath).toBe("/pricing");

    // An SPA navigating underneath an app survey that is already open.
    setLocation("/checkout?step=2");

    expect(getMeta().pagePath).toBe("/pricing");
    expect(getMeta().url).toBe(`${ORIGIN}/pricing`);
  });

  test("captures nothing off the web, where there is no runtime to read", () => {
    // React Native and SSR: `isWebEnvironment` is false and no accessor may run at all.
    expect(createWebSurveyMetaSnapshot(false)()).toStrictEqual({});
  });
});
