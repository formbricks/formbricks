import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getAppearance, setAppearance } from "@/lib/common/appearance";

describe("appearance", () => {
  beforeEach(() => {
    // js-core only runs in a browser; the renderer is not loaded yet.
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.stubGlobal("window", {});
    setAppearance("light");
    vi.unstubAllGlobals();
  });

  test("defaults to light", () => {
    expect(getAppearance()).toBe("light");
  });

  test("stores a valid appearance and rejects an unknown one", () => {
    expect(setAppearance("dark")).toBe(true);
    expect(getAppearance()).toBe("dark");
    expect(setAppearance("sepia")).toBe(false);
    expect(getAppearance()).toBe("dark");
  });

  test("pushes the change to an already loaded renderer", () => {
    const rendererSetAppearance = vi.fn();
    vi.stubGlobal("window", {
      formbricksSurveys: { renderSurvey: vi.fn(), setAppearance: rendererSetAppearance },
    });
    setAppearance("system");
    expect(rendererSetAppearance).toHaveBeenCalledWith("system");
  });

  test("works with an older renderer that has no setAppearance", () => {
    vi.stubGlobal("window", { formbricksSurveys: { renderSurvey: vi.fn() } });
    expect(() => setAppearance("dark")).not.toThrow();
    expect(getAppearance()).toBe("dark");
  });
});
