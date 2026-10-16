// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CREATIVE_STYLE, type TCreativePayload } from "@formbricks/creatives";
import { setAppearance } from "@/lib/common/appearance";
import { Config } from "@/lib/common/config";
import { setIsSetup } from "@/lib/common/status";
import { reconcileCreatives, removeCreatives } from "@/lib/creatives/creatives";
import { mockSurvey } from "@/lib/survey/tests/__mocks__/widget.mock";
import { getOpenSurveyIds, openSurveyForCreative } from "@/lib/survey/widget";
import type { TConfig, TWorkspaceStateSurvey } from "@/types/config";

vi.mock("@/lib/survey/widget", () => ({
  getOpenSurveyIds: vi.fn(() => []),
  openSurveyForCreative: vi.fn(() => Promise.resolve()),
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

let state: { creatives: TCreativePayload[]; surveys: TWorkspaceStateSurvey[]; clockOffset?: number };

const shownButtons = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll("[data-formbricks-creative]")).flatMap((host) =>
    Array.from(host.shadowRoot?.querySelectorAll("button") ?? [])
  );

const browserStorage = new Map<string, string>();

beforeAll(() => {
  // vitest.setup.ts swaps window, document and localStorage for hand-rolled mocks; this suite draws
  // into a real (jsdom) DOM. Node's own `localStorage` global shadows jsdom's, so storage is a stand-in.
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => browserStorage.get(key) ?? null,
    setItem: (key: string, value: string) => browserStorage.set(key, value),
    clear: () => browserStorage.clear(),
  });
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  setIsSetup(true);
  state = { creatives: [feedbackButton()], surveys: [mockSurvey] };
  vi.spyOn(Config, "getInstance").mockReturnValue({
    get: () =>
      ({
        workspace: {
          expiresAt: new Date(NOW + 3_600_000),
          clockOffset: state.clockOffset,
          data: { surveys: state.surveys, actionClasses: [], creatives: state.creatives },
        },
      }) as unknown as TConfig,
  } as unknown as Config);
});

afterEach(() => {
  setAppearance("light");
  removeCreatives();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  test("opens a link Destination in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    state.creatives = [feedbackButton({ destination: { type: "link", url: "https://example.com/help" } })];
    reconcileCreatives();

    shownButtons()[0].click();

    expect(open).toHaveBeenCalledWith("https://example.com/help", "_blank", "noopener");
    expect(openSurveyForCreative).not.toHaveBeenCalled();
  });
});
