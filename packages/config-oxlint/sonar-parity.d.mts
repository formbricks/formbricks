import type { ConfigFragment } from "./types.mjs";

type Severity = "off" | "warn" | "error";
export declare const TEST_FILES: string[];
export declare const stagedSeverity: () => Severity;
export declare const sonarParity: (severity?: Severity) => ConfigFragment;
export declare const sonarParityTyped: (severity?: Severity) => ConfigFragment;
export declare const a11yParity: (severity?: Severity) => ConfigFragment;
export declare const SONAR_PARITY_RULE_IDS: string[];
