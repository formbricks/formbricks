// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CREATIVE_STYLE, type TBannerPayload, type TCreativePayload } from "@formbricks/creatives";
import type { TShowConditionGroup, TShowConditionSingle } from "@formbricks/types/show-conditions";
import { setAppearance } from "@/lib/common/appearance";
import { Config } from "@/lib/common/config";
import { setIsSetup } from "@/lib/common/status";
import { reconcileCreatives, removeCreatives, showCachedCreatives } from "@/lib/creatives/creatives";
import { trackAction } from "@/lib/survey/action";
import { mockSurvey } from "@/lib/survey/tests/__mocks__/widget.mock";
import {
  getOpenSurveyIds,
  loadFormbricksSurveysExternally,
  openSurveyForCreative,
} from "@/lib/survey/widget";
import { resetDeviceCache } from "@/lib/visit/device";
import { recordNavigation, recordPageLoad } from "@/lib/visit/visit-store";
import type { TConfig, TWorkspaceStateSurvey } from "@/types/config";

vi.mock("@/lib/survey/widget", () => ({
  getOpenSurveyIds: vi.fn(() => []),
  openSurveyForCreative: vi.fn(() => Promise.resolve()),
  loadFormbricksSurveysExternally: vi.fn(() => Promise.resolve({})),
}));

const NOW = Date.parse("2026-10-20T01:59:00.000Z");

const feedbackButton = (overrides: Partial<TCreativePayload> = {}): TCreativePayload =>
  ({
    id: "creative-1",
    type: "feedbackButton",
    defaultLanguage: "en-US",
    style: DEFAULT_CREATIVE_STYLE,
    content: { label: { "en-US": "Feedback" }, icon: null },
    position: { desktop: { edge: "right", offset: 50 }, phone: null },
    destination: { type: "survey", surveyId: mockSurvey.id, opensAs: "popup" },
    showOn: "pageView",
    triggers: [],
    conditions: null,
    displayPercentage: null,
    startAt: null,
    endAt: null,
    ...overrides,
  }) as TCreativePayload;

let state: {
  creatives: TCreativePayload[];
  surveys: TWorkspaceStateSurvey[];
  clockOffset?: number;
  language?: string;
};

const shownButtons = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll("[data-formbricks-creative]")).flatMap((host) =>
    Array.from(host.shadowRoot?.querySelectorAll("button") ?? [])
  );

const browserStorage = new Map<string, string>();

beforeAll(() => {
  // vitest.setup.ts swaps window, document and localStorage for hand-rolled mocks; this suite draws
  // into a real (jsdom) DOM.
  vi.unstubAllGlobals();
});

const sendEvents = vi.fn((_url: string, _init: RequestInit) =>
  Promise.resolve(new Response(null, { status: 204 }))
);

/** The events requests sent so far, with their bodies parsed. */
const sentEvents = () =>
  sendEvents.mock.calls.map(([url, init]) => ({
    url,
    init,
    body: JSON.parse(init.body as string) as unknown,
  }));

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  setIsSetup(true);
  window.history.replaceState({}, "", "/");
  sendEvents.mockClear();
  vi.stubGlobal("fetch", sendEvents);
  // Node's own `localStorage` global shadows jsdom's, so storage is a stand-in.
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => browserStorage.get(key) ?? null,
    setItem: (key: string, value: string) => browserStorage.set(key, value),
    clear: () => browserStorage.clear(),
  });
  state = { creatives: [feedbackButton()], surveys: [mockSurvey] };
  vi.spyOn(Config, "getInstance").mockReturnValue({
    get: () =>
      ({
        appUrl: "https://app.formbricks.test",
        workspaceId: "clws1234567890123456789012",
        workspace: {
          expiresAt: new Date(NOW + 3_600_000),
          clockOffset: state.clockOffset,
          data: { surveys: state.surveys, actionClasses: [], creatives: state.creatives },
        },
        user: { data: { language: state.language } },
      }) as unknown as TConfig,
  } as unknown as Config);
});

afterEach(() => {
  setAppearance("light");
  removeCreatives();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reconcileCreatives", () => {
  test("shows the creatives the cached state delivers", () => {
    reconcileCreatives();

    expect(shownButtons().map((button) => button.textContent)).toEqual(["Feedback"]);
  });

  test("shows nothing before setup", () => {
    setIsSetup(false);

    reconcileCreatives();

    expect(shownButtons()).toEqual([]);
  });

  test("at SDK start, shows the cached state's creatives before setup has refreshed it, schedule applied", () => {
    setIsSetup(false);
    state.creatives = [
      feedbackButton(),
      feedbackButton({ id: "creative-later", startAt: new Date(NOW + 3_600_000).toISOString() }),
    ];

    showCachedCreatives();

    expect(document.querySelectorAll("[data-formbricks-creative]")).toHaveLength(1);
    expect(document.querySelector('[data-formbricks-creative="creative-1"]')).not.toBeNull();
  });

  test("leaves a creative that is still shown in place on the next page view", () => {
    reconcileCreatives();
    const [button] = shownButtons();
    button.focus();

    reconcileCreatives();

    expect(shownButtons()).toEqual([button]);
    expect(button.isConnected).toBe(true);
  });

  test("takes a creative off the page once a refreshed state no longer delivers it", () => {
    reconcileCreatives();
    state.creatives = [];

    reconcileCreatives();

    expect(shownButtons()).toEqual([]);
  });

  test("puts a creative back when the page removed it", () => {
    reconcileCreatives();
    document.body.replaceChildren();

    reconcileCreatives();

    expect(shownButtons()).toHaveLength(1);
  });

  test("appears at its start time and goes at its end time, to the minute", async () => {
    state.creatives = [
      feedbackButton({ startAt: "2026-10-20T02:00:00.000Z", endAt: "2026-10-20T04:00:00.000Z" }),
    ];

    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(shownButtons()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(shownButtons()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2 * 3_600_000 - 1);
    expect(shownButtons()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(shownButtons()).toHaveLength(0);
  });

  test("keeps the schedule on the server's clock when the device clock is off", () => {
    // The device reads 01:49 while the server already reads 01:59... and the state says 10 min.
    state.clockOffset = 10 * 60_000;
    state.creatives = [feedbackButton({ startAt: "2026-10-20T02:05:00.000Z" })];

    reconcileCreatives();

    expect(shownButtons()).toHaveLength(1);
  });

  test("rolls the share of visitors once and keeps it in the browser", () => {
    state.creatives = [feedbackButton({ displayPercentage: 50 })];

    reconcileCreatives();

    const rolls = JSON.parse(window.localStorage.getItem("formbricks-creative-share") ?? "{}") as Record<
      string,
      number
    >;
    expect(Object.keys(rolls)).toEqual(["creative-1"]);
    expect(shownButtons()).toHaveLength(rolls["creative-1"] < 50 ? 1 : 0);
  });
});

/** ENG-4002: Show on, and Show when checked against this page, this visit and this device. */
describe("show on and show when", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const MAC_CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  const when = (condition: TShowConditionSingle): TShowConditionGroup => ({
    id: "group",
    connector: "and",
    conditions: [condition],
  });

  const urlContains = (value: string): TShowConditionSingle => ({
    id: "url",
    leftOperand: { type: "page", value: "currentUrl" },
    operator: "contains",
    rightOperand: { type: "static", value },
  });

  const visitStorage = new Map<string, string>();

  beforeEach(() => {
    resetDeviceCache();
    visitStorage.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => visitStorage.get(key) ?? null,
      setItem: (key: string, value: string) => visitStorage.set(key, value),
    });
  });

  const onDevice = (userAgent: string): void => {
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints: 0 });
  };

  test("checks Show when on every page view, against the page's own URL", () => {
    state.creatives = [feedbackButton({ conditions: when(urlContains("/pricing")) })];

    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);

    window.history.pushState({}, "", "/pricing?plan=pro");
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(1);

    window.history.pushState({}, "", "/blog");
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);
  });

  test("checks the device type the SDK detects, however wide the window is", () => {
    state.creatives = [
      feedbackButton({
        conditions: when({
          id: "device",
          leftOperand: { type: "device", value: "deviceType" },
          operator: "doesNotEqual",
          rightOperand: { type: "static", value: "phone" },
        }),
      }),
    ];
    // jsdom's window is 1024 px wide: past the 768 px phone breakpoint either way.
    onDevice(IPHONE);
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);

    resetDeviceCache();
    onDevice(MAC_CHROME);
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(1);
  });

  test("checks visit conditions against this tab's visit", () => {
    state.creatives = [
      feedbackButton({
        conditions: when({
          id: "pages",
          leftOperand: { type: "visit", value: "pagesViewed" },
          operator: "isGreaterThanOrEqual",
          rightOperand: { type: "static", value: 2 },
        }),
      }),
    ];
    recordPageLoad("/", "");

    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);

    window.history.pushState({}, "", "/plans");
    recordNavigation("/plans");
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(1);
  });

  test("shows a creative on an action once that action fires on the page, until the next page", async () => {
    state.creatives = [feedbackButton({ showOn: "action", triggers: ["Started checkout"] })];

    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);

    await trackAction("Opened pricing");
    expect(shownButtons()).toHaveLength(0);

    await trackAction("Started checkout");
    expect(shownButtons()).toHaveLength(1);

    // A query or hash change is the same page; a new path is the next page view.
    window.history.pushState({}, "", "/?step=2#billing");
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(1);

    window.history.pushState({}, "", "/thank-you");
    reconcileCreatives();
    expect(shownButtons()).toHaveLength(0);
  });

  test("still applies Show when to a creative its action showed", async () => {
    state.creatives = [
      feedbackButton({
        showOn: "action",
        triggers: ["Started checkout"],
        conditions: when(urlContains("/checkout")),
      }),
    ];

    await trackAction("Started checkout");
    expect(shownButtons()).toHaveLength(0);

    window.history.pushState({}, "", "/checkout");
    reconcileCreatives();
    await trackAction("Started checkout");
    expect(shownButtons()).toHaveLength(1);
  });
});

/** ENG-3998: a creative follows the survey's appearance, which the host sets with setAppearance. */
describe("appearance", () => {
  const appearanceOf = (): string | null => shownButtons()[0]?.getAttribute("data-appearance") ?? null;

  test("draws in the appearance the host set, and redraws when it changes", () => {
    setAppearance("dark");
    reconcileCreatives();
    expect(appearanceOf()).toBe("dark");

    setAppearance("light");
    reconcileCreatives();
    expect(appearanceOf()).toBe("light");
  });

  test("with system, follows the visitor's setting and switches with it", () => {
    let listener: (() => void) | undefined;
    const scheme = {
      matches: true,
      addEventListener: (_type: string, callback: () => void) => {
        listener = callback;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => scheme)
    );

    setAppearance("system");
    reconcileCreatives();
    expect(appearanceOf()).toBe("dark");

    scheme.matches = false;
    listener?.();
    expect(appearanceOf()).toBe("light");
  });
});

describe("language (ENG-4003)", () => {
  const english = { default: true, enabled: true, language: { code: "en-US", alias: null } };
  const german = { default: false, enabled: true, language: { code: "de-DE", alias: null } };
  // As the server precomputes `en-US` (default) and `de-DE` for the page.
  const englishAndGerman = {
    keys: { "en-us": "default", en: "default", "de-de": "de-DE", de: "de-DE" },
    bases: { en: "default", de: "de-DE" },
  };
  const bilingualButton = feedbackButton({
    languages: [english, german],
    languageMatch: englishAndGerman,
    surveyLanguageMatch: englishAndGerman,
    content: { label: { "en-US": "Feedback", "de-DE": "Feedback geben" }, icon: null },
  });

  beforeEach(() => {
    vi.mocked(loadFormbricksSurveysExternally).mockClear();
  });

  test("labels a creative in the language the site set", () => {
    state = { creatives: [bilingualButton], surveys: [mockSurvey], language: "de-DE" };

    reconcileCreatives();

    expect(shownButtons().map((button) => button.textContent)).toEqual(["Feedback geben"]);
    expect(loadFormbricksSurveysExternally).not.toHaveBeenCalled();
  });

  test("decides a regional variant on the page at once, without loading the surveys bundle", () => {
    state = { creatives: [bilingualButton], surveys: [mockSurvey], language: "de-AT" };

    reconcileCreatives();

    // Drawn once, in German: `de-AT` reaches the creative's and its survey's `de-DE` with nothing to load.
    expect(shownButtons().map((button) => button.textContent)).toEqual(["Feedback geben"]);
    expect(loadFormbricksSurveysExternally).not.toHaveBeenCalled();
  });

  test("hides a creative at once when its survey lacks the language the site set", () => {
    state = { creatives: [bilingualButton], surveys: [mockSurvey], language: "fr-FR" };

    reconcileCreatives();

    expect(shownButtons()).toEqual([]);
    expect(loadFormbricksSurveysExternally).not.toHaveBeenCalled();
  });
});

describe("pressing a creative", () => {
  test("opens its popup survey through the click path, closing whatever survey is open", () => {
    vi.mocked(getOpenSurveyIds).mockReturnValue(["other-survey"]);
    reconcileCreatives();

    shownButtons()[0].click();

    expect(openSurveyForCreative).toHaveBeenCalledWith(mockSurvey, "creative-1", ["other-survey"]);
  });

  test("does nothing while its own survey is open", () => {
    vi.mocked(getOpenSurveyIds).mockReturnValue([mockSurvey.id]);
    reconcileCreatives();

    shownButtons()[0].click();

    expect(openSurveyForCreative).not.toHaveBeenCalled();
  });

  test("leaves a feedback button on the page after it opened its survey, through the answer and the next page view", () => {
    vi.mocked(getOpenSurveyIds).mockReturnValue([]);
    reconcileCreatives();
    const host = document.querySelector("[data-formbricks-creative]");

    shownButtons()[0].click();
    // The survey is open, then answered and closed; the state refreshes, then the next page.
    vi.mocked(getOpenSurveyIds).mockReturnValue([mockSurvey.id]);
    reconcileCreatives();
    vi.mocked(getOpenSurveyIds).mockReturnValue([]);
    reconcileCreatives();
    window.history.pushState({}, "", "/thanks");
    reconcileCreatives();

    expect(openSurveyForCreative).toHaveBeenCalledTimes(1);
    expect(host?.isConnected).toBe(true);
    expect(shownButtons()).toHaveLength(1);
  });

  test("opens a link Destination in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    state.creatives = [feedbackButton({ destination: { type: "link", url: "https://example.com/help" } })];
    reconcileCreatives();

    shownButtons()[0].click();

    expect(open).toHaveBeenCalledWith("https://example.com/help", "_blank", "noopener");
    expect(openSurveyForCreative).not.toHaveBeenCalled();
  });
});

describe("banners (ENG-3576)", () => {
  const banner = (
    id: string,
    {
      placement = "top",
      layout = "inPage",
      ...overrides
    }: Partial<TBannerPayload> & {
      placement?: "top" | "bottom";
      layout?: "inPage" | "overlay";
    } = {}
  ): TCreativePayload =>
    ({
      ...feedbackButton(),
      id,
      type: "banner",
      content: {
        message: { "en-US": [{ text: `Notice ${id}` }] },
        button: null,
        dismissible: true,
        accessibleName: null,
      },
      labels: { siteNotice: { "en-US": "Site notice" }, dismiss: { "en-US": "Dismiss" } },
      position: { desktop: { placement, layout }, phone: null },
      destination: null,
      ...overrides,
    }) as TCreativePayload;

  const bannerHosts = (): Element[] =>
    Array.from(document.querySelectorAll("[data-formbricks-creative]")).filter((host) =>
      host.shadowRoot?.querySelector(".fb-creative-banner")
    );

  const hostOf = (id: string): HTMLElement => {
    const host = document.querySelector<HTMLElement>(`[data-formbricks-creative="${id}"]`);
    if (!host) throw new Error(`${id} is not on the page`);
    return host;
  };

  const controlOf = (id: string, selector: string): HTMLElement => {
    const control = hostOf(id).shadowRoot?.querySelector<HTMLElement>(selector);
    if (!control) throw new Error(`${id} has no ${selector}`);
    return control;
  };

  beforeEach(() => {
    document.body.replaceChildren(document.createElement("main"));
  });

  test("puts In page banners at the top of the page, newest on top, whatever order they arrive in", () => {
    // The payload lists creatives newest first.
    state.creatives = [banner("newer"), banner("older")];
    reconcileCreatives();

    expect(document.body.firstElementChild).toBe(hostOf("newer"));
    expect(bannerHosts().map((host) => host.getAttribute("data-formbricks-creative"))).toEqual([
      "newer",
      "older",
    ]);

    state.creatives = [banner("newest"), banner("newer"), banner("middle"), banner("older")];
    reconcileCreatives();

    expect(bannerHosts().map((host) => host.getAttribute("data-formbricks-creative"))).toEqual([
      "newest",
      "newer",
      "middle",
      "older",
    ]);
    expect(bannerHosts()[3].nextElementSibling?.tagName).toBe("MAIN");
  });

  describe("Overlay banners", () => {
    /** Bars as tall as their message says (jsdom lays nothing out): `Notice <id>` is 40 px, … */
    let barHeights: Record<string, number>;

    beforeEach(() => {
      barHeights = {};
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement
      ) {
        const id = this.textContent.replace("Notice ", "");
        return {
          height: this.classList.contains("fb-creative-banner") ? (barHeights[id] ?? 40) : 0,
        } as DOMRect;
      });
    });

    const insetsOf = (id: string) => ({
      top: hostOf(id).style.getPropertyValue("--fb-creative-top"),
      bottom: hostOf(id).style.getPropertyValue("--fb-creative-bottom"),
    });

    test("stack below the newer ones on their edge, and feedback buttons keep clear of all of them", () => {
      barHeights = { "top-new": 40, "top-old": 64, bottom: 52 };
      state.creatives = [
        banner("top-new", { layout: "overlay" }),
        feedbackButton(),
        banner("bottom", { placement: "bottom", layout: "overlay" }),
        banner("in-page"),
        banner("top-old", { layout: "overlay" }),
      ];

      reconcileCreatives();

      expect(insetsOf("top-new").top).toBe("0px");
      expect(insetsOf("top-old").top).toBe("40px");
      expect(insetsOf("bottom").bottom).toBe("0px");
      expect(insetsOf("creative-1")).toEqual({ top: "104px", bottom: "52px" });
    });

    test("restack when a banner's size changes, on the edge the viewport puts it", () => {
      let onResize: (() => void) | undefined;
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            onResize = callback;
          }
          observe = vi.fn();
          disconnect = vi.fn();
        }
      );
      const phone = { matches: false };
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => phone)
      );
      state.creatives = [
        banner("first", {
          layout: "overlay",
          position: {
            desktop: { placement: "top", layout: "overlay" },
            phone: { placement: "bottom", layout: "overlay" },
          },
        }),
        feedbackButton(),
      ];
      reconcileCreatives();
      expect(insetsOf("creative-1")).toEqual({ top: "40px", bottom: "0px" });

      // The window narrows below 768 px: the bar wraps onto two lines and moves to the bottom.
      phone.matches = true;
      barHeights = { first: 80 };
      onResize?.();

      expect(insetsOf("first").bottom).toBe("0px");
      expect(insetsOf("creative-1")).toEqual({ top: "0px", bottom: "80px" });
    });
  });

  describe("Dismiss", () => {
    const shownIds = (): (string | null)[] =>
      bannerHosts().map((host) => host.getAttribute("data-formbricks-creative"));

    test("closes the banner on that page only, and remembers nothing", () => {
      state.creatives = [banner("notice"), banner("other")];
      reconcileCreatives();

      controlOf("notice", "[aria-label=Dismiss]").click();
      expect(shownIds()).toEqual(["other"]);

      // A state refresh, a schedule boundary or a same-page URL change keeps it closed…
      window.history.replaceState({}, "", "/?tab=2#faq");
      reconcileCreatives();
      expect(shownIds()).toEqual(["other"]);
      expect(window.localStorage.getItem("formbricks-creative-share")).toBeNull();

      // …and the next page view, a single-page-app route change included, shows it again.
      window.history.pushState({}, "", "/pricing");
      reconcileCreatives();
      expect(shownIds()).toEqual(["notice", "other"]);
    });

    test("is not a Click", async () => {
      state.creatives = [banner("notice")];
      reconcileCreatives();

      controlOf("notice", "[aria-label=Dismiss]").click();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(sentEvents()[0].body).toMatchObject({ events: [{ creativeId: "notice", type: "impression" }] });
    });
  });

  const bannerWithButton = (dismissible: boolean) =>
    banner("notice", {
      content: {
        message: { "en-US": [{ text: "Open Enrollment ends Dec 15." }] },
        button: { label: { "en-US": "See plans" } },
        dismissible,
        accessibleName: null,
      },
      destination: { type: "link", url: "https://example.com/plans" },
    });

  test("its button opens the Destination, counts a Click, and closes a dismissible banner on that page", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    state.creatives = [bannerWithButton(true)];
    reconcileCreatives();

    controlOf("notice", ".fb-creative-banner-button").click();

    expect(open).toHaveBeenCalledWith("https://example.com/plans", "_blank", "noopener");
    expect(bannerHosts()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sentEvents()[0].body).toMatchObject({
      events: [
        { creativeId: "notice", type: "impression" },
        { creativeId: "notice", type: "click" },
      ],
    });
  });

  test("its button leaves a banner that can't be dismissed in place, so a critical notice stays", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    state.creatives = [bannerWithButton(false)];
    reconcileCreatives();

    controlOf("notice", ".fb-creative-banner-button").click();
    reconcileCreatives();

    expect(open).toHaveBeenCalledTimes(1);
    expect(bannerHosts()).toHaveLength(1);
  });
});

describe("counting Impressions and Clicks", () => {
  const EVENTS_URL = "https://app.formbricks.test/api/v2/client/clws1234567890123456789012/creatives/events";

  test("sends one Impression per creative and page view, as one keepalive text/plain request 2 s later", async () => {
    state.creatives = [feedbackButton(), feedbackButton({ id: "creative-2" })];
    reconcileCreatives();
    reconcileCreatives();

    await vi.advanceTimersByTimeAsync(1_999);
    expect(sendEvents).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(sentEvents()).toHaveLength(1);
    expect(sentEvents()[0].init).toMatchObject({
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "text/plain" },
    });
    expect(sentEvents().map(({ url, body }) => ({ url, body }))).toEqual([
      {
        url: EVENTS_URL,
        body: {
          page: "localhost:3000/",
          deviceType: "desktop",
          events: [
            { creativeId: "creative-1", type: "impression" },
            { creativeId: "creative-2", type: "impression" },
          ],
        },
      },
    ]);

    // Shown again on the same page, by a refresh or a schedule boundary: no second Impression.
    reconcileCreatives();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sendEvents).toHaveBeenCalledOnce();
  });

  test("counts a new Impression on a new page, a route change included, and sends the last page's events first", async () => {
    reconcileCreatives();

    window.history.pushState({}, "", "/pricing?plan=pro#faq");
    reconcileCreatives();
    expect(sentEvents().map(({ body }) => body)).toEqual([
      expect.objectContaining({
        page: "localhost:3000/",
        events: [{ creativeId: "creative-1", type: "impression" }],
      }),
    ]);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(sentEvents().map(({ body }) => body)).toEqual([
      expect.objectContaining({ page: "localhost:3000/" }),
      expect.objectContaining({
        page: "localhost:3000/pricing",
        events: [{ creativeId: "creative-1", type: "impression" }],
      }),
    ]);
  });

  test("counts a Click for each press that opens the Destination, and none for a press on its open survey", async () => {
    vi.mocked(getOpenSurveyIds).mockReturnValue([]);
    reconcileCreatives();
    shownButtons()[0].click();
    shownButtons()[0].click();
    vi.mocked(getOpenSurveyIds).mockReturnValue([mockSurvey.id]);
    shownButtons()[0].click();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(sentEvents()[0].body).toMatchObject({
      events: [
        { creativeId: "creative-1", type: "impression" },
        { creativeId: "creative-1", type: "click" },
        { creativeId: "creative-1", type: "click" },
      ],
    });
  });

  test("sends what is waiting as soon as the page is hidden", () => {
    reconcileCreatives();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

    expect(sendEvents).toHaveBeenCalledOnce();
  });

  test("never lets a failed request reach the page", async () => {
    sendEvents.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    reconcileCreatives();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(sendEvents).toHaveBeenCalledOnce();
  });
});
