import type { OxlintConfig } from "oxlint";

/** A partial oxlint config that `compose()` merges into a full one. */
export type ConfigFragment = Partial<OxlintConfig>;
