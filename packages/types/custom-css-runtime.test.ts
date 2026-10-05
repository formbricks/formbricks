import { describe, expect, test } from "vitest";
import { getRenderedCustomCss, stripCustomCssSource } from "./custom-css-runtime";

describe("custom CSS delivery", () => {
  const saved = {
    processorVersion: 1,
    light: { source: "/* private source */ body { color: red }", compiled: "#fbjs{color:red!important}" },
    dark: null,
  };
  test("sends accepted CSS without editable source", () => {
    expect(getRenderedCustomCss(saved)).toEqual({ light: saved.light.compiled, dark: undefined });
    expect(JSON.stringify(stripCustomCssSource(saved))).not.toContain("private source");
    expect(saved.light.source).toContain("private source");
  });
  test("fails closed when the compiled artifact uses a different policy", () => {
    expect(getRenderedCustomCss({ ...saved, processorVersion: 2 })).toBeUndefined();
    expect(stripCustomCssSource({ ...saved, processorVersion: 2 })).toBeNull();
  });
});
