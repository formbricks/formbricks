import enUS from "@/locales/en-US.json";

/**
 * `@/lingodotdev/server` for a pipeline test: `getTranslate` reads the en-US strings and fills `{name}`
 * placeholders, so a draft is named as an English-speaking user's import names it. Used as
 * `vi.mock("@/lingodotdev/server", () => import(".../lingodotdev-server-en-us"))`.
 */
const lookup = (key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], enUS);

export const getTranslate =
  async () =>
  (key: string, options: Record<string, unknown> = {}): string =>
    String(lookup(key) ?? key).replaceAll(/\{(\w+)\}/g, (match, name: string) =>
      name in options ? String(options[name]) : match
    );
