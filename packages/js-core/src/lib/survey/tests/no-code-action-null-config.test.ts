import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { trackNoCodeAction } from "@/lib/survey/action";
import {
  addClickEventListener,
  addExitIntentListener,
  addPageUrlEventListeners,
  addScrollDepthListener,
  checkPageUrl,
  removeClickEventListener,
  removeExitIntentListener,
  removePageUrlEventListeners,
  removeScrollDepthListener,
  setIsHistoryPatched,
} from "@/lib/survey/no-code-action";

// The listeners outlive the config: `resetConfig()` nulls it while they stay attached, and `get()` then
// throws this (ENG-6775).
vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(() => {
        throw new Error("config is null, maybe the init function was not called?");
      }),
    })),
  },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: { getInstance: vi.fn(() => ({ debug: vi.fn(), error: vi.fn() })) },
}));

vi.mock("@/lib/survey/action", () => ({ trackNoCodeAction: vi.fn() }));
vi.mock("@/lib/survey/widget", () => ({ setIsSurveyRunning: vi.fn() }));
vi.mock("@/lib/common/status", () => ({ checkSetup: vi.fn(() => ({ ok: true })) }));
vi.mock("@/lib/creatives/creatives", () => ({ reconcileCreatives: vi.fn() }));

type TListener = (event?: unknown) => void;

/** Event name → the listener the SDK attached, from stubbed `window`, `document` and `body`. */
const listeners = new Map<string, TListener>();
const record = (event: string, listener: TListener): void => {
  listeners.set(event, listener);
};

/** Fires a listener the way the DOM does (a void call) and collects any rejection it leaves behind. */
const fire = async (event: string, payload?: unknown): Promise<unknown[]> => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onRejection);
  try {
    const listener = listeners.get(event);
    expect(listener).toBeDefined();
    listener?.(payload);
    // Unhandled rejections are reported after the microtask queue drains.
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    process.off("unhandledRejection", onRejection);
  }
  return rejections;
};

describe("no-code listeners with no config", () => {
  beforeEach(() => {
    listeners.clear();
    vi.stubGlobal("window", {
      addEventListener: record,
      removeEventListener: vi.fn(),
      location: { href: "https://example.com/pricing" },
      scrollY: 1000,
      innerHeight: 500,
    });
    vi.stubGlobal("history", { pushState: vi.fn(), replaceState: vi.fn() });
    vi.stubGlobal("document", {
      readyState: "complete",
      documentElement: { scrollHeight: 2000 },
      addEventListener: record,
      removeEventListener: vi.fn(),
      querySelector: () => ({ addEventListener: record }),
    });
    setIsHistoryPatched(true);
  });

  afterEach(() => {
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("checkPageUrl resolves without tracking instead of rejecting", async () => {
    await expect(checkPageUrl()).resolves.toEqual({ ok: true, data: undefined });
    expect(Config.getInstance).toHaveBeenCalled();
    expect(trackNoCodeAction).not.toHaveBeenCalled();
  });

  test("a route change leaves no unhandled rejection", async () => {
    addPageUrlEventListeners();
    expect(await fire("popstate")).toEqual([]);
  });

  test("a click leaves no unhandled rejection", async () => {
    addClickEventListener();
    expect(await fire("click", { target: {} })).toEqual([]);
  });

  test("an exit intent leaves no unhandled rejection", async () => {
    addExitIntentListener();
    expect(await fire("mouseleave", { clientY: 0 })).toEqual([]);
  });

  test("scrolling past half the page leaves no unhandled rejection", async () => {
    addScrollDepthListener();
    expect(await fire("scroll")).toEqual([]);
  });
});
