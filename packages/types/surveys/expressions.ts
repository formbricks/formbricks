import { z } from "zod";
import { ZDynamicLogicFieldValue } from "./logic";

/**
 * Set value expressions (ENG-6935, ADR 0025): a formula such as `round(q1 + q2 * 2)` stored as a tree,
 * never as text, so the survey bundle only walks nodes and needs no parser (CSP: no `eval`).
 *
 * Every operation is one node kind, `{ type: "call", fn, args }`. Leaves reuse the condition operands
 * (`element`, `variable`, `hiddenField`, `reserved`) plus a fixed `static` number or text. Nodes carry
 * no ids; the editor renders and parses the text form.
 *
 * This module holds the shape only: the function catalogue, the argument counts and the tree limits,
 * which hold whatever survey the tree sits in. Whether a leaf exists and whether the types fit is
 * survey-dependent and lives in `expression-types.ts`; evaluation lives in `expression-evaluation.ts`.
 */

export const EXPRESSION_FUNCTIONS = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "round",
  "min",
  "max",
  "abs",
  "ifEmpty",
  "concat",
  "now",
  "daysBetween",
] as const;

export const ZExpressionFunction = z.enum(EXPRESSION_FUNCTIONS, {
  error: "Expression: unknown function",
});
export type TExpressionFunction = z.infer<typeof ZExpressionFunction>;

/** Input limits (CODING_STANDARDS "Input Limits", grill D6). */
export const EXPRESSION_MAX_DEPTH = 12;
const DEPTH_MESSAGE_TEXT = `Expression: nested deeper than ${String(EXPRESSION_MAX_DEPTH)} levels`;
export const EXPRESSION_MAX_NODES = 200;
const NODES_MESSAGE_TEXT = `Expression: more than ${String(EXPRESSION_MAX_NODES)} nodes`;
/** The most arguments a variadic function (`add`, `multiply`, `min`, `max`, `concat`) takes. */
export const EXPRESSION_MAX_ARGS = 50;
export const EXPRESSION_MAX_STATIC_TEXT_LENGTH = 5000;
/** `round`'s optional second argument: how many decimals, as a fixed whole number. */
export const EXPRESSION_MAX_ROUND_DECIMALS = 10;

/** How many arguments each function takes. */
export const EXPRESSION_FUNCTION_ARITY: Record<TExpressionFunction, { min: number; max: number }> = {
  add: { min: 2, max: EXPRESSION_MAX_ARGS },
  subtract: { min: 2, max: 2 },
  multiply: { min: 2, max: EXPRESSION_MAX_ARGS },
  divide: { min: 2, max: 2 },
  round: { min: 1, max: 2 },
  min: { min: 2, max: EXPRESSION_MAX_ARGS },
  max: { min: 2, max: EXPRESSION_MAX_ARGS },
  abs: { min: 1, max: 1 },
  ifEmpty: { min: 2, max: 2 },
  concat: { min: 2, max: EXPRESSION_MAX_ARGS },
  now: { min: 0, max: 0 },
  daysBetween: { min: 2, max: 2 },
};

export type TExpressionStatic = { type: "static"; value: number | string };
export type TExpressionLeaf = TExpressionStatic | z.infer<typeof ZDynamicLogicFieldValue>;
export type TExpressionCall = { type: "call"; fn: TExpressionFunction; args: TExpression[] };
export type TExpression = TExpressionLeaf | TExpressionCall;

const ZExpressionStatic = z.object({
  type: z.literal("static"),
  value: z.union([z.number(), z.string().max(EXPRESSION_MAX_STATIC_TEXT_LENGTH)]),
});

const describeArity = ({ min, max }: { min: number; max: number }): string => {
  if (min === max) return `exactly ${String(min)}`;
  if (max === EXPRESSION_MAX_ARGS) return `${String(min)} to ${String(max)}`;
  return `${String(min)} or ${String(max)}`;
};

const isExpressionFunction = (fn: string): fn is TExpressionFunction =>
  (EXPRESSION_FUNCTIONS as readonly string[]).includes(fn);

// `fn` is checked in the refinement rather than as an enum: an enum miss fails the node's shape, and a
// union of shapes then reports "Invalid input" on the whole action instead of the path to the name.
const ZExpressionCall = z
  .object({
    type: z.literal("call"),
    fn: z.string(),
    args: z.array(z.lazy(() => ZExpression)).max(EXPRESSION_MAX_ARGS),
  })
  .superRefine((node, ctx) => {
    if (!isExpressionFunction(node.fn)) {
      ctx.addIssue({
        code: "custom",
        message: `Expression: unknown function ${node.fn}()`,
        path: ["fn"],
      });
      return;
    }
    const arity = EXPRESSION_FUNCTION_ARITY[node.fn];
    if (node.args.length < arity.min || node.args.length > arity.max) {
      ctx.addIssue({
        code: "custom",
        message: `Expression: ${node.fn}() takes ${describeArity(arity)} arguments, got ${String(node.args.length)}`,
        path: ["args"],
      });
      return;
    }

    if (node.fn === "round" && node.args.length === 2) {
      const decimals = node.args[1];
      const isWholeNumber =
        decimals.type === "static" &&
        typeof decimals.value === "number" &&
        Number.isInteger(decimals.value) &&
        decimals.value >= 0 &&
        decimals.value <= EXPRESSION_MAX_ROUND_DECIMALS;
      if (!isWholeNumber) {
        ctx.addIssue({
          code: "custom",
          message: `Expression: round()'s decimals must be a fixed whole number from 0 to ${String(EXPRESSION_MAX_ROUND_DECIMALS)}`,
          path: ["args", 1],
        });
      }
    }
  });

export const ZExpression = z.union([ZExpressionStatic, ZDynamicLogicFieldValue, ZExpressionCall], {
  error: "Expression: invalid node",
}) as unknown as z.ZodType<TExpression>;

type TPath = (string | number)[];

/**
 * Whether an expression reads a reference anywhere in its tree, e.g. `{ type: "element", value: id }`.
 * What "is this question or field used in logic" asks before it lets someone delete it.
 */
export const expressionReferences = (
  expression: TExpression,
  type: "element" | "variable" | "hiddenField" | "reserved",
  value: string
): boolean =>
  expression.type === "call"
    ? expression.args.some((arg) => expressionReferences(arg, type, value))
    : expression.type === type && expression.value === value;

/**
 * The tree limits, checked once over the whole tree. Depth is reported on the first node past it and
 * the node count on the root, each with its path, so a caller sees exactly where the tree goes too far.
 */
export const getExpressionLimitIssues = (expression: TExpression): { path: TPath; message: string }[] => {
  const issues: { path: TPath; message: string }[] = [];
  let nodes = 0;
  let depthReported = false;

  const walk = (node: TExpression, depth: number, path: TPath): void => {
    nodes += 1;
    if (depth > EXPRESSION_MAX_DEPTH) {
      if (!depthReported) {
        issues.push({
          path,
          message: DEPTH_MESSAGE_TEXT,
        });
        depthReported = true;
      }
      return;
    }
    if (node.type === "call") {
      node.args.forEach((arg, idx) => walk(arg, depth + 1, [...path, "args", idx]));
    }
  };

  walk(expression, 1, []);

  if (nodes > EXPRESSION_MAX_NODES) {
    issues.push({ path: [], message: NODES_MESSAGE_TEXT });
  }
  return issues;
};

/** Why a raw tree is refused before it is parsed, with the path the issue is reported at. */
type TUnparsedLimitViolation = { path: TPath; message: string };

/**
 * The first limit a raw (unparsed) tree breaks, or `undefined`: the first node past the depth limit, at
 * its path, else the node count, at the root, once the walk runs out of its node budget. Walks no
 * deeper than the depth limit and no more nodes than the node limit, so a hostile tree (thousands of
 * levels, or a wide prefix hiding a deep tail) is refused before the recursive schema descends into
 * it: a 400 at its path, never a stack overflow.
 */
const findUnparsedLimitViolation = (root: unknown): TUnparsedLimitViolation | undefined => {
  let visited = 0;
  const walk = (value: unknown, depth: number, path: TPath): TPath | undefined => {
    visited += 1;
    if (depth > EXPRESSION_MAX_DEPTH) return path;
    if (visited > EXPRESSION_MAX_NODES) return undefined;
    if (typeof value !== "object" || value === null) return undefined;
    const node = value as { type?: unknown; args?: unknown };
    if (node.type !== "call" || !Array.isArray(node.args)) return undefined;
    for (const [idx, arg] of node.args.entries()) {
      const found = walk(arg, depth + 1, [...path, "args", idx]);
      if (found) return found;
      if (visited > EXPRESSION_MAX_NODES) return undefined;
    }
    return undefined;
  };
  const tooDeepPath = walk(root, 1, []);
  if (tooDeepPath) return { path: tooDeepPath, message: DEPTH_MESSAGE_TEXT };
  // The budget ran out before the walk was done: what it didn't see may be thousands of levels deep.
  if (visited > EXPRESSION_MAX_NODES) return { path: [], message: NODES_MESSAGE_TEXT };
  return undefined;
};

/**
 * Whether a raw tree goes past the depth or the node limit. The survey refinements still see a tree
 * the schema refused (the issue is already reported); their recursive checks skip it rather than
 * descend into it.
 */
export const isExpressionOverLimits = (expression: unknown): boolean =>
  findUnparsedLimitViolation(expression) !== undefined;

/** A tree, refused on depth or node count before it is parsed (see {@link findUnparsedLimitViolation}). */
const ZDepthBoundedExpression = z
  .unknown()
  .superRefine((value, ctx) => {
    const violation = findUnparsedLimitViolation(value);
    if (violation) ctx.addIssue({ code: "custom", message: violation.message, path: violation.path });
  })
  .pipe(ZExpression);

/** The `value` of a Set value step: `{ type: "expression", value: <tree> }`. */
export const ZExpressionValue = z
  .object({
    type: z.literal("expression"),
    value: ZDepthBoundedExpression,
  })
  .superRefine((value, ctx) => {
    // Depth and node count are refused (once, at their path) before the tree is parsed.
    if (isExpressionOverLimits(value.value)) return;
    for (const issue of getExpressionLimitIssues(value.value)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: ["value", ...issue.path] });
    }
  });

export type TExpressionValue = z.infer<typeof ZExpressionValue>;
