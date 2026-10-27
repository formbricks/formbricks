import type {
  TCustomCssAppearance,
  TCustomCssError,
  TCustomCssErrorCode,
  TCustomCssScope,
  TCustomCssWarning,
  TCustomCssWarningCode,
} from "@formbricks/types/custom-css";
import { CUSTOM_CSS_MAX_WARNINGS } from "./constants";

/** A 1-based position in one field's source, or no position at all. */
export interface TIssueLocation {
  line: number | null;
  column: number | null;
}

export const NO_LOCATION: TIssueLocation = { line: null, column: null };

const toPositive = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : null;

/** lightningcss rule locations count lines from 0 and columns from 1. */
export const fromRuleLocation = (loc: { line: number; column: number } | null | undefined): TIssueLocation =>
  loc ? { line: toPositive(loc.line + 1), column: toPositive(loc.column) } : NO_LOCATION;

/** `url()` and parse-error locations count both from 1. */
export const fromOneBasedLocation = (loc: unknown): TIssueLocation => {
  if (!loc || typeof loc !== "object") return NO_LOCATION;
  const { line, column } = loc as { line?: unknown; column?: unknown };
  return { line: toPositive(line), column: toPositive(column) };
};

/** A failure that rejects the whole operation; nothing compiled is returned with it. */
export class CustomCssRejection extends Error {
  constructor(
    readonly code: TCustomCssErrorCode,
    readonly reason: string,
    readonly appearance: TCustomCssAppearance | null,
    readonly location: TIssueLocation = NO_LOCATION
  ) {
    super(reason);
    this.name = "CustomCssRejection";
  }

  toError(scope: TCustomCssScope): TCustomCssError {
    return {
      code: this.code,
      scope,
      appearance: this.appearance,
      line: this.location.line,
      column: this.location.column,
      reason: this.reason,
    };
  }
}

/** Collects warnings for one operation, keeping only the first `CUSTOM_CSS_MAX_WARNINGS`. */
export class WarningSink {
  readonly warnings: TCustomCssWarning[] = [];

  constructor(private readonly scope: TCustomCssScope) {}

  add(
    code: TCustomCssWarningCode,
    appearance: TCustomCssAppearance,
    reason: string,
    location: TIssueLocation
  ): void {
    if (this.warnings.length >= CUSTOM_CSS_MAX_WARNINGS) return;
    this.warnings.push({
      code,
      scope: this.scope,
      appearance,
      line: location.line,
      column: location.column,
      reason,
    });
  }
}

/** Reasons for parse errors. lightningcss messages quote the offending tokens, so they are never passed on. */
const SYNTAX_ERROR_REASONS: Record<string, string> = {
  EndOfInput: "Unexpected end of the CSS here; a brace, bracket or quote is probably unbalanced.",
  UnexpectedImportRule: "@import must come before all other rules (and is removed anyway).",
  UnexpectedNamespaceRule: "@namespace must come before all other rules (and is removed anyway).",
  UnexpectedToken: "Unexpected token; this is not valid CSS.",
  InvalidDeclaration: "Invalid declaration.",
  InvalidMediaQuery: "Invalid media query.",
  InvalidNesting: "Invalid nested rule.",
  QualifiedRuleInvalid: "Invalid rule.",
  AtRuleBodyInvalid: "Invalid at-rule block.",
  AtRulePreludeInvalid: "Invalid at-rule.",
  SelectorError: "Invalid selector.",
};

export const toSyntaxRejection = (error: unknown, appearance: TCustomCssAppearance): CustomCssRejection => {
  const data = (error as { data?: { type?: unknown } } | null)?.data;
  const type = typeof data?.type === "string" ? data.type : "";
  const reason = Object.hasOwn(SYNTAX_ERROR_REASONS, type)
    ? SYNTAX_ERROR_REASONS[type]
    : "This is not valid CSS.";
  return new CustomCssRejection(
    "syntax_error",
    reason,
    appearance,
    fromOneBasedLocation((error as { loc?: unknown } | null)?.loc)
  );
};
