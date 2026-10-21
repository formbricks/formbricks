import { beforeEach, describe, expect, test, vi } from "vitest";
import { recordNavigation, recordPageHide, recordPageLoad, recordPathReplace } from "@/lib/visit/visit-store";

vi.mock("@/lib/visit/visit-store", () => ({
  recordPageLoad: vi.fn(),
  recordNavigation: vi.fn(),
  recordPathReplace: vi.fn(),
  recordPageHide: vi.fn(),
  getVisitSnapshot: vi.fn(() => null),
}));

vi.mock("@/lib/common/debug", () => ({
  isDebugEnabled: vi.fn(() => false),
  emitDebugVisitEvent: vi.fn(),
}));

vi.mock("@/lib/visit/device", () => ({
  getDeviceInfo: vi.fn(() => ({ deviceType: "desktop", browser: "chrome", screenWidth: 1280 })),
}));

type TListener = (event?: unknown) => void;

describe("startVisitTracking", () => {
  let listeners: Map<string, TListener>;
  let location: { pathname: string };

  beforeEach(() => {
    listeners = new Map();
    location = { pathname: "/plans" };
    vi.stubGlobal("window", {
      ...window,
      location,
      addEventListener: vi.fn((name: string, listener: TListener) => listeners.set(name, listener)),
    });
    vi.stubGlobal("document", { ...document, referrer: "https://www.google.com/" });
  });

  // `vi.resetModules()` runs before each test (vitest.setup.ts), so every test gets a fresh module
  // and its once-per-document guard.
  const start = async () => (await import("@/lib/visit/visit-tracking")).startVisitTracking();

  test("counts the page it starts on, with the referrer that brought the visitor", async () => {
    await start();

    expect(recordPageLoad).toHaveBeenCalledWith("/plans", "https://www.google.com/");
  });

  test("runs once per page, however often setup() is called", async () => {
    const { startVisitTracking } = await import("@/lib/visit/visit-tracking");
    startVisitTracking();
    startVisitTracking();

    expect(recordPageLoad).toHaveBeenCalledTimes(1);
  });

  test("counts SPA navigations and corrects the path on replaceState", async () => {
    await start();

    location.pathname = "/compare";
    listeners.get("pushstate")?.();
    listeners.get("popstate")?.();
    location.pathname = "/compare/";
    listeners.get("replacestate")?.();

    expect(recordNavigation).toHaveBeenNthCalledWith(1, "/compare");
    expect(recordNavigation).toHaveBeenNthCalledWith(2, "/compare");
    expect(recordPathReplace).toHaveBeenCalledWith("/compare/");
  });

  test("counts a page the back/forward cache restores, but not a normal pageshow", async () => {
    await start();
    vi.mocked(recordPageLoad).mockClear();

    listeners.get("pageshow")?.({ persisted: false });
    expect(recordPageLoad).not.toHaveBeenCalled();

    listeners.get("pageshow")?.({ persisted: true });
    expect(recordPageLoad).toHaveBeenCalledWith("/plans", "https://www.google.com/");
  });

  test("banks the page's time when the visitor leaves it", async () => {
    await start();
    listeners.get("pagehide")?.();

    expect(recordPageHide).toHaveBeenCalled();
  });
});
