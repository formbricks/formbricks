import { describe, expect, test } from "vitest";
import { clamp, commitStepperInput, isAtMax, isAtMin, parseStepperInput, stepValue } from "./number-stepper";

describe("clamp", () => {
  test("keeps values inside the bounds", () => {
    expect(clamp(5, { min: 0, max: 10 })).toBe(5);
    expect(clamp(-1, { min: 0, max: 10 })).toBe(0);
    expect(clamp(11, { min: 0, max: 10 })).toBe(10);
    expect(clamp(99, {})).toBe(99);
  });
});

describe("stepValue", () => {
  test("steps up and down by the step, clamped", () => {
    expect(stepValue(50, 1, { step: 5, min: 0, max: 100 })).toBe(55);
    expect(stepValue(2, -1, { step: 5, min: 0, max: 100 })).toBe(0);
    expect(stepValue(98, 10, { step: 1, min: 0, max: 100 })).toBe(100);
  });

  test("is decimal-safe", () => {
    expect(stepValue(0.1, 2, { step: 0.1 })).toBe(0.3);
    expect(stepValue(1.25, -1, { step: 0.05 })).toBe(1.2);
  });

  test("defaults the step to 1", () => {
    expect(stepValue(7, 1, {})).toBe(8);
  });
});

describe("parseStepperInput", () => {
  test("parses plain numbers, units and comma decimals", () => {
    expect(parseStepperInput("12")).toBe(12);
    expect(parseStepperInput(" 12px ")).toBe(12);
    expect(parseStepperInput("60 %")).toBe(60);
    expect(parseStepperInput("1,5")).toBe(1.5);
    expect(parseStepperInput("-4")).toBe(-4);
  });

  test("returns null when nothing numeric is left", () => {
    expect(parseStepperInput("")).toBeNull();
    expect(parseStepperInput("px")).toBeNull();
    expect(parseStepperInput("-")).toBeNull();
    expect(parseStepperInput("abc")).toBeNull();
  });
});

describe("commitStepperInput", () => {
  const bounds = { min: 0, max: 100, step: 1 };

  test("clamps typed values to the bounds", () => {
    expect(commitStepperInput("140", 50, bounds)).toBe(100);
    expect(commitStepperInput("-3", 50, bounds)).toBe(0);
    expect(commitStepperInput("42%", 50, bounds)).toBe(42);
  });

  test("reverts to the current value for invalid input", () => {
    expect(commitStepperInput("abc", 50, bounds)).toBe(50);
    expect(commitStepperInput("", 50, bounds)).toBe(50);
  });
});

describe("isAtMin / isAtMax", () => {
  test("detect the bounds, and are false without them", () => {
    expect(isAtMin(0, { min: 0 })).toBe(true);
    expect(isAtMin(1, { min: 0 })).toBe(false);
    expect(isAtMax(100, { max: 100 })).toBe(true);
    expect(isAtMin(-5, {})).toBe(false);
    expect(isAtMax(1e9, {})).toBe(false);
  });
});
