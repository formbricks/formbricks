import * as fs from "node:fs";
import * as path from "node:path";
import objectHash from "object-hash";
import { describe, expect, test, vi } from "vitest";
import {
  type LocaleTranslations,
  type ScanResults,
  type TranslationKeys,
  checkIncompleteTranslations,
  checkPlaceholderParity,
  compareKeys,
  detectKeysWithSpaces,
  displayResults,
  extractKeysFromContent,
  extractPlaceholders,
  flattenKeys,
  flattenValues,
  forEachConcurrently,
  loadAllLocaleTranslations,
  parseLockfile,
  stripComments,
  validateLockfile,
} from "./scan-translations";

describe("forEachConcurrently", () => {
  test("runs every item once, never more than the limit at a time", async () => {
    const seen: number[] = [];
    let inFlight = 0;
    let peak = 0;
    await forEachConcurrently(
      Array.from({ length: 50 }, (_, i) => i),
      4,
      async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        seen.push(item);
        inFlight -= 1;
      }
    );

    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(peak).toBe(4);
  });

  test.each([0, -1, 2.5, Number.NaN])("refuses a concurrency of %s", async (concurrency) => {
    await expect(forEachConcurrently([1, 2, 3], concurrency, () => Promise.resolve())).rejects.toThrow(
      "positive integer"
    );
  });

  test.each([1, 3])(
    "runs every remaining item after a task rejects, then rejects with each failure (concurrency %s)",
    async (concurrency) => {
      const seen: number[] = [];
      const run = forEachConcurrently([0, 1, 2, 3, 4, 5], concurrency, async (item) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        seen.push(item);
        if (item === 1 || item === 4) throw new Error(`item ${item.toString()} failed`);
      });

      const failure = await run.then(
        () => null,
        (error: unknown) => error
      );
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors.map((error: Error) => error.message).sort()).toEqual([
        "item 1 failed",
        "item 4 failed",
      ]);
      expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    }
  );

  test("does nothing for no items", async () => {
    let calls = 0;
    await forEachConcurrently([], 8, () => {
      calls += 1;
      return Promise.resolve();
    });
    expect(calls).toBe(0);
  });
});

describe("Translation Scanner", () => {
  describe("stripComments", () => {
    test("removes single-line comments", () => {
      const content = `
        const test = t("valid.key");
        // t("comment.key")
        const another = t("another.key");
      `;
      const result = stripComments(content);
      expect(result).not.toContain('t("comment.key")');
      expect(result).toContain('t("valid.key")');
      expect(result).toContain('t("another.key")');
    });

    test("removes multi-line comments", () => {
      const content = `
        const test = t("valid.key");
        /* 
         * t("comment.key")
         * t("another.comment")
         */
        const another = t("another.key");
      `;
      const result = stripComments(content);
      expect(result).not.toContain('t("comment.key")');
      expect(result).not.toContain('t("another.comment")');
      expect(result).toContain('t("valid.key")');
      expect(result).toContain('t("another.key")');
    });

    test("removes inline multi-line comments", () => {
      const content = `const test = t("valid.key"); /* t("comment") */ const another = t("another.key");`;
      const result = stripComments(content);
      expect(result).not.toContain('t("comment")');
      expect(result).toContain('t("valid.key")');
      expect(result).toContain('t("another.key")');
    });

    test("handles mixed comments", () => {
      const content = `
        const test = t("valid.key");
        // Single line comment t("comment1")
        const another = t("another.key");
        /* Multi-line comment
         * t("comment2")
         */
        const third = t("third.key"); // t("comment3")
      `;
      const result = stripComments(content);
      expect(result).not.toContain('t("comment1")');
      expect(result).not.toContain('t("comment2")');
      expect(result).not.toContain('t("comment3")');
      expect(result).toContain('t("valid.key")');
      expect(result).toContain('t("another.key")');
      expect(result).toContain('t("third.key")');
    });

    test("preserves code without comments", () => {
      const content = `
        const test = t("valid.key");
        const another = t("another.key");
      `;
      const result = stripComments(content);
      expect(result).toContain('t("valid.key")');
      expect(result).toContain('t("another.key")');
    });

    test("handles empty content", () => {
      expect(stripComments("")).toBe("");
    });

    test("handles content with only comments", () => {
      const content = `
        // Comment only
        /* Another comment */
      `;
      const result = stripComments(content);
      expect(result.trim()).not.toContain("Comment only");
      expect(result.trim()).not.toContain("Another comment");
    });

    test("preserves URLs with // in them", () => {
      const content = `
        const link = "https://formbricks.com";
        const link2 = "http://example.com";
        const text = t("valid.key");
      `;
      const result = stripComments(content);
      expect(result).toContain("https://formbricks.com");
      expect(result).toContain("http://example.com");
      expect(result).toContain('t("valid.key")');
    });

    test("preserves translation keys on same line as URLs", () => {
      const content = `<Link href="https://formbricks.com">{t("s.create_your_own")}</Link>`;
      const result = stripComments(content);
      expect(result).toContain('t("s.create_your_own")');
      expect(result).toContain("https://formbricks.com");
    });

    test("removes actual comments but preserves URLs", () => {
      const content = `
        const url = "https://formbricks.com";
        // This is a real comment with t("comment.key")
        const text = t("valid.key");
        const api = "http://api.example.com"; // Comment after URL
      `;
      const result = stripComments(content);
      expect(result).toContain("https://formbricks.com");
      expect(result).toContain("http://api.example.com");
      expect(result).toContain('t("valid.key")');
      expect(result).not.toContain('t("comment.key")');
      expect(result).not.toContain("Comment after URL");
    });
  });

  describe("extractKeysFromContent", () => {
    test('extracts keys from t("key") pattern with double quotes', () => {
      const content = `const text = t("auth.login");`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
    });

    test("extracts keys from t('key') pattern with single quotes", () => {
      const content = `const text = t('auth.login');`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
    });

    test("extracts keys from t(`key`) pattern with backticks", () => {
      const content = "const text = t(`auth.login`);";
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
    });

    test('extracts keys from i18nKey="key" pattern', () => {
      const content = `<Trans i18nKey="auth.login" />`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
    });

    test("extracts keys from i18nKey={'key'} pattern", () => {
      const content = `<Trans i18nKey={'auth.login'} />`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
    });

    test('extracts keys from i18nKey={"key"} pattern', () => {
      const content = `<Trans i18nKey={"auth.login"} />`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
    });

    test("extracts multiple keys from the same file", () => {
      const content = `
        const title = t("auth.login");
        const subtitle = t("auth.subtitle");
        <Trans i18nKey="auth.description" />
      `;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login");
      expect(keys).toContain("auth.subtitle");
      expect(keys).toContain("auth.description");
    });

    test("skips dynamic keys with ${}", () => {
      const content = "const text = t('auth.${type}.title`);";
      const keys = extractKeysFromContent(content);
      expect(keys).not.toContain("auth.${type}.title");
    });

    test("skips dynamic keys with {{}}", () => {
      const content = 'const text = t("auth.{{type}}.title");';
      const keys = extractKeysFromContent(content);
      expect(keys).not.toContain("auth.{{type}}.title");
    });

    test("skips keys with closing braces", () => {
      const content = 'const text = t("auth.}title");';
      const keys = extractKeysFromContent(content);
      expect(keys).not.toContain("auth.}title");
    });

    test("ignores keys in comments", () => {
      const content = `
        const text = t("valid.key");
        // t("comment.key")
        /* t("another.comment") */
      `;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("valid.key");
      expect(keys).not.toContain("comment.key");
      expect(keys).not.toContain("another.comment");
    });

    test("handles nested translation calls", () => {
      const content = `
        const message = condition ? t("key1") : t("key2");
      `;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
    });

    test("extracts keys with dots in the path", () => {
      const content = `const text = t("auth.login.form.submit");`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login.form.submit");
    });

    test("extracts keys with underscores", () => {
      const content = `const text = t("auth.login_form");`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login_form");
    });

    test("extracts keys with hyphens", () => {
      const content = `const text = t("auth.login-form");`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.login-form");
    });

    test("extracts keys with numbers", () => {
      const content = `const text = t("auth.error404");`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("auth.error404");
    });

    test("handles whitespace around function calls", () => {
      const content = `
        const text1 = t  (  "key1"  );
        const text2 = t( "key2" );
        const text3 = t("key3");
      `;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    test("returns empty array for content without translation keys", () => {
      const content = `
        const hello = "world";
        function test() { return "value"; }
      `;
      const keys = extractKeysFromContent(content);
      expect(keys).toEqual([]);
    });

    test("extracts keys with spaces (for later validation)", () => {
      const content = `const text = t("key with spaces");`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("key with spaces");
    });

    test("extracts keys from lines containing URLs", () => {
      const content = `<Link href="https://formbricks.com">{t("s.create_your_own")}</Link>`;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("s.create_your_own");
      expect(keys).toHaveLength(1);
    });

    test("extracts keys from multiple lines with URLs and comments", () => {
      const content = `
        const url = "https://example.com";
        const text = t("valid.key");
        // This is a comment t("comment.key")
        <a href="http://test.com">{t("another.key")}</a>
      `;
      const keys = extractKeysFromContent(content);
      expect(keys).toContain("valid.key");
      expect(keys).toContain("another.key");
      expect(keys).not.toContain("comment.key");
      expect(keys).toHaveLength(2);
    });
  });

  describe("flattenKeys", () => {
    test("flattens a simple nested object", () => {
      const input: TranslationKeys = {
        auth: {
          login: "Login",
          logout: "Logout",
        },
      };
      const result = flattenKeys(input);
      expect(result).toContain("auth.login");
      expect(result).toContain("auth.logout");
      expect(result).toHaveLength(2);
    });

    test("flattens a deeply nested object", () => {
      const input: TranslationKeys = {
        auth: {
          login: {
            form: {
              submit: "Submit",
              cancel: "Cancel",
            },
          },
        },
      };
      const result = flattenKeys(input);
      expect(result).toContain("auth.login.form.submit");
      expect(result).toContain("auth.login.form.cancel");
      expect(result).toHaveLength(2);
    });

    test("handles a flat object", () => {
      const input: TranslationKeys = {
        login: "Login",
        logout: "Logout",
        signup: "Sign Up",
      };
      const result = flattenKeys(input);
      expect(result).toContain("login");
      expect(result).toContain("logout");
      expect(result).toContain("signup");
      expect(result).toHaveLength(3);
    });

    test("handles mixed nesting levels", () => {
      const input: TranslationKeys = {
        auth: {
          login: "Login",
          form: {
            email: "Email",
          },
        },
        home: "Home",
      };
      const result = flattenKeys(input);
      expect(result).toContain("auth.login");
      expect(result).toContain("auth.form.email");
      expect(result).toContain("home");
      expect(result).toHaveLength(3);
    });

    test("handles empty object", () => {
      const input: TranslationKeys = {};
      const result = flattenKeys(input);
      expect(result).toEqual([]);
    });

    test("handles keys with special characters", () => {
      const input: TranslationKeys = {
        "auth-login": "Login",
        auth_logout: "Logout",
      };
      const result = flattenKeys(input);
      expect(result).toContain("auth-login");
      expect(result).toContain("auth_logout");
    });

    test("maintains key order", () => {
      const input: TranslationKeys = {
        a: "A",
        b: {
          c: "C",
          d: "D",
        },
        e: "E",
      };
      const result = flattenKeys(input);
      expect(result).toEqual(["a", "b.c", "b.d", "e"]);
    });

    test("handles numeric string values", () => {
      const input: TranslationKeys = {
        count: {
          one: "1 item",
          many: "{{count}} items",
        },
      };
      const result = flattenKeys(input);
      expect(result).toContain("count.one");
      expect(result).toContain("count.many");
    });

    test("handles keys with dots in their names", () => {
      const input: TranslationKeys = {
        "file.name": {
          label: "File Name",
        },
      };
      const result = flattenKeys(input);
      expect(result).toContain("file.name.label");
    });
  });

  describe("flattenValues", () => {
    test("maps dotted keys to their messages", () => {
      expect(flattenValues({ auth: { login: "Login", form: { email: "Email" } }, home: "Home" })).toEqual({
        "auth.login": "Login",
        "auth.form.email": "Email",
        home: "Home",
      });
    });

    test("skips leaves that are not messages", () => {
      const input = { count: 3, label: "Label" } as unknown as TranslationKeys;
      expect(flattenValues(input)).toEqual({ label: "Label" });
    });

    test("keeps a key named __proto__ as a plain entry", () => {
      const input = JSON.parse('{"__proto__": "Literal", "other": "Other"}') as TranslationKeys;
      const values = flattenValues(input);

      expect(Object.hasOwn(values, "__proto__")).toBe(true);
      expect(values.__proto__).toBe("Literal");
      expect(values.other).toBe("Other");
    });
  });

  describe("detectKeysWithSpaces", () => {
    test("detects keys with spaces in used keys", () => {
      const usedKeys = new Set(["valid.key", "key with space", "another.valid"]);
      const translationKeys = new Set(["valid.key", "another.valid"]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result).toContain("key with space");
      expect(result.size).toBe(1);
    });

    test("detects keys with spaces in translation keys", () => {
      const usedKeys = new Set(["valid.key"]);
      const translationKeys = new Set(["valid.key", "key with space"]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result).toContain("key with space");
      expect(result.size).toBe(1);
    });

    test("detects keys with tabs", () => {
      const usedKeys = new Set(["key\twith\ttab"]);
      const translationKeys = new Set([]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result).toContain("key\twith\ttab");
      expect(result.size).toBe(1);
    });

    test("detects keys with newlines", () => {
      const usedKeys = new Set(["key\nwith\nnewline"]);
      const translationKeys = new Set([]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result).toContain("key\nwith\nnewline");
      expect(result.size).toBe(1);
    });

    test("detects multiple keys with spaces", () => {
      const usedKeys = new Set(["key with space", "another space key"]);
      const translationKeys = new Set(["third space key"]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result).toContain("key with space");
      expect(result).toContain("another space key");
      expect(result).toContain("third space key");
      expect(result.size).toBe(3);
    });

    test("returns empty set when no keys have spaces", () => {
      const usedKeys = new Set(["valid.key", "another.valid.key", "third_key"]);
      const translationKeys = new Set(["valid.key", "another.valid.key"]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result.size).toBe(0);
    });

    test("deduplicates keys that appear in both sets", () => {
      const usedKeys = new Set(["key with space"]);
      const translationKeys = new Set(["key with space"]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result.size).toBe(1);
      expect(result).toContain("key with space");
    });

    test("handles empty sets", () => {
      const usedKeys = new Set<string>();
      const translationKeys = new Set<string>();
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result.size).toBe(0);
    });

    test("allows keys with underscores", () => {
      const usedKeys = new Set(["valid_key_with_underscores"]);
      const translationKeys = new Set([]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result.size).toBe(0);
    });

    test("allows keys with hyphens", () => {
      const usedKeys = new Set(["valid-key-with-hyphens"]);
      const translationKeys = new Set([]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result.size).toBe(0);
    });

    test("allows keys with dots", () => {
      const usedKeys = new Set(["valid.key.with.dots"]);
      const translationKeys = new Set([]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result.size).toBe(0);
    });

    test("detects mixed whitespace characters", () => {
      const usedKeys = new Set(["key with\ttab and\nnewline"]);
      const translationKeys = new Set([]);
      const result = detectKeysWithSpaces(usedKeys, translationKeys);
      expect(result).toContain("key with\ttab and\nnewline");
      expect(result.size).toBe(1);
    });
  });

  describe("extractPlaceholders", () => {
    test("collects a simple ICU argument", () => {
      expect(extractPlaceholders("Max file size limit is {maxSize} MB.")).toEqual({
        icu: ["maxSize"],
        i18next: [],
      });
    });

    test("collects the plural argument once, however often the branches repeat it", () => {
      expect(
        extractPlaceholders("{count, plural, one {{count} attribute} other {{count} attributes}}")
      ).toEqual({
        icu: ["count"],
        i18next: [],
      });
    });

    test("collects the select argument and the placeholders inside its branches", () => {
      expect(extractPlaceholders("{gender, select, other {{name} joined}}")).toEqual({
        icu: ["gender", "name"],
        i18next: [],
      });
    });

    test("keeps i18next-style placeholders separate from ICU ones", () => {
      expect(extractPlaceholders("Connected with {{workspace}} workspace")).toEqual({
        icu: [],
        i18next: ["workspace"],
      });
    });

    test("reports both syntaxes when a message mixes them", () => {
      expect(extractPlaceholders("{{current}} / {{limit}} {unit}")).toEqual({
        icu: ["unit"],
        i18next: ["current", "limit"],
      });
    });

    test("ignores HTML, which the runtime hands to IntlMessageFormat as literal text", () => {
      expect(extractPlaceholders("Write <b>bold</b> {name}")).toEqual({ icu: ["name"], i18next: [] });
    });

    test("returns empty sets for a message without placeholders", () => {
      expect(extractPlaceholders("Just text, and a lone brace is fine: 100%")).toEqual({
        icu: [],
        i18next: [],
      });
    });

    test("collects number, date and time arguments", () => {
      expect(extractPlaceholders("{a, number} {b, date} {c, time}")).toEqual({
        icu: ["a", "b", "c"],
        i18next: [],
      });
    });

    test("treats ICU-escaped braces as literal text", () => {
      expect(extractPlaceholders("The '{'key'}' is written out")).toEqual({ icu: [], i18next: [] });
    });

    test("throws for a message the runtime cannot format", () => {
      expect(() => extractPlaceholders("{count, plural, one {# item} other {# items}")).toThrow();
    });
  });

  describe("checkPlaceholderParity", () => {
    const asLocaleMap = (locales: Record<string, Record<string, string>>) => new Map(Object.entries(locales));

    test("reports nothing when the placeholders match", () => {
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { greeting: "Hey {name}", warning: "Including: {{surveys}}" },
          "de-DE": { greeting: "Hallo {name}", warning: "Einschließlich: {{surveys}}" },
        }),
        "en-US"
      );

      expect(mismatches.size).toBe(0);
    });

    test("reports a translation that dropped a placeholder", () => {
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { reset: "The link is valid for {minutes} minutes." },
          "pt-BR": { reset: "O link é válido por 24 horas." },
        }),
        "en-US"
      );

      expect(mismatches.get("pt-BR")).toEqual([
        { key: "reset", expected: { icu: ["minutes"], i18next: [] }, actual: { icu: [], i18next: [] } },
      ]);
    });

    test("reports a placeholder that changed syntax", () => {
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { warning: "Including: {surveys}" },
          "de-DE": { warning: "Einschließlich: {{surveys}}" },
        }),
        "en-US"
      );

      expect(mismatches.get("de-DE")).toEqual([
        {
          key: "warning",
          expected: { icu: ["surveys"], i18next: [] },
          actual: { icu: [], i18next: ["surveys"] },
        },
      ]);
    });

    test("accepts a translation that drops plural branches but keeps the argument", () => {
      // Languages without a plural form legitimately collapse `one`/`other` into one message.
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { options: "{count, plural, one {# option} other {# options}}" },
          "zh-Hans-CN": { options: "{count} 个选项" },
        }),
        "en-US"
      );

      expect(mismatches.size).toBe(0);
    });

    test("reports a placeholder nothing passes", () => {
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { title: "Hello" },
          "de-DE": { title: "Hallo {name}" },
        }),
        "en-US"
      );

      expect(mismatches.get("de-DE")).toEqual([
        { key: "title", expected: { icu: [], i18next: [] }, actual: { icu: ["name"], i18next: [] } },
      ]);
    });

    test("reports an unparseable translation instead of throwing", () => {
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { options: "{count, plural, one {# option} other {# options}}" },
          "sv-SE": { options: "{count, plural, one {# alternativ} other {# alternativ}" },
        }),
        "en-US"
      );

      expect(mismatches.get("sv-SE")).toEqual([
        { key: "options", expected: { icu: ["count"], i18next: [] }, actual: null },
      ]);
    });

    test("does not treat inherited Object keys as translated keys", () => {
      // `toString` exists on every object; without an own-property check this would be read as the
      // locale's translated message and reported as unparseable.
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { toString: "Hello {name}" },
          "de-DE": {},
        }),
        "en-US"
      );

      expect(mismatches.size).toBe(0);
    });

    test("ignores keys the locale does not have", () => {
      // A missing key is checkIncompleteTranslations' finding, not a placeholder mismatch.
      const mismatches = checkPlaceholderParity(
        asLocaleMap({
          "en-US": { present: "{x}", absent: "{y}" },
          "de-DE": { present: "{x}" },
        }),
        "en-US"
      );

      expect(mismatches.size).toBe(0);
    });

    test("throws when the default locale is absent", () => {
      expect(() => checkPlaceholderParity(asLocaleMap({ "de-DE": { a: "{x}" } }), "en-US")).toThrow(
        "Default locale en-US not found"
      );
    });

    test("fails when a default-locale message is not valid ICU", () => {
      // The runtime cannot format it either, so the scan must not silently skip it.
      expect(() =>
        checkPlaceholderParity(
          asLocaleMap({
            "en-US": { broken: "{count, plural" },
            "de-DE": { broken: "kaputt" },
          }),
          "en-US"
        )
      ).toThrow(/Default locale message "broken" is not valid ICU/);
    });
  });

  describe("checkIncompleteTranslations", () => {
    const localeOf = (values: Record<string, string>): LocaleTranslations => ({
      keys: new Set(Object.keys(values)),
      values,
    });

    test("lists the keys each locale is missing", () => {
      const incomplete = checkIncompleteTranslations(
        new Map([
          ["en-US", localeOf({ a: "", b: "" })],
          ["de-DE", localeOf({ a: "" })],
          ["fr-FR", localeOf({ a: "", b: "" })],
        ]),
        "en-US"
      );

      expect([...incomplete.entries()]).toEqual([["de-DE", ["b"]]]);
    });

    test("throws when the default locale is absent", () => {
      expect(() => checkIncompleteTranslations(new Map(), "en-US")).toThrow("Default locale en-US not found");
    });
  });

  describe("compareKeys", () => {
    const localeOf = (values: Record<string, string>): LocaleTranslations => ({
      keys: new Set(Object.keys(values)),
      values,
    });

    test("reports missing, unused, spaced and placeholder-drifting keys together", () => {
      const results = compareKeys(
        new Set(["used.key", "missing.key", "key with space"]),
        new Set(["used.key", "unused.key", "drifted.key", "key with space"]),
        new Map([
          [
            "en-US",
            localeOf({
              "used.key": "Used",
              "unused.key": "Unused",
              "drifted.key": "Hello {name}",
              "key with space": "Spaced",
            }),
          ],
          ["de-DE", localeOf({ "used.key": "Benutzt", "drifted.key": "Hallo" })],
        ]),
        "en-US",
        "Test"
      );

      expect([...results.missingKeys]).toEqual(["missing.key"]);
      expect([...results.unusedKeys].sort()).toEqual(["drifted.key", "unused.key"]);
      expect([...results.keysWithSpaces]).toEqual(["key with space"]);
      expect([...results.incompleteTranslations.keys()]).toEqual(["de-DE"]);
      expect(results.placeholderMismatches.get("de-DE")).toEqual([
        {
          key: "drifted.key",
          expected: { icu: ["name"], i18next: [] },
          actual: { icu: [], i18next: [] },
        },
      ]);
    });
  });

  describe("displayResults", () => {
    const resultsWith = (overrides: Partial<ScanResults>): ScanResults => ({
      usedKeys: new Set(["a.b"]),
      translationKeys: new Set(["a.b"]),
      missingKeys: new Set(),
      unusedKeys: new Set(),
      incompleteTranslations: new Map(),
      placeholderMismatches: new Map(),
      keysWithSpaces: new Set(),
      lockfileValidation: { missing: [], outOfSync: [], extra: [] },
      ...overrides,
    });

    const loggedOutput = (results: ScanResults): string => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        displayResults(results, "Test", "en-US");
        return log.mock.calls.flat().join("\n");
      } finally {
        log.mockRestore();
      }
    };

    test("announces matching placeholders when nothing is wrong", () => {
      expect(loggedOutput(resultsWith({}))).toContain("All locale placeholders match");
    });

    test("prints each mismatch with the expected and found placeholders", () => {
      const output = loggedOutput(
        resultsWith({
          placeholderMismatches: new Map([
            [
              "de-DE",
              [
                {
                  key: "a.b",
                  expected: { icu: ["minutes"], i18next: [] },
                  actual: { icu: [], i18next: ["minutes"] },
                },
                { key: "a.c", expected: { icu: ["x"], i18next: [] }, actual: null },
              ],
            ],
          ]),
        })
      );

      expect(output).toContain("PLACEHOLDER MISMATCHES");
      expect(output).toContain("en-US: {minutes}");
      expect(output).toContain("de-DE: {{minutes}}");
      expect(output).toContain("de-DE: (not valid ICU)");
    });

    test("truncates long per-locale lists", () => {
      const mismatches = Array.from({ length: 11 }, (_, index) => ({
        key: `key.${index.toString().padStart(2, "0")}`,
        expected: { icu: ["x"], i18next: [] },
        actual: null,
      }));

      expect(
        loggedOutput(resultsWith({ placeholderMismatches: new Map([["de-DE", mismatches]]) }))
      ).toContain("... and 1 more");
    });
  });

  describe("loadAllLocaleTranslations", () => {
    const withTempLocales = async (
      files: Record<string, string>,
      run: (localesDir: string) => Promise<void>
    ): Promise<void> => {
      const tempBaseDir = fs.mkdtempSync(path.join(__dirname, "temp-test-i18n-load-"));
      const localesDir = path.join(tempBaseDir, "locales");
      fs.mkdirSync(localesDir);

      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(localesDir, name), content);
      }

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await run(localesDir);
      } finally {
        log.mockRestore();
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      }
    };

    test("loads every locale's keys and messages", async () => {
      await withTempLocales(
        {
          "en-US.json": JSON.stringify({ auth: { login: "Login" } }),
          "de-DE.json": JSON.stringify({ auth: { login: "Anmeldung" } }),
        },
        async (localesDir) => {
          const translations = await loadAllLocaleTranslations(localesDir, "en-US", "Test");

          expect(translations.get("de-DE")).toEqual({
            keys: new Set(["auth.login"]),
            values: { "auth.login": "Anmeldung" },
          });
        }
      );
    });

    test("throws for a locale file that is not valid JSON", async () => {
      await withTempLocales(
        { "en-US.json": JSON.stringify({ a: "A" }), "de-DE.json": "{ not json" },
        async (localesDir) => {
          await expect(loadAllLocaleTranslations(localesDir, "en-US", "Test")).rejects.toThrow(
            "Failed to parse"
          );
        }
      );
    });

    test("throws when the default locale is missing", async () => {
      await withTempLocales({ "de-DE.json": JSON.stringify({ a: "A" }) }, async (localesDir) => {
        await expect(loadAllLocaleTranslations(localesDir, "en-US", "Test")).rejects.toThrow(
          "Default locale en-US not found"
        );
      });
    });
  });

  describe("Integration tests", () => {
    test("complete workflow: extract, flatten, and validate keys", () => {
      // Simulated source code
      const sourceCode = `
        import { useTranslation } from 'react-i18next';
        
        export function LoginForm() {
          const { t } = useTranslation();
          
          return (
            <div>
              <h1>{t("auth.login.title")}</h1>
              <p>{t("auth.login.description")}</p>
              // This is a comment: t("should.be.ignored")
              <button>{t("auth.login.submit")}</button>
            </div>
          );
        }
      `;

      // Simulated translation file
      const translations: TranslationKeys = {
        auth: {
          login: {
            title: "Login",
            description: "Please log in to continue",
            submit: "Submit",
          },
        },
      };

      // Extract keys from source
      const usedKeys = extractKeysFromContent(sourceCode);
      expect(usedKeys).not.toContain("should.be.ignored");

      // Flatten translation keys
      const translationKeys = flattenKeys(translations);

      // Verify all used keys exist in translations
      for (const key of usedKeys) {
        expect(translationKeys).toContain(key);
      }

      // Check for spaces
      const usedKeysSet = new Set(usedKeys);
      const translationKeysSet = new Set(translationKeys);
      const keysWithSpaces = detectKeysWithSpaces(usedKeysSet, translationKeysSet);
      expect(keysWithSpaces.size).toBe(0);
    });

    test("detects missing keys", () => {
      const sourceCode = `
        const title = t("auth.login.title");
        const missing = t("auth.login.missing");
      `;

      const translations: TranslationKeys = {
        auth: {
          login: {
            title: "Login",
          },
        },
      };

      const usedKeys = extractKeysFromContent(sourceCode);
      const translationKeys = flattenKeys(translations);

      expect(usedKeys).toContain("auth.login.missing");
      expect(translationKeys).not.toContain("auth.login.missing");
    });

    test("detects unused keys", () => {
      const sourceCode = `
        const title = t("auth.login.title");
      `;

      const translations: TranslationKeys = {
        auth: {
          login: {
            title: "Login",
            unused: "This is not used",
          },
        },
      };

      const usedKeys = extractKeysFromContent(sourceCode);
      const translationKeys = flattenKeys(translations);

      expect(translationKeys).toContain("auth.login.unused");
      expect(usedKeys).not.toContain("auth.login.unused");
    });

    test("handles real-world complex scenario", () => {
      const sourceCode = `
        import { useTranslation } from 'react-i18next';
        import { Trans } from 'react-i18next';
        import Link from 'next/link';
        
        export function ComplexComponent() {
          const { t } = useTranslation();
          
          // Comment with t("ignored.key")
          const title = t("page.title");
          const subtitle = t('page.subtitle');
          const description = t(\`page.description\`);
          
          /* 
           * Multi-line comment
           * t("also.ignored")
           */
          
          return (
            <div>
              <h1>{title}</h1>
              <h2>{subtitle}</h2>
              <p>{description}</p>
              <Trans i18nKey="page.footer" />
              <Trans i18nKey={'page.header'} />
              <Trans i18nKey={"page.sidebar"} />
              <Link href="https://formbricks.com">{t("page.link")}</Link>
              {/* Inline comment t("inline.ignored") */}
            </div>
          );
        }
      `;

      const translations: TranslationKeys = {
        page: {
          title: "Title",
          subtitle: "Subtitle",
          description: "Description",
          footer: "Footer",
          header: "Header",
          sidebar: "Sidebar",
          link: "Create your own",
        },
      };

      const usedKeys = extractKeysFromContent(sourceCode);
      const translationKeys = flattenKeys(translations);

      // Verify valid keys are extracted
      expect(usedKeys).toContain("page.title");
      expect(usedKeys).toContain("page.subtitle");
      expect(usedKeys).toContain("page.description");
      expect(usedKeys).toContain("page.footer");
      expect(usedKeys).toContain("page.header");
      expect(usedKeys).toContain("page.sidebar");
      expect(usedKeys).toContain("page.link");

      // Verify commented keys are ignored
      expect(usedKeys).not.toContain("ignored.key");
      expect(usedKeys).not.toContain("also.ignored");
      expect(usedKeys).not.toContain("inline.ignored");

      // Verify no missing keys
      for (const key of usedKeys) {
        expect(translationKeys).toContain(key);
      }

      // Verify no keys with spaces
      const usedKeysSet = new Set(usedKeys);
      const translationKeysSet = new Set(translationKeys);
      const keysWithSpaces = detectKeysWithSpaces(usedKeysSet, translationKeysSet);
      expect(keysWithSpaces.size).toBe(0);
    });
  });

  describe("Lockfile Verification", () => {
    test("parseLockfile parses 4-space/32-hex line format", () => {
      const lockfileContent = `
# This is a comment
    auth.login: 20e1a4569e2b15c6d6b47b96e2b15c6d
    common.welcome: ea458b6dfc45f4486fbcfb895cf3bd38
    another_key: aaaaaabbbbbbccccccddddddeeeeee12
`;
      const result = parseLockfile(lockfileContent);
      expect(result).toEqual({
        "auth.login": "20e1a4569e2b15c6d6b47b96e2b15c6d",
        "common.welcome": "ea458b6dfc45f4486fbcfb895cf3bd38",
        another_key: "aaaaaabbbbbbccccccddddddeeeeee12",
      });
    });

    test("object-hash vs plain md5 check", () => {
      // In Lingo.dev / object-hash:
      // objectHash.MD5("Welcome to Formbricks") should match expected hash
      const val = "Welcome to Formbricks";
      const expectedHash = objectHash.MD5(val);
      // To prevent regressions where someone might change objectHash.MD5 to standard crypto MD5
      // crypto.createHash("md5").update("Welcome to Formbricks").digest("hex") would yield:
      // "7c7a10271701e0004944fb7f0f6797a1"
      // But objectHash.MD5 yields "7ce863429c5176739b8e0a1ea023f411"
      expect(expectedHash).toBe("7ce863429c5176739b8e0a1ea023f411");
      expect(expectedHash).not.toBe("7c7a10271701e0004944fb7f0f6797a1");
    });

    test("validateLockfile identifies missing, outOfSync, and extra keys", async () => {
      // Create a temporary directory structure
      const tempBaseDir = fs.mkdtempSync(path.join(__dirname, "temp-test-i18n-"));
      const localesDir = path.join(tempBaseDir, "locales");
      fs.mkdirSync(localesDir);

      // Write mock default locale JSON: default locale is en-US.json
      const localeData = {
        auth: {
          login: "Welcome to Formbricks", // outOfSync because hash will differ
          logout: "Sign out", // missing from lockfile
        },
        common: {
          welcome: "Hello", // in sync
        },
      };
      fs.writeFileSync(path.join(localesDir, "en-US.json"), JSON.stringify(localeData, null, 2));

      // Calculate correct hash for Hello
      const helloHash = objectHash.MD5("Hello");

      // Write mock i18n.lock
      const lockfileData = `
    common/welcome: ${helloHash}
    auth/login: 11111111111111111111111111111111
    common/extra_key: 320adebde930a8ae9253b8febf19e751
`;
      fs.writeFileSync(path.join(tempBaseDir, "i18n.lock"), lockfileData);

      try {
        const validation = await validateLockfile(localesDir, "en-US");
        expect(validation).not.toBeNull();
        if (validation) {
          expect(validation.missing).toContain("auth/logout");
          expect(validation.outOfSync).toContain("auth/login");
          expect(validation.extra).toContain("common/extra_key");

          expect(validation.missing.length).toBe(1);
          expect(validation.outOfSync.length).toBe(1);
          expect(validation.extra.length).toBe(1);
        }
      } finally {
        // Cleanup files
        fs.unlinkSync(path.join(localesDir, "en-US.json"));
        fs.unlinkSync(path.join(tempBaseDir, "i18n.lock"));
        fs.rmdirSync(localesDir);
        fs.rmdirSync(tempBaseDir);
      }
    });

    test("validateLockfile returns null when no lockfile exists", async () => {
      const tempBaseDir = fs.mkdtempSync(path.join(__dirname, "temp-test-i18n-no-lock-"));
      const localesDir = path.join(tempBaseDir, "locales");
      fs.mkdirSync(localesDir);

      try {
        const validation = await validateLockfile(localesDir, "en-US");
        expect(validation).toBeNull();
      } finally {
        fs.rmdirSync(localesDir);
        fs.rmdirSync(tempBaseDir);
      }
    });
  });
});
