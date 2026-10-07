import "server-only";
import {
  type Declaration,
  type DeclarationBlock,
  type Rule,
  type Selector,
  type StyleSheet,
  transform,
} from "lightningcss";
import { logger } from "@formbricks/logger";
import {
  CUSTOM_CSS_MAX_SOURCE_BYTES,
  type TCustomCssAppearance,
  type TCustomCssError,
  type TCustomCssInput,
  type TCustomCssScope,
  type TCustomCssWarning,
  ZCustomCssScope,
} from "@formbricks/types/custom-css";
import {
  BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES,
  CUSTOM_CSS_EXCLUDE_FEATURES,
  CUSTOM_CSS_INCLUDE_FEATURES,
  CUSTOM_CSS_MAX_FUNCTION_DEPTH,
  CUSTOM_CSS_MAX_NESTING_DEPTH,
  CUSTOM_CSS_MAX_RULES,
  CUSTOM_CSS_MAX_SELECTOR_COMPOUNDS,
  CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH,
  CUSTOM_CSS_MAX_UNIVERSAL_COMPOUNDS,
  CUSTOM_CSS_TARGETS,
  REMOVED_AT_RULE_NAMES,
  getCustomCssLayerName,
  getCustomCssProcessorVersion,
} from "./constants";
import {
  type TDeclarationPolicy,
  checkDeclaration,
  hasResourceInSupportsCondition,
  renameKeyframeReferences,
  scanValue,
} from "./declarations";
import {
  CustomCssRejection,
  NO_LOCATION,
  type TIssueLocation,
  WarningSink,
  fromRuleLocation,
  toSyntaxRejection,
} from "./issues";
import { prescanCustomCss, removePrescanImports } from "./prescan";
import {
  type TSubjectPosition,
  measureSelector,
  scopeNestedSelector,
  scopeTopLevelSelector,
  verifyCompiledSelector,
} from "./selectors";

export type TCustomCssProcessResult =
  | {
      ok: true;
      compiled: { light: string | null; dark: string | null };
      warnings: TCustomCssWarning[];
      processorVersion: number;
    }
  | { ok: false; errors: TCustomCssError[] };

export interface TCustomCssProcessOptions {
  /** Defaults to `BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES`. Only tests pass anything else. */
  blockExternalResources?: boolean;
}

const APPEARANCES: TCustomCssAppearance[] = ["light", "dark"];

/**
 * `<` inside strings, attribute values and identifiers is printed verbatim by lightningcss, so a value like
 * `content: "</style>"` would survive into the output. Before printing, every `<` in the AST's string
 * leaves becomes this noncharacter, and after printing it becomes the CSS escape `\3c `, which means `<`
 * in every context it can appear in. Source noncharacters become U+FFFD first so they cannot pose as one.
 */
const LESS_THAN_PLACEHOLDER = "\uFDD0";
const ESCAPED_LESS_THAN = String.raw`\3c `;

const LIMIT_REASONS = {
  nesting: `Rules are nested more than ${CUSTOM_CSS_MAX_NESTING_DEPTH} levels deep.`,
  function: `Functions, parentheses or brackets are nested more than ${CUSTOM_CSS_MAX_FUNCTION_DEPTH} levels deep.`,
  rules: `There are more than ${CUSTOM_CSS_MAX_RULES} rules.`,
  selectorList: `A selector list has more than ${CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH} selectors.`,
  selectorCompounds: `A selector has more than ${CUSTOM_CSS_MAX_SELECTOR_COMPOUNDS} parts once nesting is resolved.`,
  selectorUniversals: `A selector chains more than ${CUSTOM_CSS_MAX_UNIVERSAL_COMPOUNDS} universal (*) or pseudo-class-only parts.`,
} as const;

const PROCESSING_FAILED_REASON = "The CSS could not be processed. Nothing was saved.";
const IMPORT_REMOVED_REASON = "@import is not supported; imported stylesheets and fonts are not loaded.";
const UNCLOSED_BLOCK_REASON = "This block is never closed; a } is probably missing.";
const SUPPORTS_RESOURCE_REASON =
  "@supports conditions cannot name url(), image-set() or other resource functions; the rule was removed.";

const formatKilobytes = (bytes: number): string => `${(bytes / 1000).toFixed(1).replace(/\.0$/, "")} KB`;

interface TParentStyle {
  subject: TSubjectPosition;
  compounds: number;
  universals: number;
  /** Components the parent's flattened selector prints, a lower bound on its size in bytes. */
  printedSize: number;
}

interface TFieldContext {
  appearance: TCustomCssAppearance;
  dark: boolean;
  layer: string;
  policy: TDeclarationPolicy;
  sink: WarningSink;
  /** Keyframes this field defines, by original name → namespaced name. */
  keyframes: Map<string, string>;
  /** Dark CSS may use the keyframes its light CSS defines. */
  inheritedKeyframes: Map<string, string>;
  /** Lower bound on the printed selector size once nesting is flattened, checked against the budget. */
  printedSelectorSize: number;
  outputBudget: number;
}

const hasDeclarations = (block: DeclarationBlock | undefined): boolean =>
  (block?.declarations?.length ?? 0) + (block?.importantDeclarations?.length ?? 0) > 0;

const rejectLimit = (reason: string, ctx: TFieldContext, location: TIssueLocation): never => {
  throw new CustomCssRejection("limit_exceeded", reason, ctx.appearance, location);
};

/**
 * Applies the declaration policy to a block. Accepted declarations become `!important` (M2.03) — normal
 * ones first, so a declaration the creator already marked important still wins over a plain one for the
 * same property — except in keyframes, where browsers ignore `!important`.
 */
const processDeclarationBlock = (
  block: DeclarationBlock,
  ctx: TFieldContext,
  options: { important: boolean; location: TIssueLocation }
): void => {
  const kept: Declaration[] = [];
  for (const declaration of [...(block.declarations ?? []), ...(block.importantDeclarations ?? [])]) {
    const verdict = checkDeclaration(declaration, ctx.policy);
    if (!verdict.ok) {
      ctx.sink.add(verdict.code, ctx.appearance, verdict.reason, verdict.location ?? options.location);
      continue;
    }
    renameKeyframeReferences(
      declaration,
      (name) => ctx.keyframes.get(name) ?? ctx.inheritedKeyframes.get(name) ?? null
    );
    kept.push(declaration);
  }
  block.declarations = options.important ? [] : kept;
  block.importantDeclarations = options.important ? kept : [];
};

const addPrintedSelectorSize = (size: number, ctx: TFieldContext): void => {
  ctx.printedSelectorSize += size;
  // Flattening nested lists can grow exponentially (each `&` repeats the whole parent list), so this is
  // checked before lightningcss is asked to print anything.
  if (ctx.printedSelectorSize > ctx.outputBudget) {
    throw new CustomCssRejection(
      "output_too_large",
      `Once nesting is flattened the CSS would exceed the ${formatKilobytes(ctx.outputBudget)} limit.`,
      ctx.appearance
    );
  }
};

/**
 * Measures a scoped selector with its parent's parts counted in, and rejects the field when it is over a
 * selector limit.
 */
const measureScopedSelector = (
  selector: Selector,
  parent: TParentStyle | null,
  ctx: TFieldContext,
  location: TIssueLocation
): Omit<TParentStyle, "subject"> => {
  const metrics = measureSelector(selector);
  const compounds = metrics.compounds + (parent?.compounds ?? 0);
  const universals = metrics.universals + (parent?.universals ?? 0);
  if (metrics.longestArgumentList > CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH) {
    rejectLimit(LIMIT_REASONS.selectorList, ctx, location);
  }
  if (compounds > CUSTOM_CSS_MAX_SELECTOR_COMPOUNDS)
    rejectLimit(LIMIT_REASONS.selectorCompounds, ctx, location);
  if (universals > CUSTOM_CSS_MAX_UNIVERSAL_COMPOUNDS) {
    rejectLimit(LIMIT_REASONS.selectorUniversals, ctx, location);
  }
  const printedSize = metrics.components + metrics.nestingSelectors * (parent?.printedSize ?? 0);
  return { compounds, universals, printedSize };
};

const processStyleRule = (
  rule: Extract<Rule, { type: "style" }>["value"],
  parent: TParentStyle | null,
  ctx: TFieldContext
): boolean => {
  const location = fromRuleLocation(rule.loc);
  if (rule.selectors.length > CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH) {
    rejectLimit(LIMIT_REASONS.selectorList, ctx, location);
  }

  const kept: typeof rule.selectors = [];
  const next: TParentStyle = { subject: "inside", compounds: 0, universals: 0, printedSize: 0 };
  for (const selector of rule.selectors) {
    const outcome = parent
      ? scopeNestedSelector(selector, parent.subject)
      : scopeTopLevelSelector(selector, ctx.dark);
    if (!outcome.ok) {
      ctx.sink.add("unsafe_selector_removed", ctx.appearance, outcome.reason, location);
      continue;
    }

    const measured = measureScopedSelector(outcome.selector, parent, ctx, location);
    if (outcome.subject === "root") next.subject = "root";
    next.compounds = Math.max(next.compounds, measured.compounds);
    next.universals = Math.max(next.universals, measured.universals);
    next.printedSize += measured.printedSize;
    kept.push(outcome.selector);
  }

  // Nested rules are relative to the selectors that were removed, so they go with them.
  if (kept.length === 0) return false;
  rule.selectors = kept;

  if (rule.declarations) processDeclarationBlock(rule.declarations, ctx, { important: true, location });
  if (hasDeclarations(rule.declarations)) addPrintedSelectorSize(next.printedSize, ctx);
  rule.rules = processRules(rule.rules ?? [], next, ctx);
  return hasDeclarations(rule.declarations) || rule.rules.length > 0;
};

const processKeyframes = (rule: Extract<Rule, { type: "keyframes" }>["value"], ctx: TFieldContext): void => {
  const location = fromRuleLocation(rule.loc);
  const namespaced = ctx.keyframes.get(rule.name.value);
  if (namespaced) rule.name = { ...rule.name, value: namespaced };
  for (const keyframe of rule.keyframes) {
    processDeclarationBlock(keyframe.declarations, ctx, { important: false, location });
  }
};

/** Removes an at-rule whose condition names a resource or unsafe function. */
const isConditionUnsafe = (condition: unknown, ctx: TFieldContext, location: TIssueLocation): boolean => {
  const finding = scanValue(condition, ctx.policy);
  if (!finding) return false;
  ctx.sink.add(finding.code, ctx.appearance, finding.reason, finding.location ?? location);
  return true;
};

/**
 * One rule per selector when a list mixes in pseudo-elements. After a round trip through the visitor,
 * lightningcss 1.32 groups a list it considers partly unsupported by the targets into `:is(…)` — invalid
 * for pseudo-elements (`:is(a::selection, b::selection)`), so browsers would drop the rule. Separate rules
 * mean the same thing: a nested `&` over a list matches the union of its members.
 */
const splitPseudoElementLists = (rules: Rule[]): Rule[] =>
  rules.flatMap((rule) => {
    if (rule.type !== "style" || rule.value.selectors.length < 2) return [rule];
    const hasPseudoElement = rule.value.selectors.some((selector) =>
      selector.some((component) => component.type === "pseudo-element")
    );
    if (!hasPseudoElement || rule.value.selectors.length > CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH) return [rule];
    return rule.value.selectors.map(
      (selector): Rule => ({
        type: "style",
        value: { ...structuredClone(rule.value), selectors: [selector] },
      })
    );
  });

/** Declarations between or after nested rules, applying to the parent's selector. */
const processNestedDeclarations = (
  rule: Extract<Rule, { type: "nested-declarations" }>["value"],
  parent: TParentStyle | null,
  ctx: TFieldContext
): boolean => {
  if (!parent) return false;
  processDeclarationBlock(rule.declarations, ctx, { important: true, location: fromRuleLocation(rule.loc) });
  if (!hasDeclarations(rule.declarations)) return false;
  addPrintedSelectorSize(parent.printedSize, ctx);
  return true;
};

/** `@media`, `@supports` and `@container`: kept while the condition is safe and a nested rule is left. */
const processConditionalRule = (
  rule: Extract<Rule, { type: "media" | "supports" | "container" }>,
  parent: TParentStyle | null,
  ctx: TFieldContext
): boolean => {
  const location = fromRuleLocation(rule.value.loc);
  const condition = rule.type === "media" ? rule.value.query : rule.value.condition;
  if (isConditionUnsafe(condition, ctx, location)) return false;
  if (rule.type === "supports" && hasResourceInSupportsCondition(condition)) {
    ctx.sink.add("unsupported_at_rule_removed", ctx.appearance, SUPPORTS_RESOURCE_REASON, location);
    return false;
  }
  rule.value.rules = processRules(rule.value.rules, parent, ctx);
  return rule.value.rules.length > 0;
};

const reportUnsupportedAtRule = (rule: Rule, ctx: TFieldContext): void => {
  const name = REMOVED_AT_RULE_NAMES[rule.type];
  const value = (rule as { value?: { loc?: { line: number; column: number } } }).value;
  ctx.sink.add(
    "unsupported_at_rule_removed",
    ctx.appearance,
    name
      ? `${name} is not supported: custom CSS cannot define layers, scopes or page-wide registrations.`
      : "This at-rule is not supported.",
    fromRuleLocation(value?.loc)
  );
};

/** Applies the policy to one rule, in place. Returns whether the rule stays. */
const processRule = (rule: Rule, parent: TParentStyle | null, ctx: TFieldContext): boolean => {
  switch (rule.type) {
    case "style":
      return processStyleRule(rule.value, parent, ctx);
    case "nested-declarations":
      return processNestedDeclarations(rule.value, parent, ctx);
    case "media":
    case "supports":
    case "container":
      return processConditionalRule(rule, parent, ctx);
    case "keyframes":
      processKeyframes(rule.value, ctx);
      return true;
    case "import":
      // The pre-scan already removed every top-level @import; this keeps any it could not recognize out.
      ctx.sink.add("import_removed", ctx.appearance, IMPORT_REMOVED_REASON, fromRuleLocation(rule.value.loc));
      return false;
    case "font-face":
      ctx.sink.add(
        "font_face_removed",
        ctx.appearance,
        "@font-face is not supported; use a font that is already available on the page.",
        fromRuleLocation(rule.value.loc)
      );
      return false;
    case "ignored":
      // `@charset` and the like: no effect in a stylesheet inserted as text.
      return false;
    default:
      reportUnsupportedAtRule(rule, ctx);
      return false;
  }
};

const processRules = (rules: Rule[], parent: TParentStyle | null, ctx: TFieldContext): Rule[] => {
  const kept: Rule[] = [];
  for (const rule of splitPseudoElementLists(rules)) {
    if (processRule(rule, parent, ctx)) kept.push(rule);
  }
  return kept;
};

/** Every keyframes name a field defines, wherever the rule sits. */
const collectKeyframeNames = (rules: Rule[] | undefined, into: Set<string>): void => {
  for (const rule of rules ?? []) {
    if (rule.type === "keyframes") into.add(rule.value.name.value);
    else if (rule.type === "style") collectKeyframeNames(rule.value.rules, into);
    else if (rule.type === "media" || rule.type === "supports" || rule.type === "container") {
      collectKeyframeNames(rule.value.rules, into);
    }
  }
};

/**
 * Prepares the AST for the trip back into lightningcss: replaces `<` in every string leaf (see
 * `LESS_THAN_PLACEHOLDER`), and drops null-valued keys: lightningcss 1.32 serializes absent optional
 * fields as `null` (e.g. on `var(--x)`) but cannot always deserialize them again, while a missing optional
 * field always reads back as absent.
 */
const prepareForPrinting = (node: unknown): unknown => {
  if (typeof node === "string") {
    return node.replaceAll(LESS_THAN_PLACEHOLDER, "\uFFFD").replaceAll("<", LESS_THAN_PLACEHOLDER);
  }
  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index++) node[index] = prepareForPrinting(node[index]);
  } else if (typeof node === "object" && node !== null) {
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (record[key] === null) delete record[key];
      else record[key] = prepareForPrinting(record[key]);
    }
  }
  return node;
};

/**
 * Pass 1: parse (rejecting any syntax error), apply the policy to the AST, then let lightningcss flatten
 * nesting for the M2.01 targets and print minified CSS.
 */
const compileField = (source: string, ctx: TFieldContext): string => {
  let visited = false;
  let failure: unknown = null;
  let code: Uint8Array;
  try {
    ({ code } = transform({
      filename: `${ctx.appearance}.css`,
      code: Buffer.from(source),
      minify: true,
      targets: CUSTOM_CSS_TARGETS,
      include: CUSTOM_CSS_INCLUDE_FEATURES,
      exclude: CUSTOM_CSS_EXCLUDE_FEATURES,
      errorRecovery: false,
      visitor: {
        StyleSheet(sheet: StyleSheet): StyleSheet {
          visited = true;
          try {
            const names = new Set<string>();
            collectKeyframeNames(sheet.rules, names);
            for (const name of names) ctx.keyframes.set(name, `${ctx.layer}--${name}`);
            sheet.rules = processRules(sheet.rules, null, ctx);
            sheet.licenseComments = [];
            prepareForPrinting(sheet);
            return sheet;
          } catch (error) {
            failure = error;
            return { ...sheet, rules: [], licenseComments: [] };
          }
        },
      },
    }));
  } catch (error) {
    // Before the visitor runs, a throw is the parser rejecting the source.
    if (!visited) throw toSyntaxRejection(error, ctx.appearance);
    throw error;
  }
  if (failure) throw failure;
  return Buffer.from(code).toString("utf8").replaceAll(LESS_THAN_PLACEHOLDER, ESCAPED_LESS_THAN);
};

/**
 * Pass 2, fail-closed: parse the final wrapped stylesheet again and check that it is exactly what the
 * policy allows — one layer block of the right name holding only scoped style rules (all `!important`),
 * the allowed at-rules and keyframes, with no declaration the policy would remove. Anything else is a
 * processor bug and fails the operation instead of shipping. The rule count is checked here, after
 * flattening has expanded nested rules.
 */
const verifyCompiledField = (wrapped: string, ctx: TFieldContext): void => {
  const problems: string[] = [];
  let ruleCount = 0;

  const verifyDeclarations = (block: DeclarationBlock | undefined, important: boolean): void => {
    if (!block) return;
    if (important ? (block.declarations?.length ?? 0) > 0 : (block.importantDeclarations?.length ?? 0) > 0) {
      problems.push("importance");
    }
    for (const declaration of [...(block.declarations ?? []), ...(block.importantDeclarations ?? [])]) {
      if (!checkDeclaration(declaration, ctx.policy).ok) problems.push("declaration");
    }
  };

  const verifyStyleRule = (rule: Extract<Rule, { type: "style" }>["value"]): void => {
    if ((rule.rules?.length ?? 0) > 0) problems.push("nesting");
    if (rule.selectors.some((selector) => verifyCompiledSelector(selector, ctx.dark) === null)) {
      problems.push("selector");
    }
    verifyDeclarations(rule.declarations, true);
  };

  const verifyConditionalRule = (rule: Extract<Rule, { type: "media" | "supports" | "container" }>): void => {
    if (scanValue(rule.type === "media" ? rule.value.query : rule.value.condition, ctx.policy)) {
      problems.push("condition");
    }
    if (rule.type === "supports" && hasResourceInSupportsCondition(rule.value.condition)) {
      problems.push("condition");
    }
    verifyRules(rule.value.rules);
  };

  const verifyRules = (rules: Rule[]): void => {
    for (const rule of rules) {
      ruleCount++;
      switch (rule.type) {
        case "style":
          verifyStyleRule(rule.value);
          break;
        case "media":
        case "supports":
        case "container":
          verifyConditionalRule(rule);
          break;
        case "keyframes":
          ruleCount += rule.value.keyframes.length;
          for (const keyframe of rule.value.keyframes) verifyDeclarations(keyframe.declarations, false);
          break;
        default:
          problems.push(`rule:${rule.type}`);
      }
    }
  };

  try {
    transform({
      filename: `${ctx.appearance}.compiled.css`,
      code: Buffer.from(wrapped),
      errorRecovery: false,
      visitor: {
        StyleSheet(sheet: StyleSheet): void {
          const [layer, ...others] = sheet.rules;
          if (
            others.length > 0 ||
            layer?.type !== "layer-block" ||
            layer.value.name?.length !== 1 ||
            layer.value.name[0] !== ctx.layer ||
            (sheet.licenseComments?.length ?? 0) > 0
          ) {
            problems.push("layer");
            return;
          }
          verifyRules(layer.value.rules);
        },
      },
    });
  } catch {
    problems.push("parse");
  }

  if (ruleCount > CUSTOM_CSS_MAX_RULES) rejectLimit(LIMIT_REASONS.rules, ctx, NO_LOCATION);
  // A raw `</` could close an HTML <style> element; nothing legitimate in the output contains one.
  if (/<\/|<!--/.test(wrapped)) problems.push("html");
  if (problems.length > 0) {
    // Tags only: never the CSS, which is customer content.
    logger.error(
      { problems: [...new Set(problems)], appearance: ctx.appearance, layer: ctx.layer },
      "Custom CSS output failed verification"
    );
    throw new CustomCssRejection("processing_failed", PROCESSING_FAILED_REASON, ctx.appearance);
  }
};

const isValidInput = (input: unknown): input is TCustomCssInput => {
  if (typeof input !== "object" || input === null) return false;
  const { light, dark } = input as Record<string, unknown>;
  return (light === null || typeof light === "string") && (dark === null || typeof dark === "string");
};

const toFailure = (scope: TCustomCssScope, rejections: CustomCssRejection[]): TCustomCssProcessResult => ({
  ok: false,
  errors: rejections.map((rejection) => rejection.toError(scope)),
});

interface TField {
  appearance: TCustomCssAppearance;
  /** `null` when the field is empty or whitespace only. */
  source: string | null;
}

/**
 * The pre-scan, which bounds depth and rule count (across both fields) before the native parser sees the
 * source, and takes out every top-level `@import` with a warning: lightningcss would reject one that
 * follows another rule as a syntax error, which browsers simply ignore.
 */
const prescanFields = (
  fields: TField[],
  sink: WarningSink
): { fields: TField[]; rejections: CustomCssRejection[] } => {
  const rejections: CustomCssRejection[] = [];
  let blocks = 0;
  const scanned = fields.map((field): TField => {
    if (!field.source) return field;
    const scan = prescanCustomCss(field.source, {
      maxNestingDepth: CUSTOM_CSS_MAX_NESTING_DEPTH,
      maxFunctionDepth: CUSTOM_CSS_MAX_FUNCTION_DEPTH,
      maxBlocks: CUSTOM_CSS_MAX_RULES - blocks,
    });
    if (!scan.ok) {
      const location = { line: scan.line, column: scan.column };
      rejections.push(
        scan.kind === "unclosed-block"
          ? new CustomCssRejection("syntax_error", UNCLOSED_BLOCK_REASON, field.appearance, location)
          : new CustomCssRejection("limit_exceeded", LIMIT_REASONS[scan.kind], field.appearance, location)
      );
      return field;
    }
    blocks += scan.blocks;
    for (const { line, column } of scan.imports) {
      sink.add("import_removed", field.appearance, IMPORT_REMOVED_REASON, { line, column });
    }
    return { ...field, source: removePrescanImports(field.source, scan.imports) };
  });
  return { fields: scanned, rejections };
};

/** Wraps a compiled field in its layer, then checks it against the budget and verifies it (pass 2). */
const wrapAndVerifyField = (css: string, ctx: TFieldContext): string => {
  const wrapped = `@layer ${ctx.layer}{${css}}`;
  if (Buffer.byteLength(wrapped, "utf8") > ctx.outputBudget) {
    throw new CustomCssRejection(
      "output_too_large",
      `The processed CSS would exceed the ${formatKilobytes(ctx.outputBudget)} limit.`,
      ctx.appearance
    );
  }
  verifyCompiledField(wrapped, ctx);
  return wrapped;
};

/** Compiles and verifies each field; dark CSS may use the keyframes its light CSS defines. */
const compileFields = (
  fields: TField[],
  options: { scope: TCustomCssScope; budget: number; blockExternalResources: boolean; sink: WarningSink }
): { compiled: Record<TCustomCssAppearance, string | null>; rejections: CustomCssRejection[] } => {
  const compiled: Record<TCustomCssAppearance, string | null> = { light: null, dark: null };
  const rejections: CustomCssRejection[] = [];
  let lightKeyframes = new Map<string, string>();
  for (const field of fields) {
    if (!field.source) continue;
    const ctx: TFieldContext = {
      appearance: field.appearance,
      dark: field.appearance === "dark",
      layer: getCustomCssLayerName(options.scope, field.appearance),
      policy: { blockExternalResources: options.blockExternalResources },
      sink: options.sink,
      keyframes: new Map(),
      inheritedKeyframes: field.appearance === "dark" ? lightKeyframes : new Map(),
      printedSelectorSize: 0,
      outputBudget: options.budget,
    };
    try {
      const css = compileField(field.source, ctx);
      if (field.appearance === "light") lightKeyframes = ctx.keyframes;
      compiled[field.appearance] = wrapAndVerifyField(css, ctx);
    } catch (error) {
      if (!(error instanceof CustomCssRejection)) throw error;
      rejections.push(error);
    }
  }
  return { compiled, rejections };
};

/**
 * The one custom CSS processor (ENG-2950), shared by preview, validation and every save path, and by
 * delivery when stored output predates the current processor version.
 *
 * Synchronous: lightningcss works synchronously, and a 100 KB stylesheet takes milliseconds. Never
 * throws; any internal failure comes back as `processing_failed`, and a failed result never carries
 * compiled output.
 */
const BYTE_ORDER_MARK = "\uFEFF";

export const processCustomCss = (
  args: { scope: TCustomCssScope; input: TCustomCssInput },
  options: TCustomCssProcessOptions = {}
): TCustomCssProcessResult => {
  const blockExternalResources = options.blockExternalResources ?? BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES;
  const processorVersion = getCustomCssProcessorVersion(blockExternalResources);
  const parsedScope = ZCustomCssScope.safeParse(args?.scope);
  const scope: TCustomCssScope = parsedScope.success ? parsedScope.data : "survey";

  try {
    if (!parsedScope.success || !isValidInput(args?.input)) {
      return toFailure(scope, [new CustomCssRejection("processing_failed", PROCESSING_FAILED_REASON, null)]);
    }

    const budget = CUSTOM_CSS_MAX_SOURCE_BYTES[scope];
    const fields: TField[] = APPEARANCES.map((appearance) => {
      const value = args.input[appearance];
      if (typeof value !== "string" || value.trim() === "") return { appearance, source: null };
      // A file saved with a byte order mark would otherwise carry it into the first selector. A space
      // keeps every line and column where the editor shows it.
      return { appearance, source: value.startsWith(BYTE_ORDER_MARK) ? ` ${value.slice(1)}` : value };
    });

    // The size budget comes first, before anything reads the source.
    const sourceBytes = fields.reduce(
      (total, field) => total + (field.source ? Buffer.byteLength(field.source, "utf8") : 0),
      0
    );
    if (sourceBytes > budget) {
      return toFailure(scope, [
        new CustomCssRejection(
          "source_too_large",
          `The CSS is ${formatKilobytes(sourceBytes)} (light and dark together); the limit is ${formatKilobytes(budget)}.`,
          null
        ),
      ]);
    }

    // Then the pre-scan, before the native parser sees the source.
    const sink = new WarningSink(scope);
    const prescan = prescanFields(fields, sink);
    if (prescan.rejections.length > 0) return toFailure(scope, prescan.rejections);

    const { compiled, rejections } = compileFields(prescan.fields, {
      scope,
      budget,
      blockExternalResources,
      sink,
    });
    if (rejections.length > 0) return toFailure(scope, rejections);

    const outputBytes = APPEARANCES.reduce(
      (total, appearance) => total + Buffer.byteLength(compiled[appearance] ?? "", "utf8"),
      0
    );
    if (outputBytes > budget) {
      return toFailure(scope, [
        new CustomCssRejection(
          "output_too_large",
          `The processed CSS is ${formatKilobytes(outputBytes)} (light and dark together); the limit is ${formatKilobytes(budget)}.`,
          null
        ),
      ]);
    }

    return { ok: true, compiled, warnings: sink.warnings, processorVersion };
  } catch (error) {
    // The error's type only: lightningcss messages can quote the CSS.
    logger.error(
      { errorName: error instanceof Error ? error.name : typeof error, scope },
      "Custom CSS processor failed"
    );
    return toFailure(scope, [new CustomCssRejection("processing_failed", PROCESSING_FAILED_REASON, null)]);
  }
};
