import { describe, expect, test } from "vitest";
import { getStageBackground } from "./background";

describe("getStageBackground", () => {
  test("returns a plain hex colour background", () => {
    expect(getStageBackground({ background: { bgType: "color", bg: "#dbe0f1" } })).toBe("#dbe0f1");
  });

  test("ignores image backgrounds and anything that is not a hex colour", () => {
    expect(getStageBackground({ background: { bgType: "upload", bg: "https://x/y.png" } })).toBeUndefined();
    expect(getStageBackground({ background: { bgType: "color", bg: "red; background: url(//evil)" } })).toBeUndefined();
    expect(getStageBackground({})).toBeUndefined();
  });
});
