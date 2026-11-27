/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { GRID_MARGIN, ROW_HEIGHT } from "../lib/dashboard-grid-layout";
import { pixelsToGridRows } from "../lib/widget-blocks";
import { useBlockHeights } from "./use-block-heights";

describe("useBlockHeights", () => {
  test("turns a block's measured pixels into the grid rows it needs", () => {
    const { result } = renderHook(() => useBlockHeights());
    act(() => result.current.handleMeasure("t", 200));
    expect(result.current.neededRows.get("t")).toBe(pixelsToGridRows(200, ROW_HEIGHT, GRID_MARGIN));
  });

  test("keeps the same map when a measurement does not change the rows", () => {
    const { result } = renderHook(() => useBlockHeights());
    act(() => result.current.handleMeasure("t", 200));
    const before = result.current.neededRows;
    act(() => result.current.handleMeasure("t", 200));
    expect(result.current.neededRows).toBe(before);
  });

  test("fits block heights into the widgets a save sends", () => {
    const { result } = renderHook(() => useBlockHeights());
    act(() => result.current.handleMeasure("t", 400));
    const rows = result.current.neededRows.get("t")!;
    const [fitted] = result.current.withFittedHeights([
      {
        id: "t",
        kind: "text",
        chartId: null,
        dashboardId: "d",
        pageId: "p1",
        layout: { x: 0, y: 0, w: 4, h: 1 },
        order: 0,
        content: { headline: "Hi", description: "" },
      } as never,
    ]);
    expect(fitted.layout.h).toBe(rows);
  });
});
