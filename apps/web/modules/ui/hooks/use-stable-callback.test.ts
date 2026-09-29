/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useStableCallback } from "./use-stable-callback";

describe("useStableCallback", () => {
  test("keeps its identity while running the closure from the latest render", () => {
    const { result, rerender } = renderHook(({ value }) => useStableCallback(() => value), {
      initialProps: { value: "first" },
    });
    const initial = result.current;

    rerender({ value: "second" });

    expect(result.current).toBe(initial);
    expect(initial()).toBe("second");
  });
});
