import { describe, expect, test } from "vitest";
import { findJsonSyntaxError, findJsonVariableTokens, insertJsonVariableToken } from "./json-editor";

describe("findJsonSyntaxError", () => {
  test("accepts valid JSON", () => {
    expect(findJsonSyntaxError('{\n  "a": [1, -2.5e3, true, null, "x\\n"],\n  "b": {}\n}')).toBeNull();
  });

  test("marks the line the comma is missing from, not the line the parser stopped on", () => {
    const body = '{\n  "customer_id": "C-1",\n  "agent_id": "A-42"\n  "channel": "call"\n}';
    expect(findJsonSyntaxError(body)).toMatchObject({ code: "missing_comma", line: 3 });
  });

  test.each([
    ['{\n  "a": 1,\n}', "trailing_comma", 2],
    ['{\n  "a": "open\n}', "unterminated_string", 2],
    ["{\n  name: 1\n}", "property_name", 2],
    ['{\n  "a" 1\n}', "missing_colon", 2],
    ["{\n  \"a\": 'x'\n}", "invalid_value", 2],
    ["[1, 2]\n[3]", "extra_content", 2],
    ['{\n  "a": [1, 2\n\n', "unexpected_end", 2],
  ] as const)("reports %j as %s on line %i", (text, code, line) => {
    expect(findJsonSyntaxError(text)).toMatchObject({ code, line });
  });

  test("treats blank text as an error unless empty is allowed", () => {
    expect(findJsonSyntaxError("  \n")).toMatchObject({ code: "unexpected_end" });
    expect(findJsonSyntaxError("  \n", { allowEmpty: true })).toBeNull();
  });

  test("reports nesting past the cap instead of overflowing the stack", () => {
    const deep = "[".repeat(100_000);
    expect(findJsonSyntaxError(deep)).toMatchObject({ code: "too_deep", line: 1 });
  });
});

describe("insertJsonVariableToken", () => {
  test("inserts a whole value as a quoted token, so the body stays valid JSON", () => {
    const text = '{ "customer_id": @ }';
    const at = text.indexOf("@");
    const result = insertJsonVariableToken(text, at, at + 1, { path: "payload.customer.id" });
    expect(result.text).toBe('{ "customer_id": "#recall:payload.customer.id/fallback:#" }');
    expect(result.cursor).toBe(result.text.indexOf(" }"));
    expect(findJsonSyntaxError(result.text)).toBeNull();
  });

  test("inserts inside a string as escaped text, so a fallback with quotes cannot end the string", () => {
    const text = '{ "note": "Hi @, thanks" }';
    const at = text.indexOf("@");
    const result = insertJsonVariableToken(text, at, at + 1, {
      path: "payload.customer.name",
      fallback: 'our "valued" customer',
    });
    expect(result.text).toBe(
      String.raw`{ "note": "Hi #recall:payload.customer.name/fallback:our \"valued\" customer#, thanks" }`
    );
    expect(findJsonSyntaxError(result.text)).toBeNull();
  });
});

describe("findJsonVariableTokens", () => {
  test("finds whole-value tokens including their quotes, and tokens inside text", () => {
    const text =
      '{\n  "id": "#recall:payload.customer.id/fallback:#",\n  "note": "Hi #recall:payload.name/fallback:there#!"\n}';
    expect(findJsonVariableTokens(text)).toEqual([
      {
        from: text.indexOf('"#recall:payload.customer.id'),
        to: text.indexOf(',\n  "note"'),
        path: "payload.customer.id",
        isWholeValue: true,
      },
      {
        from: text.indexOf("#recall:payload.name"),
        to: text.indexOf('!"'),
        path: "payload.name",
        isWholeValue: false,
      },
    ]);
  });

  test("ignores token-like text outside strings and in property names", () => {
    const text = '{ "#recall:payload.a/fallback:#": #recall:payload.b/fallback:# }';
    expect(findJsonVariableTokens(text)).toEqual([]);
  });
});
