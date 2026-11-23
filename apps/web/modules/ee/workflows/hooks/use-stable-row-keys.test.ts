/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useStableRowKeys } from "./use-stable-row-keys";

describe("useStableRowKeys", () => {
  test("gives each row its own key and keeps the others' keys when one is removed", () => {
    const { result, rerender } = renderHook(({ count }) => useStableRowKeys(count), {
      initialProps: { count: 3 },
    });
    const [first, second, third] = result.current.keys;
    expect(new Set([first, second, third]).size).toBe(3);

    act(() => result.current.remove(1));
    rerender({ count: 2 });

    expect(result.current.keys).toEqual([first, third]);
  });

  test("adds a new key for a row added at the end", () => {
    const { result, rerender } = renderHook(({ count }) => useStableRowKeys(count), {
      initialProps: { count: 1 },
    });
    const [first] = result.current.keys;

    rerender({ count: 2 });

    expect(result.current.keys[0]).toBe(first);
    expect(result.current.keys[1]).not.toBe(first);
  });

  test("drops keys from the end when the list shrinks from outside", () => {
    const { result, rerender } = renderHook(({ count }) => useStableRowKeys(count), {
      initialProps: { count: 3 },
    });
    const [first, second] = result.current.keys;

    rerender({ count: 2 });

    expect(result.current.keys).toEqual([first, second]);
  });
});
