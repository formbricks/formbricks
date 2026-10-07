import { describe, expect, test } from "vitest";
import { prescanCustomCss, removePrescanImports } from "./prescan";

const LIMITS = { maxNestingDepth: 3, maxFunctionDepth: 3, maxBlocks: 10 };
const scan = (source: string) => prescanCustomCss(source, LIMITS);

describe("prescanCustomCss", () => {
  test("counts blocks and accepts nesting up to the limits", () => {
    expect(scan(".a { .b { .c { color: red } } }")).toEqual({ ok: true, blocks: 3, imports: [] });
    expect(scan(".a { width: calc(1px + min(2px, max(3px, 4px))) }")).toEqual({
      ok: true,
      blocks: 1,
      imports: [],
    });
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
    expect(scan('.a { content: "{{{{((((" }')).toEqual({ ok: true, blocks: 1, imports: [] });
    expect(scan(".a { content: '}}}}' } /* {{{{ */")).toEqual({ ok: true, blocks: 1, imports: [] });
    expect(scan(String.raw`.a\{\{\{\{ { color: red }`)).toEqual({ ok: true, blocks: 1, imports: [] });
    expect(scan(".a { background: url(a{{{{(b.png) }")).toEqual({ ok: true, blocks: 1, imports: [] });
    expect(scan(".a { background: URL( a{{{{.png ) }")).toEqual({ ok: true, blocks: 1, imports: [] });
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
    expect(scan(".a { b: 1url(/*) } .c { .d { .e { .f {} } } } */")).toEqual({
      ok: true,
      blocks: 1,
      imports: [],
    });
    // A bad string ends at the newline, so the braces on the next line count.
    expect(scan('.a { b: "unterminated\n} .c { .d { .e { .f {} } } }')).toMatchObject({ ok: false });
    // NUL is an ident code point after preprocessing, so "a\0url(" is one function name, not a url.
    expect(scan(".a { b: a\u0000url((((( }")).toMatchObject({ ok: false, kind: "function" });
  });

  test("handles escapes at the end of input and out-of-range hex escapes", () => {
    expect(scan(".a\\")).toEqual({ ok: true, blocks: 0, imports: [] });
    expect(scan(String.raw`.\110000 { color: red }`)).toEqual({ ok: true, blocks: 1, imports: [] });
    expect(scan('.a { content: "\\')).toEqual({ ok: true, blocks: 1, imports: [] });
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
    expect(wide).toEqual({ ok: true, blocks: 20_000, imports: [] });
    expect(performance.now() - start).toBeLessThan(1_000);
  });
});

describe("top-level @import rules", () => {
  const importsOf = (source: string) => {
    const result = scan(source);
    if (!result.ok) throw new Error("expected the scan to pass");
    return result.imports;
  };

  test("finds every top-level @import, wherever it sits, up to its own semicolon", () => {
    const source = '@import "a.css";\n.a { color: red }\n  @IMPORT url(b.css) screen;\n.b {}';
    expect(importsOf(source)).toEqual([
      { start: 0, end: 16, line: 1, column: 1 },
      { start: 37, end: 63, line: 3, column: 3 },
    ]);
    expect(source.slice(37, 63)).toBe("@IMPORT url(b.css) screen;");
  });

  test("a semicolon inside a string, url or parentheses does not end the rule; a block does", () => {
    const source = String.raw`@import "a;b.css" supports(display: grid; x: y) url(c;d); @import 'e' { .x {} } .c {}`;
    const imports = importsOf(source);
    expect(imports.map(({ start, end }) => source.slice(start, end))).toEqual([
      String.raw`@import "a;b.css" supports(display: grid; x: y) url(c;d);`,
      "@import 'e' { .x {} }",
    ]);
  });

  test("an escaped name is still @import; nested ones, lookalikes, strings and comments are not", () => {
    expect(importsOf(String.raw`@\69 mport "a.css";`)).toHaveLength(1);
    expect(importsOf('@media screen { @import "a.css"; } .a { @import "b.css"; }')).toEqual([]);
    expect(importsOf('@imports "a"; @impor "b"; .a { content: "@import x;" } /* @import y; */')).toEqual([]);
  });

  test("an @import left open runs to the end of the source", () => {
    expect(importsOf('.a {} @import "a.css"')).toEqual([{ start: 6, end: 21, line: 1, column: 7 }]);
  });

  test("removal blanks each rule but keeps every line break, including CR LF pairs", () => {
    const source = '.a {}\r\n@import "a.css"\r\n  screen;\r\n.b { color: red }';
    const blanked = removePrescanImports(source, importsOf(source));
    expect(blanked).toBe(".a {}\r\n" + " ".repeat(15) + "\r\n" + " ".repeat(9) + "\r\n.b { color: red }");
    expect(removePrescanImports(".a {}", [])).toBe(".a {}");
  });
});
