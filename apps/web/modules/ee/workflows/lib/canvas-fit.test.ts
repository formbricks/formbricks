import { describe, expect, test } from "vitest";
import { WORKFLOW_CANVAS_FIT_PADDING, getCanvasFitPadding } from "@/modules/ee/workflows/lib/canvas-fit";

describe("getCanvasFitPadding", () => {
  test("uses the default padding when nothing covers the canvas", () => {
    expect(getCanvasFitPadding({ canvasLeft: 0, canvasRight: 1000, coverLeft: null })).toBe(
      WORKFLOW_CANVAS_FIT_PADDING
    );
  });

  test("uses the default padding when the cover starts right of the canvas", () => {
    expect(getCanvasFitPadding({ canvasLeft: 0, canvasRight: 1000, coverLeft: 1100 })).toBe(
      WORKFLOW_CANVAS_FIT_PADDING
    );
  });

  test("fits the flow into the part left of the drawer, with the default margin around it", () => {
    // 1000px canvas, drawer from x=600: 600px visible, 400px covered. The default padding is 10% a side.
    expect(getCanvasFitPadding({ canvasLeft: 0, canvasRight: 1000, coverLeft: 600 })).toEqual({
      top: "10%",
      bottom: "10%",
      left: "60px",
      right: "460px",
    });
  });

  test("measures the visible part from the canvas's own left edge", () => {
    expect(getCanvasFitPadding({ canvasLeft: 200, canvasRight: 1200, coverLeft: 800 })).toEqual({
      top: "10%",
      bottom: "10%",
      left: "60px",
      right: "460px",
    });
  });

  test("leaves the viewport alone when too little of the canvas is left to fit into", () => {
    expect(getCanvasFitPadding({ canvasLeft: 0, canvasRight: 400, coverLeft: 100 })).toBeNull();
  });
});
