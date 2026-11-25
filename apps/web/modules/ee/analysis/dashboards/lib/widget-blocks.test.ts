import { describe, expect, test } from "vitest";
import {
  DEFAULT_IMAGE_CONTENT,
  fitBlockHeights,
  getDefaultBlockContent,
  getDefaultBlockLayout,
  isDashboardImageUrl,
  isTextBlockEmpty,
  parseWidgetContent,
  pixelsToGridRows,
  placeNewBlock,
} from "./widget-blocks";

const WORKSPACE = "clws000000000000000000001";
const UPLOAD = `/storage/${WORKSPACE}/private/dashboards/cldb000000000000000000001/logo--fid--1.png`;

describe("block defaults", () => {
  test("an image is 3 columns, a text block 9, a separator the full row 2 units high", () => {
    expect(getDefaultBlockLayout("image").w).toBe(3);
    expect(getDefaultBlockLayout("text").w).toBe(9);
    expect(getDefaultBlockLayout("separator")).toEqual({ x: 0, y: 0, w: 12, h: 2 });
  });

  test("a new image is empty, fitted and centred; a new text block empty; a separator has no content", () => {
    expect(getDefaultBlockContent("image")).toEqual({
      fileUrl: null,
      fit: "fit",
      position: "center",
      alt: "",
    });
    expect(getDefaultBlockContent("text")).toEqual({ headline: "", description: "" });
    expect(getDefaultBlockContent("separator")).toBeNull();
  });
});

describe("placeNewBlock", () => {
  test("drops a block in the next free slot of the page", () => {
    expect(placeNewBlock("image", [{ x: 0, y: 0, w: 9, h: 2 }])).toEqual({ x: 9, y: 0, w: 3, h: 12 });
  });

  test("puts a separator on a row of its own below everything when no row is free", () => {
    expect(placeNewBlock("separator", [{ x: 0, y: 0, w: 4, h: 4 }])).toEqual({ x: 0, y: 4, w: 12, h: 2 });
  });
});

describe("isTextBlockEmpty", () => {
  test("is empty only when both parts are blank", () => {
    expect(isTextBlockEmpty({ headline: " ", description: "\n" })).toBe(true);
    expect(isTextBlockEmpty({ headline: "Q3", description: "" })).toBe(false);
    expect(isTextBlockEmpty({ headline: "", description: "Notes" })).toBe(false);
  });
});

describe("isDashboardImageUrl", () => {
  test("takes a dashboard upload of this workspace", () => {
    expect(isDashboardImageUrl(UPLOAD, WORKSPACE)).toBe(true);
  });

  test("refuses another workspace, a public file, an outside URL and a nested path", () => {
    expect(isDashboardImageUrl(UPLOAD.replace(WORKSPACE, "clws_other"), WORKSPACE)).toBe(false);
    expect(isDashboardImageUrl(UPLOAD.replace("/private/", "/public/"), WORKSPACE)).toBe(false);
    expect(isDashboardImageUrl("https://example.com/x.png", WORKSPACE)).toBe(false);
    expect(isDashboardImageUrl(`/storage/${WORKSPACE}/private/dashboards/cldb1/a/b.png`, WORKSPACE)).toBe(
      false
    );
    expect(isDashboardImageUrl(`/storage/${WORKSPACE}/private/dashboards/cldb1/..`, WORKSPACE)).toBe(false);
  });
});

describe("parseWidgetContent", () => {
  test("a chart and a separator carry no content", () => {
    expect(parseWidgetContent("chart", undefined, WORKSPACE)).toEqual({ ok: true, content: null });
    expect(parseWidgetContent("separator", null, WORKSPACE)).toEqual({ ok: true, content: null });
    expect(parseWidgetContent("separator", { headline: "x" }, WORKSPACE).ok).toBe(false);
  });

  test("an image without content starts empty, and takes only its workspace's uploads", () => {
    expect(parseWidgetContent("image", undefined, WORKSPACE)).toEqual({
      ok: true,
      content: DEFAULT_IMAGE_CONTENT,
    });
    expect(
      parseWidgetContent("image", { ...DEFAULT_IMAGE_CONTENT, fileUrl: UPLOAD, fit: "fill" }, WORKSPACE)
    ).toEqual({ ok: true, content: { ...DEFAULT_IMAGE_CONTENT, fileUrl: UPLOAD, fit: "fill" } });
    expect(
      parseWidgetContent("image", { ...DEFAULT_IMAGE_CONTENT, fileUrl: "https://x.test/a.png" }, WORKSPACE).ok
    ).toBe(false);
    expect(parseWidgetContent("image", { ...DEFAULT_IMAGE_CONTENT, fit: "stretch" }, WORKSPACE).ok).toBe(
      false
    );
  });

  test("a text block needs a headline or a description, and nothing else", () => {
    expect(parseWidgetContent("text", { headline: "Q3", description: "" }, WORKSPACE).ok).toBe(true);
    expect(parseWidgetContent("text", { headline: "", description: "" }, WORKSPACE).ok).toBe(false);
    expect(parseWidgetContent("text", { headline: "Q3", description: "", html: "<b>" }, WORKSPACE).ok).toBe(
      false
    );
  });
});

describe("pixelsToGridRows", () => {
  // 80px rows with 16px between them: 1 row = 80px, 2 rows = 176px, 3 rows = 272px.
  test("takes the fewest rows that hold the content", () => {
    expect(pixelsToGridRows(80, 80, 16)).toBe(1);
    expect(pixelsToGridRows(81, 80, 16)).toBe(2);
    expect(pixelsToGridRows(176, 80, 16)).toBe(2);
    expect(pixelsToGridRows(177, 80, 16)).toBe(3);
  });

  test("is at least one row and at most the grid's limit", () => {
    expect(pixelsToGridRows(0, 80, 16)).toBe(1);
    expect(pixelsToGridRows(Number.NaN, 80, 16)).toBe(1);
    expect(pixelsToGridRows(100_000, 80, 16, 8)).toBe(8);
  });
});

describe("fitBlockHeights", () => {
  const block = (
    id: string,
    kind: "text" | "image" | "chart" | "separator",
    y: number,
    h = 2,
    pageId = "p1"
  ) => ({
    id,
    kind,
    pageId,
    layout: { x: 0, y, w: 3, h },
  });

  test("grows a block to the rows its content needs and keeps a block made taller than that", () => {
    const widgets = [block("a", "text", 0, 6), block("b", "image", 0), block("c", "text", 4)];
    const fitted = fitBlockHeights(
      widgets,
      new Map([
        ["a", 1],
        ["b", 4],
        ["c", 3],
      ])
    );
    expect(fitted.map((widget) => widget.layout.h)).toEqual([6, 4, 3]);
  });

  test("leaves charts, separators and unmeasured blocks alone", () => {
    const widgets = [
      block("chart", "chart", 0, 4),
      block("sep", "separator", 0, 1),
      block("t", "text", 0, 2),
    ];
    const fitted = fitBlockHeights(
      widgets,
      new Map([
        ["chart", 1],
        ["sep", 3],
      ])
    );
    expect(fitted).toBe(widgets);
  });

  test("returns the same array when nothing changes", () => {
    const widgets = [block("a", "text", 0, 2)];
    expect(fitBlockHeights(widgets, new Map([["a", 2]]))).toBe(widgets);
  });
});
