import { describe, expect, test } from "vitest";
import { prescanCustomCss } from "./prescan";

const LIMITS = { maxNestingDepth: 3, maxFunctionDepth: 3, maxBlocks: 10 };
const scan = (source: string) => prescanCustomCss(source, LIMITS);

describe("prescanCustomCss", () => {
  test("counts blocks and accepts nesting up to the limits", () => {
    expect(scan(".a { .b { .c { color: red } } }")).toEqual({ ok: true, blocks: 3 });
    expect(scan(".a { width: calc(1px + min(2px, max(3px, 4px))) }")).toEqual({ ok: true, blocks: 1 });
    expect(scan(".a { width: calc(1px + min(2px, max(3px, clamp(1px, 2px, 3px)))) }").ok).toBe(false);
  });

  test("reports the kind and 1-based position of the first opener past a limit", () => {
    expect(scan(".a {\n  .b { .c {\n .d { } } } }")).toEqual({
      ok: false,
      kind: "nesting",
      line: 3,
      column: 5,
    });
    expect(scan("a{b:f(f(f(f(1))))}")).toEqual({ ok: false, kind: "function", line: 1, column: 12 });
    expect(scan("a{}".repeat(11))).toMatchObject({ ok: false, kind: "rules" });
  });

  test("ignores brackets inside strings, comments, escapes and url tokens", () => {
    expect(scan('.a { content: "{{{{((((" }')).toEqual({ ok: true, blocks: 1 });
    expect(scan(".a { content: '}}}}' } /* {{{{ */")).toEqual({ ok: true, blocks: 1 });
    expect(scan(String.raw`.a\{\{\{\{ { color: red }`)).toEqual({ ok: true, blocks: 1 });
    expect(scan(".a { background: url(a{{{{(b.png) }")).toEqual({ ok: true, blocks: 1 });
    expect(scan(".a { background: URL( a{{{{.png ) }")).toEqual({ ok: true, blocks: 1 });
  });

  test("a stray closer does not cancel an opener of another kind", () => {
    expect(scan(".a { ) ) ) .b { ] ] .c { .d { } } } }")).toMatchObject({ ok: false, kind: "nesting" });
  });

  test("cannot be fooled into skipping real brackets", () => {
    // A comment start inside an unquoted url is part of the url, not a comment.
    expect(scan(".a { b: url(/*) } .c { .d { .e { .f {} } } }")).toMatchObject({
      ok: false,
      kind: "nesting",
    });
    // A quoted url( is a function: its string ends where the quote does.
    expect(scan('.a { b: url( ")" ) } .c { .d { .e { .f {} } } }')).toMatchObject({
      ok: false,
      kind: "nesting",
    });
    // An escaped "url" is still a url; a dimension ending in "url" is not.
    expect(scan(String.raw`.a { b: u\72 l(/*) } .c { .d { .e { .f {} } } }`)).toMatchObject({ ok: false });
    expect(scan(".a { b: 1url(/*) } .c { .d { .e { .f {} } } } */")).toEqual({ ok: true, blocks: 1 });
    // A bad string ends at the newline, so the braces on the next line count.
    expect(scan('.a { b: "unterminated\n} .c { .d { .e { .f {} } } }')).toMatchObject({ ok: false });
    // NUL is an ident code point after preprocessing, so "a\0url(" is one function name, not a url.
    expect(scan(".a { b: a\u0000url((((( }")).toMatchObject({ ok: false, kind: "function" });
  });

  test("handles escapes at the end of input and out-of-range hex escapes", () => {
    expect(scan(".a\\")).toEqual({ ok: true, blocks: 0 });
    expect(scan(String.raw`.\110000 { color: red }`)).toEqual({ ok: true, blocks: 1 });
    expect(scan('.a { content: "\\')).toEqual({ ok: true, blocks: 1 });
  });

  test("rejects pathological depth in linear time", () => {
    const start = performance.now();
    const deep = prescanCustomCss(".a{".repeat(50_000), {
      maxNestingDepth: 8,
      maxFunctionDepth: 16,
      maxBlocks: 100_000,
    });
    expect(deep).toMatchObject({ ok: false, kind: "nesting" });
    const wide = prescanCustomCss("a{b:c}".repeat(20_000), {
      maxNestingDepth: 8,
      maxFunctionDepth: 16,
      maxBlocks: 100_000,
    });
    expect(wide).toEqual({ ok: true, blocks: 20_000 });
    expect(performance.now() - start).toBeLessThan(1_000);
  });
});
