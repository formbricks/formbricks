import { describe, expect, test } from "vitest";
import { DEVICE_FRAMES, fitScale, getScaledSize } from "./geometry";

describe("fitScale", () => {
  test("shrinks a frame to the space available and never enlarges it", () => {
    expect(fitScale(440, 880)).toBe(0.5);
    expect(fitScale(2000, 880)).toBe(1);
  });

  test("never goes below a readable minimum", () => {
    expect(fitScale(100, 880)).toBe(0.3);
  });

  test("shows the frame at full size until the space is measured", () => {
    expect(fitScale(0, 880)).toBe(1);
    expect(fitScale(Number.NaN, 880)).toBe(1);
  });
});

describe("getScaledSize", () => {
  test("scales width and height together", () => {
    const { width, height } = DEVICE_FRAMES.desktop;

    expect(getScaledSize("desktop", width / 2)).toEqual({ scale: 0.5, width: width / 2, height: height / 2 });
  });
});
