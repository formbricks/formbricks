import { describe, expect, test } from "vitest";
import { countChipsThatFit } from "./fit-chips";

/**
 * A multi-select value shows its picks as chips on one line, and a "+N" chip for those that don't fit
 * (jobenjada review #28). Widths in px; chips sit 4px apart; the "+N" chip is 28px wide.
 */
const fit = (chipWidths: number[], available: number) =>
  countChipsThatFit(chipWidths, available, { gap: 4, counterWidth: 28 });

describe("countChipsThatFit", () => {
  test("every chip shows when they all fit", () => {
    // 40 + 4 + 50 = 94
    expect(fit([40, 50], 94)).toBe(2);
  });

  test("the chips that fit next to the +N chip show, the rest are counted", () => {
    // 40 + 4 + 50 + 4 + 28 = 126 fits; a third chip would not
    expect(fit([40, 50, 60], 130)).toBe(2);
    expect(fit([40, 50, 60], 100)).toBe(1);
  });

  test("the first chip always shows, cut short when it is wider than the box", () => {
    expect(fit([300, 50], 100)).toBe(1);
    expect(fit([300], 100)).toBe(1);
  });

  test("no box measured yet shows everything", () => {
    expect(fit([40, 50, 60], 0)).toBe(3);
  });

  test("no picks, no chips", () => {
    expect(fit([], 100)).toBe(0);
  });
});
