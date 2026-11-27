/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useViewWrites } from "./use-view-writes";

describe("useViewWrites", () => {
  test("resolves at once when no view write is in flight", async () => {
    const { result } = renderHook(() => useViewWrites());
    await expect(result.current.waitForViewWrites()).resolves.toBeUndefined();
  });

  test("waits until every view write in flight has ended", async () => {
    const { result } = renderHook(() => useViewWrites());
    result.current.beginViewWrite();
    result.current.beginViewWrite();

    let settled = false;
    const waiting = result.current.waitForViewWrites().then(() => {
      settled = true;
    });

    result.current.endViewWrite();
    await Promise.resolve();
    expect(settled).toBe(false);

    result.current.endViewWrite();
    await waiting;
    expect(settled).toBe(true);
  });

  test("an extra end never drives the count below zero", async () => {
    const { result } = renderHook(() => useViewWrites());
    result.current.endViewWrite();
    result.current.beginViewWrite();

    let settled = false;
    const waiting = result.current.waitForViewWrites().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    result.current.endViewWrite();
    await waiting;
    expect(settled).toBe(true);
  });
});
