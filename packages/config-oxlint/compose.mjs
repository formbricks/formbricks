import { fileURLToPath } from "node:url";

const resolvePackage = (specifier) => fileURLToPath(import.meta.resolve(specifier));

/*
 * JS plugins: ESLint plugins oxlint runs through its ESLint-compatible plugin API, for the rules it
 * does not implement natively. They resolve relative to the config file that declares them, and the
 * tiers are declared here but consumed from every workspace, so each one is passed as an absolute
 * path. The names `react` and `unicorn` are taken by oxlint's native plugins, hence the `react-js`
 * and `unicorn-js` aliases for the plugins' own versions of rules oxlint lacks or implements narrower.
 */
export const jsPlugins = {
  formbricks: {
    name: "formbricks",
    specifier: fileURLToPath(new URL("./plugins/formbricks.mjs", import.meta.url)),
  },
  reactJs: { name: "react-js", specifier: resolvePackage("eslint-plugin-react") },
  sonarjs: { name: "sonarjs", specifier: resolvePackage("eslint-plugin-sonarjs") },
  turbo: { name: "turbo", specifier: resolvePackage("eslint-plugin-turbo") },
  unicornJs: { name: "unicorn-js", specifier: resolvePackage("eslint-plugin-unicorn") },
};

const unique = (values, key = (value) => value) => {
  const seen = new Map();
  for (const value of values) seen.set(key(value), value);
  return [...seen.values()];
};

/*
 * Merges config fragments in order, later fragments winning per rule, as ESLint flat config merged
 * its blocks. Overrides keep their order. Unlike ESLint, oxlint applies every matching override
 * after the top-level rules, so a fragment that switches a rule off for some files does it in an
 * override.
 */
export function compose(...fragments) {
  const config = {
    plugins: [],
    jsPlugins: [],
    categories: {},
    env: {},
    globals: {},
    settings: {},
    rules: {},
    overrides: [],
    ignorePatterns: [],
  };
  for (const fragment of fragments.flat()) {
    if (!fragment) continue;
    config.plugins.push(...(fragment.plugins ?? []));
    config.jsPlugins.push(...(fragment.jsPlugins ?? []));
    Object.assign(config.categories, fragment.categories);
    Object.assign(config.env, fragment.env);
    Object.assign(config.globals, fragment.globals);
    for (const [name, value] of Object.entries(fragment.settings ?? {})) {
      config.settings[name] =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? { ...config.settings[name], ...value }
          : value;
    }
    Object.assign(config.rules, fragment.rules);
    config.overrides.push(...(fragment.overrides ?? []));
    config.ignorePatterns.push(...(fragment.ignorePatterns ?? []));
  }
  config.plugins = unique(config.plugins);
  // An entry is a specifier string or a `{ name, specifier }` object; dedupe each by what names it.
  config.jsPlugins = unique(config.jsPlugins, (plugin) =>
    typeof plugin === "string" ? plugin : plugin.name
  );
  config.ignorePatterns = unique(config.ignorePatterns);
  return config;
}

/* Returns `rules` with every "error" lowered to "warn", options kept. */
export const downgradeToWarn = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([id, entry]) => {
      if (Array.isArray(entry)) {
        const [severity, ...options] = entry;
        return [id, severity === "error" ? ["warn", ...options] : entry];
      }
      return [id, entry === "error" ? "warn" : entry];
    })
  );

/*
 * Returns `config` with every "warn" raised to "error", in its rules and its overrides. oxlint runs
 * once for the whole repo, so a workspace that must stay warning-free (ESLint's `--max-warnings 0`)
 * makes its warnings errors instead.
 */
export const denyWarnings = (config) => {
  const raise = (rules = {}) =>
    Object.fromEntries(
      Object.entries(rules).map(([id, entry]) => {
        if (Array.isArray(entry)) {
          const [severity, ...options] = entry;
          return [id, severity === "warn" ? ["error", ...options] : entry];
        }
        return [id, entry === "warn" ? "error" : entry];
      })
    );
  return {
    ...config,
    rules: raise(config.rules),
    overrides: (config.overrides ?? []).map((override) => ({ ...override, rules: raise(override.rules) })),
  };
};
