import { describe, expect, test } from "vitest";
import type {
  FeedbackButtonPlacementZodType,
  ShowConditionGroupZodType,
  ShowConditionZodType,
} from "@formbricks/api-v3-schemas";
import { type TOverlapCreative, findCreativeOverlaps } from "./overlap";

const button = (
  id: string,
  edge: "left" | "right" | "bottom",
  offset: number,
  extra: Partial<Pick<TOverlapCreative, "displayStatus" | "distribution">> & {
    phone?: FeedbackButtonPlacementZodType;
  } = {}
): TOverlapCreative => ({
  id,
  displayStatus: extra.displayStatus ?? "active",
  distribution: extra.distribution ?? { conditions: null },
  type: "feedbackButton",
  styling: { position: { desktop: { edge, offset }, phone: extra.phone ?? null } },
});

const banner = (id: string, placement: "top" | "bottom", layout: "inPage" | "overlay"): TOverlapCreative => ({
  id,
  displayStatus: "active",
  distribution: { conditions: null },
  type: "banner",
  styling: {
    position: {
      desktop: placement === "top" ? { placement, layout } : { placement, layout: "overlay" },
      phone: null,
    },
  },
});

type TCondition = ShowConditionZodType;
type TGroup = ShowConditionGroupZodType;

const url = (operator: TCondition["operator"], value: string | string[]): TCondition => ({
  id: "url",
  leftOperand: { type: "page", value: "currentUrl" },
  operator,
  rightOperand: { type: "static", value },
});
const deviceType = (operator: "equals" | "doesNotEqual", value: string): TCondition => ({
  id: "device",
  leftOperand: { type: "device", value: "deviceType" },
  operator,
  rightOperand: { type: "static", value },
});
const all = (...conditions: TGroup["conditions"]): TGroup => ({ id: "all", connector: "and", conditions });
const any = (...conditions: TCondition[]) => ({ id: "any", connector: "or" as const, conditions });

/** Two buttons at the same spot, so only their Show when decides. */
const sameSpot = (a: TGroup | null, b: TGroup | null) =>
  findCreativeOverlaps([
    button("a", "right", 50, { distribution: { conditions: a } }),
    button("b", "right", 50, { distribution: { conditions: b } }),
  ]).has("a");

describe("findCreativeOverlaps", () => {
  test("flags two Active feedback buttons on the same edge at close offsets, each naming the other", () => {
    const overlaps = findCreativeOverlaps([button("a", "right", 50), button("b", "right", 60)]);

    expect(overlaps.get("a")).toEqual(["b"]);
    expect(overlaps.get("b")).toEqual(["a"]);
  });

  test("leaves out buttons that are far apart or on opposite edges", () => {
    const overlaps = findCreativeOverlaps([
      button("a", "right", 20),
      button("b", "right", 80),
      button("c", "left", 20),
    ]);

    expect(overlaps.size).toBe(0);
  });

  test("only compares Active creatives", () => {
    const overlaps = findCreativeOverlaps([
      button("active", "right", 50),
      button("paused", "right", 50, { displayStatus: "paused" }),
      button("scheduled", "right", 50, { displayStatus: "scheduled" }),
    ]);

    expect(overlaps.size).toBe(0);
  });

  test("flags buttons that meet in a corner from two edges", () => {
    const overlaps = findCreativeOverlaps([
      button("left-low", "left", 95),
      button("bottom-left", "bottom", 5),
      button("bottom-right", "bottom", 95),
    ]);

    expect(overlaps.get("left-low")).toEqual(["bottom-left"]);
    expect(overlaps.has("bottom-right")).toBe(false);
  });

  test("compares phone positions too, where a missing phone position means the desktop one", () => {
    const desktopOnly = button("desktop-only", "right", 50);
    const movesOnPhone = button("moves-on-phone", "right", 90, { phone: { edge: "right", offset: 55 } });

    const overlaps = findCreativeOverlaps([desktopOnly, movesOnPhone]);

    expect(overlaps.get("desktop-only")).toEqual(["moves-on-phone"]);
  });

  test("flags banners at the same edge when one of them is an Overlay", () => {
    const overlaps = findCreativeOverlaps([
      banner("bottom-1", "bottom", "overlay"),
      banner("bottom-2", "bottom", "overlay"),
      banner("top-overlay", "top", "overlay"),
      banner("top-in-page", "top", "inPage"),
    ]);

    expect(overlaps.get("bottom-1")).toEqual(["bottom-2"]);
    expect(overlaps.get("top-overlay")).toEqual(["top-in-page"]);
  });

  test("leaves out In page banners, which stack in the page flow, and buttons next to banners", () => {
    const overlaps = findCreativeOverlaps([
      banner("in-page-1", "top", "inPage"),
      banner("in-page-2", "top", "inPage"),
      banner("bottom", "bottom", "overlay"),
      button("bottom-button", "bottom", 50),
    ]);

    expect(overlaps.size).toBe(0);
  });
});

describe("findCreativeOverlaps · Show when", () => {
  test("leaves out creatives whose device types never meet", () => {
    expect(sameSpot(all(deviceType("equals", "phone")), all(deviceType("equals", "desktop")))).toBe(false);
    expect(sameSpot(all(deviceType("equals", "phone")), all(deviceType("doesNotEqual", "phone")))).toBe(
      false
    );
    expect(sameSpot(all(deviceType("equals", "phone")), all(deviceType("doesNotEqual", "tablet")))).toBe(
      true
    );
  });

  test("leaves out creatives whose page URL conditions can't both hold, ignoring case", () => {
    const plans = "https://site.com/plans";
    expect(sameSpot(all(url("startsWith", plans)), all(url("startsWith", "https://site.com/costs")))).toBe(
      false
    );
    expect(sameSpot(all(url("equals", plans)), all(url("equals", `${plans}/2027`)))).toBe(false);
    expect(sameSpot(all(url("equals", plans)), all(url("doesNotEqual", plans)))).toBe(false);
    expect(sameSpot(all(url("contains", "/checkout")), all(url("doesNotContain", "/checkout")))).toBe(false);
    expect(sameSpot(all(url("equals", plans)), all(url("containsNoneOf", ["/plans", "/costs"])))).toBe(false);

    expect(sameSpot(all(url("startsWith", plans)), all(url("startsWith", `${plans}/2027`)))).toBe(true);
    expect(sameSpot(all(url("equals", plans)), all(url("equals", plans.toUpperCase())))).toBe(true);
    expect(sameSpot(all(url("equals", plans)), all(url("endsWith", "/PLANS")))).toBe(true);
  });

  test("keeps creatives that one page could match, since a URL can hold several fragments", () => {
    expect(sameSpot(all(url("contains", "/plans")), all(url("contains", "/costs")))).toBe(true);
    expect(sameSpot(all(url("containsAnyOf", ["/plans", "/costs"])), all(url("contains", "/help")))).toBe(
      true
    );
  });

  test("checks every alternative of an any-group", () => {
    const plansOrCosts = all(
      any(url("equals", "https://site.com/plans"), url("equals", "https://site.com/costs"))
    );
    expect(sameSpot(plansOrCosts, all(url("equals", "https://site.com/costs")))).toBe(true);
    expect(sameSpot(plansOrCosts, all(url("equals", "https://site.com/help")))).toBe(false);
  });

  test("assumes conditions it can't compare could hold", () => {
    const visit: TCondition = {
      id: "visit",
      leftOperand: { type: "visit", value: "pagesViewed" },
      operator: "isGreaterThan",
      rightOperand: { type: "static", value: 3 },
    };
    expect(sameSpot(all(visit), all(url("equals", "https://site.com/plans")))).toBe(true);
    expect(sameSpot(all(visit), null)).toBe(true);
  });

  test("treats a Show when with too many alternatives to spell out as matching every page", () => {
    const pair = (n: number) =>
      any(url("equals", `https://site.com/${n}`), url("equals", `https://site.com/${n}b`));
    // 2^7 alternatives, each needing seven different URLs at once: none could ever hold.
    const sprawling = all(pair(1), pair(2), pair(3), pair(4), pair(5), pair(6), pair(7));

    expect(sameSpot(sprawling, all(url("equals", "https://site.com/help")))).toBe(true);
  });
});
