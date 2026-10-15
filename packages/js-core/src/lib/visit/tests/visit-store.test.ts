import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  VISIT_STORAGE_KEY,
  getVisitSnapshot,
  recordNavigation,
  recordPageHide,
  recordPageLoad,
  recordPathReplace,
} from "@/lib/visit/visit-store";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const T0 = 1_700_000_000_000;

const createStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
};

describe("visit store", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("starts a visit on the first page", () => {
    recordPageLoad("/plans", "https://www.google.com/", T0);

    expect(getVisitSnapshot(T0)).toEqual({
      pagesViewed: 1,
      uniquePagesViewed: 1,
      timeOnSite: 0,
      entryReferrer: "https://www.google.com/",
      visitedUrls: ["/plans"],
    });
  });

  test("counts a reload as a page view but not as a new page", () => {
    recordPageLoad("/plans", "", T0);
    recordPageLoad("/plans", "https://www.medicare.gov/plans", T0 + SECOND);

    expect(getVisitSnapshot(T0 + SECOND)).toMatchObject({
      pagesViewed: 2,
      uniquePagesViewed: 1,
      visitedUrls: ["/plans"],
    });
  });

  test("keeps the entry referrer of the first page", () => {
    recordPageLoad("/", "https://www.google.com/", T0);
    recordPageLoad("/plans", "https://www.medicare.gov/", T0 + SECOND);

    expect(getVisitSnapshot()?.entryReferrer).toBe("https://www.google.com/");
  });

  test("an SPA navigation counts only when the path changes", () => {
    recordPageLoad("/plans", "", T0);
    recordNavigation("/plans", T0 + SECOND);
    recordNavigation("/compare", T0 + 2 * SECOND);
    recordNavigation("/plans", T0 + 3 * SECOND);

    expect(getVisitSnapshot(T0 + 3 * SECOND)).toMatchObject({
      pagesViewed: 3,
      uniquePagesViewed: 2,
      visitedUrls: ["/plans", "/compare", "/plans"],
    });
  });

  test("replaceState corrects the current path without counting a page", () => {
    recordPageLoad("/plan", "", T0);
    recordPathReplace("/plans/");

    expect(getVisitSnapshot(T0)).toMatchObject({ pagesViewed: 1, visitedUrls: ["/plans/"] });
  });

  test("time on site leaves out time spent on another site in the same tab", () => {
    recordPageLoad("/plans", "", T0);
    recordPageHide(T0 + 3 * MINUTE);
    recordPageLoad("/plans", "https://news.example.com/", T0 + 43 * MINUTE);

    expect(getVisitSnapshot(T0 + 44 * MINUTE)?.timeOnSite).toBe(4 * 60);
  });

  test("time on site keeps running across SPA pages", () => {
    recordPageLoad("/plans", "", T0);
    recordNavigation("/compare", T0 + MINUTE);

    expect(getVisitSnapshot(T0 + 90 * SECOND)?.timeOnSite).toBe(90);
  });

  test("caps the journey at 50 pages and always keeps the first one", () => {
    recordPageLoad("/start", "", T0);
    for (let page = 1; page <= 60; page++) recordNavigation(`/page-${page.toString()}`, T0 + page);

    const visitedUrls = getVisitSnapshot()?.visitedUrls ?? [];
    expect(visitedUrls).toHaveLength(50);
    expect(visitedUrls[0]).toBe("/start");
    expect(visitedUrls[visitedUrls.length - 1]).toBe("/page-60");
  });

  test("returns no visit and never throws when storage is blocked", () => {
    const throwing = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: throwing, setItem: throwing, removeItem: throwing });

    expect(() => {
      recordPageLoad("/plans", "", T0);
      recordNavigation("/compare", T0);
      recordPathReplace("/compare/");
      recordPageHide(T0);
    }).not.toThrow();
    expect(getVisitSnapshot(T0)).toBeNull();
  });

  test("starts over when the stored visit is unreadable", () => {
    sessionStorage.setItem(VISIT_STORAGE_KEY, "{not json");
    recordPageLoad("/plans", "", T0);

    expect(getVisitSnapshot(T0)?.pagesViewed).toBe(1);
  });
});
