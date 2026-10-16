// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { TCreativePayload } from "@formbricks/creatives";
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
      }) as unknown as TConfig,
  } as unknown as Config);
});

afterEach(() => {
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
