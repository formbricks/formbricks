import enUS from "@/locales/en-US.json";

/**
 * `@/lingodotdev/server` for a pipeline test: `getTranslate` reads the en-US strings and fills `{name}`
 * placeholders, so a draft is named as an English-speaking user's import names it. Used as
 * `vi.mock("@/lingodotdev/server", () => import(".../lingodotdev-server-en-us"))`.
 */
const lookup = (key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], enUS);

/** One en-US string, its `{name}` placeholders filled; the key itself where there is no string. */
const translate = (key: string, options: Record<string, unknown> = {}): string => {
  const value = lookup(key);
  return (typeof value === "string" ? value : key).replaceAll(/\{(\w+)\}/g, (match, name: string) =>
    name in options ? String(options[name]) : match
  );
};

export const getTranslate = (): Promise<typeof translate> => Promise.resolve(translate);
