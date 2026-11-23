import type { ExternalPluginEntry, OxlintConfig } from "oxlint";
import type { ConfigFragment } from "./types.mjs";

export declare const jsPlugins: Record<"formbricks" | "sonarjs" | "turbo" | "unicornJs", ExternalPluginEntry>;
export declare function compose(
  ...fragments: (ConfigFragment | ConfigFragment[] | undefined)[]
): OxlintConfig;
export declare function raiseWarnings<T extends OxlintConfig>(
  config: T,
  options?: { except?: readonly string[] }
): T;
