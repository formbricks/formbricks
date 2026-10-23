import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { hasCaseVariantKey, parseGatewayJsonObject, scanTopLevelKeys } from "./json-body";

describe("scanTopLevelKeys", () => {
  test("returns top-level keys in source order, repeats included", () => {
    expect(scanTopLevelKeys('{"b":1,"a":2,"b":3}')).toEqual(["b", "a", "b"]);
  });

  test("ignores keys of nested objects and objects inside arrays", () => {
    expect(
      scanTopLevelKeys('{"a":{"tenant_id":"x","b":{"c":1}},"d":[{"e":1},{"f":[2,{"g":3}]}],"h":null}')
    ).toEqual(["a", "d", "h"]);
  });

  test("does not mistake string values for keys", () => {
    expect(scanTopLevelKeys('{"a":"tenant_id","b":["tenant_id","x"],"c":"d"}')).toEqual(["a", "b", "c"]);
  });

  test("is not fooled by quotes, backslashes, braces and commas inside strings", () => {
    const json = String.raw`{"a\"b":"x\\","c":"}{,\"d\":1","e\\\"":"[\"f\""}`;
    expect(scanTopLevelKeys(json)).toEqual(Object.keys(JSON.parse(json)));
    expect(scanTopLevelKeys(json)).toEqual(['a"b', "c", 'e\\"']);
  });

  test("decodes escaped keys", () => {
    expect(scanTopLevelKeys(String.raw`{"\u0054ENANT_ID":1,"tenant\u005fid":2}`)).toEqual([
      "TENANT_ID",
      "tenant_id",
    ]);
  });

  test("handles insignificant whitespace", () => {
    expect(scanTopLevelKeys(' \n{ "a" : 1 ,\t"b"\r\n:\n[ ] }\n')).toEqual(["a", "b"]);
  });

  test("returns no keys for an empty object", () => {
    expect(scanTopLevelKeys("{}")).toEqual([]);
  });

  test("scans deep nesting iteratively, without exhausting the stack", () => {
    const depth = 100_000;
    const json = `{"a":${"[".repeat(depth)}${"]".repeat(depth)},"b":1}`;
    expect(scanTopLevelKeys(json)).toEqual(["a", "b"]);
  });

  // Outside its precondition the scanner may throw, but it must never spin: the string loop is bounded
  // by the input length as well as by the closing quote.
  test("stops at the end of input that breaks its precondition", () => {
    expect(() => scanTopLevelKeys('{"unterminated')).toThrow(SyntaxError);
  });

  test("property: matches Object.keys for any object JSON.stringify produces", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ unit: "binary" }), fc.jsonValue()), (object) => {
        const json = JSON.stringify(object);
        expect(scanTopLevelKeys(json)).toEqual(Object.keys(JSON.parse(json)));
      }),
      { numRuns: 1000 }
    );
  });

  // JSON.stringify always escapes a lone surrogate, so the properties above never send one raw. The
  // fast path takes a key without backslashes as its raw text; this pins that the raw text is exactly
  // what JSON.parse decodes, for every code unit a JSON string may hold unescaped.
  test("property: an unescaped key is read exactly as JSON.parse reads it", () => {
    const rawUnit = fc.integer({ min: 0x20, max: 0xffff }).filter((unit) => unit !== 0x22 && unit !== 0x5c);

    fc.assert(
      fc.property(fc.array(rawUnit, { maxLength: 12 }), (units) => {
        const key = String.fromCharCode(...units);
        const json = `{"${key}":1,"after":2}`;

        expect(scanTopLevelKeys(json)).toEqual([...Object.keys(JSON.parse(json))]);
      }),
      { numRuns: 5000 }
    );
  });

  test("property: reports every key of a hand-assembled object, duplicates and all", () => {
    // Writes a key the way any JSON producer may: each UTF-16 unit either as itself (JSON-escaped
    // only where it must be) or as a `\uXXXX` escape.
    const encodeKey = (key: string, escapeMask: boolean[]): string =>
      `"${Array.from({ length: key.length }, (_, index) =>
        escapeMask[index % Math.max(escapeMask.length, 1)]
          ? `\\u${key.charCodeAt(index).toString(16).padStart(4, "0")}`
          : JSON.stringify(key[index]).slice(1, -1)
      ).join("")}"`;

    const whitespace = fc.constantFrom("", " ", "\n", "\t", "\r\n  ");
    const entry = fc.record({
      key: fc.string({ unit: "binary" }),
      escapeMask: fc.array(fc.boolean(), { maxLength: 8 }),
      value: fc.jsonValue(),
      indent: fc.constantFrom(undefined, 2, "\t"),
      before: whitespace,
      after: whitespace,
    });

    fc.assert(
      fc.property(fc.array(entry, { minLength: 1, maxLength: 20 }), whitespace, (entries, outer) => {
        const members = entries.map(
          ({ key, escapeMask, value, indent, before, after }) =>
            `${before}${encodeKey(key, escapeMask)}${after}:${after}${JSON.stringify(value, null, indent)}${before}`
        );
        const json = `${outer}{${members.join(",")}}${outer}`;

        expect(() => JSON.parse(json)).not.toThrow();
        expect(scanTopLevelKeys(json)).toEqual(entries.map(({ key }) => key));
      }),
      { numRuns: 2000 }
    );
  });
});

describe("parseGatewayJsonObject", () => {
  test("accepts a plain object and returns its body and keys", () => {
    expect(parseGatewayJsonObject('{"tenant_id":"a","metadata":{"TENANT_ID":"b"}}')).toEqual({
      ok: true,
      body: { tenant_id: "a", metadata: { TENANT_ID: "b" } },
      keys: ["tenant_id", "metadata"],
    });
  });

  test("refuses invalid JSON, including trailing data", () => {
    expect(parseGatewayJsonObject('{"tenant_id":"a"')).toEqual({ ok: false, reason: "invalid_json" });
    expect(parseGatewayJsonObject('{"tenant_id":"a"} {"tenant_id":"b"}')).toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  test.each(["[]", '[{"tenant_id":"a"}]', '"tenant_id"', "1", "null", "true"])(
    "refuses a top-level %s that is not an object",
    (json) => {
      expect(parseGatewayJsonObject(json)).toEqual({ ok: false, reason: "not_object" });
    }
  );

  test("refuses a repeated top-level key, which JSON.parse would silently collapse", () => {
    expect(parseGatewayJsonObject('{"tenant_id":"a","tenant_id":"b"}')).toEqual({
      ok: false,
      reason: "duplicate_key",
    });
    expect(parseGatewayJsonObject(String.raw`{"tenant_id":"a","tenant\u005fid":"b"}`)).toEqual({
      ok: false,
      reason: "duplicate_key",
    });
  });

  test("allows the same key inside nested objects", () => {
    expect(parseGatewayJsonObject('{"a":{"x":1},"b":{"x":2}}').ok).toBe(true);
  });

  // Go folds `K` (Kelvin sign) onto `k` and `ſ` (long s) onto `s`, so those two reach ASCII fields in
  // the Hub; the rest fold elsewhere (Turkish dotless/dotted i), so are refused without relying on any
  // one consumer's folding.
  test.each(["\u212Aind", "\u017Ftatus", "tenant_ıd", "tenant_İd", "naïve"])(
    "refuses the non-ASCII top-level key %s",
    (key) => {
      expect(parseGatewayJsonObject(JSON.stringify({ tenant_id: "a", [key]: "b" }))).toEqual({
        ok: false,
        reason: "non_ascii_key",
      });
    }
  );

  test("refuses a non-ASCII key written as an escape", () => {
    expect(parseGatewayJsonObject(String.raw`{"tenant_\u0131d":"b"}`)).toEqual({
      ok: false,
      reason: "non_ascii_key",
    });
  });

  test("allows non-ASCII in values and in nested keys", () => {
    expect(parseGatewayJsonObject('{"value_text":"naïve ı","metadata":{"ı":"x"}}').ok).toBe(true);
  });
});

describe("hasCaseVariantKey", () => {
  test.each([["TENANT_ID"], ["Tenant_Id"], ["tenant_iD"]])("flags %s next to tenant_id", (variant) => {
    expect(hasCaseVariantKey(["tenant_id", variant], "tenant_id")).toBe(true);
    expect(hasCaseVariantKey([variant, "tenant_id"], "tenant_id")).toBe(true);
  });

  test("flags a case variant even without the canonical key", () => {
    expect(hasCaseVariantKey(["TENANT_ID"], "tenant_id")).toBe(true);
  });

  test("does not flag the canonical key or unrelated keys", () => {
    expect(hasCaseVariantKey(["tenant_id", "tenant", "tenant_ids", "field_id"], "tenant_id")).toBe(false);
    expect(hasCaseVariantKey([], "tenant_id")).toBe(false);
  });
});
