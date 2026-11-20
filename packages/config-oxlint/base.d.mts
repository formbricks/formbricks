import type { OxlintConfig } from "oxlint";
import type { ConfigFragment } from "./types.mjs";

export { compose, jsPlugins } from "./compose.mjs";
export declare function denyWarnings<T extends OxlintConfig>(config: T): T;
export declare const TYPESCRIPT_FILES: string[];
export declare const PLAIN_JS_FILES: string[];
export declare const unusedVarsOptions: Record<string, string>;
export declare const commonIgnores: ConfigFragment;
export declare const base: ConfigFragment;
export declare const reactSettings: { react: { version: string } };
