import { describe, expect, test } from "vitest";
import { checkCustomCssFile, stripByteOrderMark } from "./upload";

describe("checkCustomCssFile", () => {
  test("accepts a .css file, whether or not the browser reports its MIME type", () => {
    expect(checkCustomCssFile({ name: "theme.css", type: "text/css", size: 10 }, "survey")).toEqual({
      ok: true,
    });
    expect(checkCustomCssFile({ name: "THEME.CSS", type: "", size: 10 }, "survey")).toEqual({ ok: true });
  });

  test("rejects other files", () => {
    expect(checkCustomCssFile({ name: "theme.scss", type: "", size: 10 }, "survey")).toEqual({
      ok: false,
      reason: "type",
    });
    expect(checkCustomCssFile({ name: "theme.css", type: "text/html", size: 10 }, "survey")).toEqual({
      ok: false,
      reason: "type",
    });
  });

  test("rejects a file over the scope's byte budget", () => {
    expect(checkCustomCssFile({ name: "a.css", type: "text/css", size: 20_000 }, "survey")).toEqual({
      ok: true,
    });
    expect(checkCustomCssFile({ name: "a.css", type: "text/css", size: 20_001 }, "survey")).toEqual({
      ok: false,
      reason: "size",
    });
    expect(checkCustomCssFile({ name: "a.css", type: "text/css", size: 20_001 }, "workspace")).toEqual({
      ok: true,
    });
  });
});

describe("stripByteOrderMark", () => {
  test("removes only a leading BOM", () => {
    expect(stripByteOrderMark("﻿a{}")).toBe("a{}");
    expect(stripByteOrderMark("a{}﻿")).toBe("a{}﻿");
  });
});
