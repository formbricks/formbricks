// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getResolvedAppearance, setAppearance, subscribeToAppearance } from "./appearance";

const mockSystemDark = (matches: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query)
  );
  return {
    change: (next: boolean) => {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
};

describe("appearance", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="fbjs"></div><div id="fbjs"></div>';
  });

  afterEach(() => {
    setAppearance("light");
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  test("defaults to light when nothing or something invalid is passed", () => {
    setAppearance(undefined);
    expect(getResolvedAppearance()).toBe("light");
    setAppearance("sepia");
    expect(getResolvedAppearance()).toBe("light");
  });

  test("marks every survey root, including the dropdown portal's", () => {
    setAppearance("dark");
    const roots = Array.from(document.querySelectorAll<HTMLElement>('[id="fbjs"]'));
    expect(roots.map((root) => root.dataset.appearance)).toEqual(["dark", "dark"]);
  });

  test("system follows the browser setting and its live changes", () => {
    const system = mockSystemDark(true);
    setAppearance("system");
    expect(getResolvedAppearance()).toBe("dark");

    system.change(false);
    expect(getResolvedAppearance()).toBe("light");
    expect(document.getElementById("fbjs")?.dataset.appearance).toBe("light");
  });

  test("leaving system stops listening to the browser", () => {
    const system = mockSystemDark(true);
    setAppearance("system");
    expect(system.listenerCount()).toBe(1);
    setAppearance("light");
    expect(system.listenerCount()).toBe(0);
  });

  test("notifies subscribers until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAppearance(listener);
    setAppearance("dark");
    expect(listener).toHaveBeenLastCalledWith("dark");
    unsubscribe();
    setAppearance("light");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
