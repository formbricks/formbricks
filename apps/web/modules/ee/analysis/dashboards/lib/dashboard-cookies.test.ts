import { describe, expect, test } from "vitest";
import { MAX_DASHBOARD_COOKIE_VALUE_LENGTH, dashboardCookieAssignments } from "./dashboard-cookies";

const PAGE = "/workspaces/clws000000000000000000001/analysis/dashboards/cldb000000000000000000001";

describe("dashboardCookieAssignments", () => {
  test("scopes a remembered value to the dashboard page, never to every path", () => {
    const [set, ...rest] = dashboardCookieAssignments({
      name: "fb_x",
      value: "abc",
      path: PAGE,
      maxAgeSeconds: 60,
    });
    expect(set).toBe(`fb_x=abc; path=${PAGE}; max-age=60; SameSite=Lax`);
    expect(set).not.toContain("path=/;");
    // An older copy written on path=/ is expired, so it stops travelling with every request.
    expect(rest).toEqual(["fb_x=; path=/; max-age=0; SameSite=Lax"]);
  });

  test("forgets an empty value at the page path and at the legacy root path", () => {
    expect(dashboardCookieAssignments({ name: "fb_x", value: null, path: PAGE, maxAgeSeconds: 60 })).toEqual([
      `fb_x=; path=${PAGE}; max-age=0; SameSite=Lax`,
      "fb_x=; path=/; max-age=0; SameSite=Lax",
    ]);
  });

  test("a value at the cap is kept; one past it is not written, and any stale copy is forgotten", () => {
    const atCap = "a".repeat(MAX_DASHBOARD_COOKIE_VALUE_LENGTH);
    expect(
      dashboardCookieAssignments({ name: "fb_x", value: atCap, path: PAGE, maxAgeSeconds: 60 })[0]
    ).toContain(`fb_x=${atCap};`);
    expect(
      dashboardCookieAssignments({ name: "fb_x", value: `${atCap}a`, path: PAGE, maxAgeSeconds: 60 })
    ).toEqual([`fb_x=; path=${PAGE}; max-age=0; SameSite=Lax`, "fb_x=; path=/; max-age=0; SameSite=Lax"]);
  });

  test("a path the browser would not take falls back to forgetting, never to the root", () => {
    expect(
      dashboardCookieAssignments({ name: "fb_x", value: "abc", path: "/a;b", maxAgeSeconds: 60 })
    ).toEqual(["fb_x=; path=/; max-age=0; SameSite=Lax"]);
  });
});
