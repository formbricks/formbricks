import { describe, expect, test } from "vitest";
import { getRowVisibilityMarker, showRestrictedBanner } from "./markers";

const ada = { name: "Ada" };
const role = { via: "organizationRole" };
const owner = { via: "owner" };

describe("getRowVisibilityMarker", () => {
  test.each([
    [
      "not enforced, restricted",
      { enforced: false, visibility: "restricted" as const, access: role, owner: null },
      null,
    ],
    [
      "not enforced, workspace",
      { enforced: false, visibility: "workspace" as const, access: role, owner: ada },
      null,
    ],
    [
      "workspace-visible",
      { enforced: true, visibility: "workspace" as const, access: role, owner: null },
      { kind: "workspace" },
    ],
    [
      "author gone",
      { enforced: true, visibility: "restricted" as const, access: role, owner: null },
      { kind: "restricted", detail: "author_gone" },
    ],
    [
      "role-only viewer",
      { enforced: true, visibility: "restricted" as const, access: role, owner: ada },
      { kind: "restricted", detail: "role" },
    ],
    [
      "the author",
      { enforced: true, visibility: "restricted" as const, access: owner, owner: ada },
      { kind: "restricted", detail: null },
    ],
    [
      "unknown access",
      { enforced: true, visibility: "restricted" as const, access: null, owner: ada },
      { kind: "restricted", detail: null },
    ],
  ])("%s", (_label, input, expected) => {
    expect(getRowVisibilityMarker(input)).toEqual(expected);
  });
});

describe("showRestrictedBanner", () => {
  test("restricted, seen through the organization role, while enforced — entitled or not", () => {
    expect(showRestrictedBanner({ enforced: true, visibility: "restricted", access: role })).toBe(true);
  });

  test.each([
    [{ enforced: false, visibility: "restricted" as const, access: role }],
    [{ enforced: true, visibility: "workspace" as const, access: role }],
    [{ enforced: true, visibility: "restricted" as const, access: owner }],
    [{ enforced: true, visibility: "restricted" as const, access: null }],
  ])("not for %o", (input) => {
    expect(showRestrictedBanner(input)).toBe(false);
  });
});
