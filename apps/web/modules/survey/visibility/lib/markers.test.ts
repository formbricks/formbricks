import { describe, expect, test } from "vitest";
import { getRowVisibilityMarker, showRestrictedBanner } from "./markers";

const ada = { name: "Ada" };
const role = { via: "organizationRole" };
const owner = { via: "owner" };

describe("getRowVisibilityMarker", () => {
  test.each([
    [
      "gate off, restricted",
      { gate: false, visibility: "restricted" as const, access: role, owner: null },
      null,
    ],
    [
      "gate off, workspace",
      { gate: false, visibility: "workspace" as const, access: role, owner: ada },
      null,
    ],
    [
      "workspace-visible",
      { gate: true, visibility: "workspace" as const, access: role, owner: null },
      { kind: "workspace" },
    ],
    [
      "author gone",
      { gate: true, visibility: "restricted" as const, access: role, owner: null },
      { kind: "restricted", detail: "author_gone" },
    ],
    [
      "role-only viewer",
      { gate: true, visibility: "restricted" as const, access: role, owner: ada },
      { kind: "restricted", detail: "role" },
    ],
    [
      "the author",
      { gate: true, visibility: "restricted" as const, access: owner, owner: ada },
      { kind: "restricted", detail: null },
    ],
    [
      "unknown access",
      { gate: true, visibility: "restricted" as const, access: null, owner: ada },
      { kind: "restricted", detail: null },
    ],
  ])("%s", (_label, input, expected) => {
    expect(getRowVisibilityMarker(input)).toEqual(expected);
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
