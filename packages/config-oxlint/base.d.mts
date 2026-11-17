import type { ConfigFragment } from "./types.mjs";

export { compose, denyWarnings, downgradeToWarn, jsPlugins } from "./compose.mjs";
export declare const TYPESCRIPT_FILES: string[];
export declare const PLAIN_JS_FILES: string[];
export declare const unusedVarsOptions: Record<string, string>;
export declare const sortImportsRule: ["error", { ignoreDeclarationSort: boolean; ignoreCase: boolean }];
export declare const commonIgnores: ConfigFragment;
export declare const base: ConfigFragment;
export declare const reactCompilerRulesOptOut: ConfigFragment;
export declare const reactSettings: { react: { version: string } };
