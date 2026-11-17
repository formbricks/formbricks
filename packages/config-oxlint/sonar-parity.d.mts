import type { ConfigFragment } from "./types.mjs";

type Severity = "off" | "warn" | "error";
export declare const TEST_FILES: string[];
export declare const stagedSeverity: () => Severity;
export declare const sonarParity: (stagedLinesSeverity?: Severity) => ConfigFragment;
export declare const sonarParityTyped: () => ConfigFragment;
export declare const a11yParity: () => ConfigFragment;
export declare const STAGED_LINES_RULE_IDS: string[];
