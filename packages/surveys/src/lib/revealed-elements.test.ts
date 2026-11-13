import { describe, expect, test } from "vitest";
import { getRevealedElementIds } from "./revealed-elements";

describe("getRevealedElementIds (ENG-6931)", () => {
  test("nothing on the first render: the card opens at its top", () => {
    expect(getRevealedElementIds(null, ["fav", "apple_reason"])).toEqual([]);
  });

  test("a follow-up an answer just revealed, and nothing that was already shown", () => {
    expect(getRevealedElementIds(["fav"], ["fav", "apple_reason"])).toEqual(["apple_reason"]);
    expect(getRevealedElementIds(["fav", "apple_reason"], ["fav", "apple_reason"])).toEqual([]);
  });

  test("hiding a question reveals nothing", () => {
    expect(getRevealedElementIds(["fav", "apple_reason"], ["fav"])).toEqual([]);
  });
});
