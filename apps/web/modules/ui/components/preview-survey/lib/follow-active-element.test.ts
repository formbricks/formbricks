import { describe, expect, test } from "vitest";
import { INITIAL_FOLLOW_STATE, type TFollowState, followActiveElement } from "./follow-active-element";

/** Feeds the editor's active element to the preview, one render at a time; returns each verdict. */
const run = (elementIds: (string | null)[]) => {
  let state: TFollowState = INITIAL_FOLLOW_STATE;
  return elementIds.map((elementId) => {
    const result = followActiveElement(state, elementId);
    state = result.state;
    return result.follow;
  });
};

describe("followActiveElement: when the editor preview moves to the active question", () => {
  test("the question the editor opens on is not followed: the preview opens like the live survey", () => {
    // null on the first render, then the first question the editor activates by itself, then edits.
    expect(run([null, "q1", "q1", "q1"])).toEqual([false, false, false, false]);
  });

  test("a question the author picks is followed, and kept in view while it is edited", () => {
    expect(run(["q1", "q2", "q2"])).toEqual([false, true, true]);
  });

  test("picking the opening question again, after closing its card, is followed", () => {
    expect(run(["q1", null, "q1"])).toEqual([false, false, true]);
  });

  test("nothing is followed while no question is active, as on the Flow tab", () => {
    expect(run(["q1", "q2", null, null])).toEqual([false, true, false, false]);
  });
});
