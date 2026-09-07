/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_WIDGET_VIEW,
  getWidgetViewStorageKey,
  readStoredWidgetView,
  writeStoredWidgetView,
} from "./widget-view";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("readStoredWidgetView", () => {
  test("returns the chart view when nothing is stored", () => {
    expect(readStoredWidgetView("widget-1")).toBe("chart");
  });

  test("returns the stored view", () => {
    window.localStorage.setItem(getWidgetViewStorageKey("widget-1"), "data");

    expect(readStoredWidgetView("widget-1")).toBe("data");
  });

  test("keeps widgets independent so the same chart on two dashboards is remembered separately", () => {
    writeStoredWidgetView("widget-1", "data");

    expect(readStoredWidgetView("widget-1")).toBe("data");
    expect(readStoredWidgetView("widget-2")).toBe("chart");
  });

  test("falls back to the default for a value this build does not know", () => {
    window.localStorage.setItem(getWidgetViewStorageKey("widget-1"), "spreadsheet");

    expect(readStoredWidgetView("widget-1")).toBe(DEFAULT_WIDGET_VIEW);
  });

  test("falls back to the default when storage access throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage is not available");
    });

    expect(readStoredWidgetView("widget-1")).toBe(DEFAULT_WIDGET_VIEW);
  });
});

describe("writeStoredWidgetView", () => {
  test("persists a non-default view", () => {
    writeStoredWidgetView("widget-1", "data");

    expect(window.localStorage.getItem(getWidgetViewStorageKey("widget-1"))).toBe("data");
  });

  test("clears the entry when switching back to the default instead of storing it", () => {
    writeStoredWidgetView("widget-1", "data");
    writeStoredWidgetView("widget-1", "chart");

    expect(window.localStorage.getItem(getWidgetViewStorageKey("widget-1"))).toBeNull();
    expect(readStoredWidgetView("widget-1")).toBe("chart");
  });

  test("does not throw when storage is unavailable", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => writeStoredWidgetView("widget-1", "data")).not.toThrow();
  });
});
