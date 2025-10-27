import { describe, expect, test } from "vitest";
import {
  type TranslationKeys,
  detectKeysWithSpaces,
  extractKeysFromContent,
  flattenKeys,
  stripComments,
} from "./scan-translations";

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
      // eslint-disable-next-line no-template-curly-in-string -- we want to test the dynamic key
      const content = "const text = t('auth.${type}.title`);";
      const keys = extractKeysFromContent(content);
      // eslint-disable-next-line no-template-curly-in-string -- we want to test the dynamic key
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
});
