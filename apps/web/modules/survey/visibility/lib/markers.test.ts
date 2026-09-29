import { describe, expect, test, vi } from "vitest";
import {
  getRestrictedBannerDismissedKey,
  getRestrictedRowMarker,
  readRestrictedBannerDismissed,
  showRestrictedBanner,
  showWorkspaceMarker,
  writeRestrictedBannerDismissed,
} from "./markers";

const ada = { name: "Ada" };
const role = { via: "organizationRole" };
const owner = { via: "owner" };

describe("getRestrictedRowMarker", () => {
  test.each([
    ["gate off", { gate: false, visibility: "restricted" as const, access: role, owner: null }, null],
    ["workspace-visible", { gate: true, visibility: "workspace" as const, access: role, owner: null }, null],
    [
      "author gone",
      { gate: true, visibility: "restricted" as const, access: role, owner: null },
      "author_gone",
    ],
    ["role-only viewer", { gate: true, visibility: "restricted" as const, access: role, owner: ada }, "role"],
    ["the author", { gate: true, visibility: "restricted" as const, access: owner, owner: ada }, null],
    ["unknown access", { gate: true, visibility: "restricted" as const, access: null, owner: ada }, null],
  ])("%s → %s", (_label, input, expected) => {
    expect(getRestrictedRowMarker(input)).toBe(expected);
  });
});

describe("showWorkspaceMarker", () => {
  test("only workspace-visible surveys with the gate on", () => {
    expect(showWorkspaceMarker({ gate: true, visibility: "workspace" })).toBe(true);
    expect(showWorkspaceMarker({ gate: true, visibility: "restricted" })).toBe(false);
    expect(showWorkspaceMarker({ gate: false, visibility: "workspace" })).toBe(false);
  });
});

describe("showRestrictedBanner", () => {
  test("restricted, seen through the organization role, gate on", () => {
    expect(showRestrictedBanner({ gate: true, visibility: "restricted", access: role })).toBe(true);
  });

  test.each([
    [{ gate: false, visibility: "restricted" as const, access: role }],
    [{ gate: true, visibility: "workspace" as const, access: role }],
    [{ gate: true, visibility: "restricted" as const, access: owner }],
    [{ gate: true, visibility: "restricted" as const, access: null }],
  ])("not for %o", (input) => {
    expect(showRestrictedBanner(input)).toBe(false);
  });
});

describe("restricted banner dismissal", () => {
  const memoryStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  test("is remembered per survey", () => {
    const storage = memoryStorage();
    writeRestrictedBannerDismissed(storage, "survey_1");
    expect(readRestrictedBannerDismissed(storage, "survey_1")).toBe(true);
    expect(readRestrictedBannerDismissed(storage, "survey_2")).toBe(false);
    expect(storage.getItem(getRestrictedBannerDismissedKey("survey_1"))).toBe("1");
    expect(getRestrictedBannerDismissedKey("survey_1")).toBe("fb-restricted-banner-dismissed:survey_1");
  });

  test("missing or throwing storage reads as not dismissed and never throws", () => {
    const throwing = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };
    expect(readRestrictedBannerDismissed(undefined, "survey_1")).toBe(false);
    expect(readRestrictedBannerDismissed(throwing, "survey_1")).toBe(false);
    expect(() => writeRestrictedBannerDismissed(throwing, "survey_1")).not.toThrow();
    expect(() => writeRestrictedBannerDismissed(undefined, "survey_1")).not.toThrow();
  });
});
