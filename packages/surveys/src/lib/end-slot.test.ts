import { describe, expect, test } from "vitest";
import { isEndSlotEmpty, shouldRenderEndSlot } from "./end-slot";

const blockCount = 3;

describe("end slot", () => {
  test("a block mid-survey is never the empty end slot", () => {
    const input = { blockCount, endingCount: 0, blockIdx: 1, hasError: false };
    expect(isEndSlotEmpty(input)).toBe(false);
    expect(shouldRenderEndSlot(input)).toBe(false);
  });

  test("the welcome card is never the empty end slot", () => {
    expect(isEndSlotEmpty({ blockCount, endingCount: 0, blockIdx: -1, hasError: false })).toBe(false);
  });

  test("the end slot of a survey with an ending card is rendered", () => {
    const input = { blockCount, endingCount: 1, blockIdx: blockCount, hasError: false };
    expect(isEndSlotEmpty(input)).toBe(false);
    expect(shouldRenderEndSlot(input)).toBe(true);
  });

  test("the end slot of a survey without an ending card is empty", () => {
    const input = { blockCount, endingCount: 0, blockIdx: blockCount, hasError: false };
    expect(isEndSlotEmpty(input)).toBe(true);
    expect(shouldRenderEndSlot(input)).toBe(false);
  });

  test("the end slot of a survey without an ending card is rendered while it shows an error", () => {
    const input = { blockCount, endingCount: 0, blockIdx: blockCount, hasError: true };
    expect(isEndSlotEmpty(input)).toBe(false);
    expect(shouldRenderEndSlot(input)).toBe(true);
  });

  test("an error mid-survey does not pull in the end slot of a survey without an ending card", () => {
    expect(shouldRenderEndSlot({ blockCount, endingCount: 0, blockIdx: 1, hasError: true })).toBe(false);
  });
});
