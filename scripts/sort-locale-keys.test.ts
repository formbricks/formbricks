import { describe, expect, test } from "vitest";
import { findUnsortedKeyPaths, sortKeysDeep } from "./sort-locale-keys.mjs";

describe("findUnsortedKeyPaths", () => {
  test("names every object whose keys are out of order, at any depth", () => {
    expect(
      findUnsortedKeyPaths({
        common: { save: "Save", cancel: "Cancel" },
        auth: { login: { title: "Log in", button: "Log in" }, logout: "Log out" },
      })
    ).toEqual(["(root)", "common", "auth.login"]);
  });

  test("sorts by code unit, so uppercase keys come before lowercase ones", () => {
    expect(findUnsortedKeyPaths({ Zebra: "", apple: "" })).toEqual([]);
    expect(findUnsortedKeyPaths({ apple: "", Zebra: "" })).toEqual(["(root)"]);
  });

  test("accepts an object sortKeysDeep wrote, even with integer-like keys JavaScript always puts first", () => {
    expect(findUnsortedKeyPaths(sortKeysDeep({ b: "", 10: "", a: "", 2: "" }))).toEqual([]);
  });
});

describe("sortKeysDeep", () => {
  test("sorts keys at every level and keeps the values", () => {
    const sorted = sortKeysDeep({ common: { save: "Save", cancel: "Cancel" }, auth: { logout: "Log out" } });
    expect(JSON.stringify(sorted)).toBe(
      '{"auth":{"logout":"Log out"},"common":{"cancel":"Cancel","save":"Save"}}'
    );
  });
});
