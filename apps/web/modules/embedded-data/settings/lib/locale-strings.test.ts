import { IntlMessageFormat } from "intl-messageformat";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Every string this page renders has to parse as ICU, in every locale.
 *
 * The app registers `i18next-icu` (`lingodotdev/server.ts`, `lingodotdev/client.tsx`), and once it is
 * registered i18next's own `{{ }}` interpolator never runs — `IntlMessageFormat` is handed the raw
 * string instead. It rejects `{{name}}` as a malformed argument, and `i18next-icu`'s default
 * `parseErrorHandler` returns the string unchanged, so the placeholder reaches the screen verbatim.
 *
 * That is not hypothetical: eight keys on this page shipped as `{{name}}` and rendered
 * "{{name}} created" in all fifteen locales. Nothing caught it — `pnpm i18n:validate` checks that
 * keys exist, not that they parse, and a malformed plural is equally invisible to it.
 *
 * Scoped to this page's block on purpose. The same check run repo-wide is red today for ~20
 * pre-existing keys, so widening it is its own piece of work rather than something to smuggle in
 * here; the value of this test is that the page it guards starts clean and stays clean.
 */
const LOCALES_DIR = path.join(__dirname, "../../../../locales");

const embeddedDataStrings = (file: string): Record<string, string> => {
  const json = JSON.parse(readFileSync(path.join(LOCALES_DIR, file), "utf8")) as Record<string, unknown>;
  const workspace = json.workspace as Record<string, unknown> | undefined;
  return (workspace?.embedded_data ?? {}) as Record<string, string>;
};

describe("workspace.embedded_data locale strings", () => {
  const files = readdirSync(LOCALES_DIR).filter((file) => file.endsWith(".json"));

  test("every locale file is covered, so this cannot pass by finding nothing", () => {
    expect(files.length).toBeGreaterThan(1);
    expect(Object.keys(embeddedDataStrings("en-US.json")).length).toBeGreaterThan(0);
  });

  test.each(files)("%s parses as ICU", (file) => {
    const unparseable = Object.entries(embeddedDataStrings(file))
      .filter(([, value]) => typeof value === "string")
      .filter(([, value]) => {
        try {
          // The locale only decides which plural categories are *meaningful*, not whether the
          // message parses, so one is enough to catch a malformed argument or an unclosed brace.
          new IntlMessageFormat(value, "en");
          return false;
        } catch {
          return true;
        }
      })
      .map(([key]) => key);

    expect(unparseable).toEqual([]);
  });
});
