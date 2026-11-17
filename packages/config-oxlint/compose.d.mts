import type { ExternalPluginEntry, OxlintConfig } from "oxlint";
import type { ConfigFragment } from "./types.mjs";

export declare const jsPlugins: Record<
  "formbricks" | "reactJs" | "sonarjs" | "turbo" | "unicornJs",
  ExternalPluginEntry
>;
export declare function compose(
  ...fragments: (ConfigFragment | ConfigFragment[] | undefined)[]
): OxlintConfig;
export declare function downgradeToWarn<T extends Record<string, unknown>>(rules: T): T;
export declare function denyWarnings<T extends OxlintConfig>(config: T): T;
