import {
  RESERVED_FIELD_CATALOG,
  getSurveyEmbeddedFields,
  listMidSurveyReservedEntries,
  listShadowingNames,
} from "@formbricks/types/embedded-data-resolver";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import {
  type TExpressionTypeIssue,
  getElementExpressionType,
  getSetValueExpressionIssues,
} from "@formbricks/types/surveys/expression-types";
import {
  EXPRESSION_FUNCTIONS,
  EXPRESSION_MAX_STATIC_TEXT_LENGTH,
  type TExpression,
  type TExpressionCall,
  type TExpressionFunction,
  type TExpressionLeaf,
} from "@formbricks/types/surveys/expressions";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * The formula box's text form of a Set value expression (ENG-6935, ADR 0024): parses what people type
 * into the same tree AI writes through v3 and MCP, and renders a stored tree back as text.
 *
 * This parser lives in the web app only, never in the survey bundle, which just walks the tree.
 *
 * The text form:
 * - numbers (`2`, `1.5`), text in quotes (`"gold"`), and references with `@`: a question by its code
 *   (or id when it has none), an Embedded Data field by name, a reserved field by name. A name that
 *   isn't a plain identifier is braced: `@{Plan tier}`.
 * - `+ - * /` (also `× ÷ −`) with the usual precedence and brackets; `a + b + c` is one `add`, and a
 *   leading minus on a number is a negative number.
 * - functions by name: `round(x, 1)`, `min(a, b)`, `ifEmpty(@q1, 0)`, `now()`, … (any case).
 */

/** The most characters the formula box takes. Generous; it also bounds the parser's recursion. */
export const FORMULA_MAX_LENGTH = 5000;

export type TFormulaReferenceGroup = "question" | "field" | "reserved";

export interface TFormulaReference {
  /** What follows `@` in the text. */
  token: string;
  leaf: Exclude<TExpressionLeaf, { type: "static" }>;
  group: TFormulaReferenceGroup;
  /** For a question: whether a formula can use its answer. */
  usable: boolean;
  /** For a question: the block it is on, to offer only answers given by the time the step runs. */
  blockIdx?: number;
}

const PLAIN_TOKEN = /^[A-Za-z0-9_]+$/;

/** How a token reads after `@`: bare when it is a plain identifier, braced otherwise. */
export const formatReferenceToken = (token: string): string =>
  PLAIN_TOKEN.test(token) ? `@${token}` : `@{${token}}`;

const leafKey = (leaf: { type: string; value: string }) => `${leaf.type}:${leaf.value}`;

/**
 * Everything a formula can name in this survey: its questions (by code), its Embedded Data fields and
 * the reserved fields a running survey can read. Earlier entries win a token, in that order; question
 * codes are unique across Embedded Data names already (codes.ts), so a clash needs a stale survey.
 */
export const getFormulaReferences = (survey: TSurvey): TFormulaReference[] => {
  const references: TFormulaReference[] = [];
  const taken = new Set<string>();
  const add = (reference: TFormulaReference) => {
    if (taken.has(reference.token)) return;
    taken.add(reference.token);
    references.push(reference);
  };

  survey.blocks.forEach((block, blockIdx) => {
    block.elements.forEach((element: TSurveyElement) => {
      add({
        token: ("code" in element && element.code) || element.id,
        leaf: { type: "element", value: element.id },
        group: "question",
        usable: getElementExpressionType(element) !== undefined,
        blockIdx,
      });
    });
  });

  const fields = getSurveyEmbeddedFields(survey);
  for (const { field, link } of fields) {
    add({
      token: field.name.trim() === "" ? link.storageKey : field.name,
      leaf: { type: field.source === "computed" ? "variable" : "hiddenField", value: link.storageKey },
      group: "field",
      usable: field.dataType !== "boolean" || field.source === "ingested",
    });
  }

  const declared = listShadowingNames(
    fields,
    getElementsFromBlocks(survey.blocks).map((element) => element.id)
  );
  for (const entry of listMidSurveyReservedEntries(RESERVED_FIELD_CATALOG, declared)) {
    add({
      token: entry.name,
      leaf: { type: "reserved", value: entry.name },
      group: "reserved",
      usable: true,
    });
  }

  return references;
};

/**
 * The shared save-time check (`getSetValueExpressionIssues`, the one `surveyRefinement` and v3 run),
 * against the editor's working copy, so the formula box says what a save would refuse while typing.
 */
export const getFormulaIssues = (
  expression: TExpression,
  variableId: string,
  survey: TSurvey
): TExpressionTypeIssue[] => {
  const fields = getSurveyEmbeddedFields(survey);
  const target = fields.find(
    ({ field, link }) => field.source === "computed" && link.storageKey === variableId
  )?.field;
  if (!target) return [];

  const elements = new Map(getElementsFromBlocks(survey.blocks).map((element) => [element.id, element]));
  const fieldType = (storageKey: string, source: "computed" | "ingested") =>
    fields.find(({ field, link }) => field.source === source && link.storageKey === storageKey)?.field
      .dataType;

  return getSetValueExpressionIssues(expression, target.dataType, {
    getElement: (elementId) => {
      const element = elements.get(elementId);
      if (!element) return undefined;
      return { type: element.type, inputType: "inputType" in element ? element.inputType : undefined };
    },
    getComputedFieldType: (storageKey) => fieldType(storageKey, "computed"),
    getIngestedFieldType: (storageKey) => fieldType(storageKey, "ingested"),
    getReservedFieldType: (name) => RESERVED_FIELD_CATALOG.find((entry) => entry.name === name)?.dataType,
  });
};

// ---- One-step calculations ----------------------------------------------------------------------

/**
 * A one-step calculation as the formula that computes the same thing, for "Use a formula" in its
 * operator list: `score + 1` becomes `ifEmpty(@score, 0) + 1`, keeping the field's "empty counts as
 * 0". An empty operand now gives an empty result instead of leaving the field alone (grill P3).
 */
export const oneStepToFormula = (action: {
  variableId: string;
  operator: string;
  value: { type: string; value: unknown };
}): TExpression => {
  const operand: TExpression =
    action.value.type === "static"
      ? {
          type: "static",
          value:
            typeof action.value.value === "number" ? action.value.value : String(action.value.value ?? ""),
        }
      : ({ type: action.value.type, value: String(action.value.value) } as TExpression);

  const current = (fallback: number | string): TExpression => ({
    type: "call",
    fn: "ifEmpty",
    args: [
      { type: "variable", value: action.variableId },
      { type: "static", value: fallback },
    ],
  });

  switch (action.operator) {
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
      return { type: "call", fn: action.operator, args: [current(0), operand] };
    case "concat":
      return { type: "call", fn: "concat", args: [current(""), operand] };
    default:
      return operand;
  }
};

// ---- Insertion ----------------------------------------------------------------------------------

/** What a function chip inserts, and where the cursor goes: inside the brackets, or after `now()`. */
export const getFunctionSnippet = (fn: TExpressionFunction): { text: string; cursorOffset: number } =>
  fn === "now" ? { text: "now()", cursorOffset: 5 } : { text: `${fn}()`, cursorOffset: fn.length + 1 };

/**
 * Inserts `insert` over the selection, returning the new text and where the cursor goes. A reference
 * picked right after typing `@` replaces that `@`, so `@` then a pick gives `@score`, not `@@score`.
 */
export const insertIntoFormula = (
  text: string,
  selection: { start: number; end: number },
  insert: string,
  options: { cursorOffset?: number; replaceTypedAt?: boolean } = {}
): { text: string; cursor: number } => {
  let start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  if (options.replaceTypedAt && start > 0 && text[start - 1] === "@") start -= 1;
  return {
    text: `${text.slice(0, start)}${insert}${text.slice(end)}`,
    cursor: start + (options.cursorOffset ?? insert.length),
  };
};

// ---- Formatting ---------------------------------------------------------------------------------

const INFIX: Partial<Record<TExpressionFunction, { symbol: string; precedence: number; flat: boolean }>> = {
  add: { symbol: "+", precedence: 1, flat: true },
  subtract: { symbol: "-", precedence: 1, flat: false },
  multiply: { symbol: "*", precedence: 2, flat: true },
  divide: { symbol: "/", precedence: 2, flat: false },
};

const ATOM_PRECEDENCE = 3;

/** Whether a call reads as an operator (`a + b`) rather than a function (`add(a)`, a malformed tree). */
const getInfix = (node: TExpressionCall) => {
  const infix = INFIX[node.fn];
  if (!infix) return undefined;
  return (infix.flat ? node.args.length >= 2 : node.args.length === 2) ? infix : undefined;
};

const precedenceOf = (node: TExpression): number =>
  node.type === "call" ? (getInfix(node)?.precedence ?? ATOM_PRECEDENCE) : ATOM_PRECEDENCE;

const quoteText = (text: string): string => `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/**
 * A tree as the text the formula box shows. Parsing the result gives the same tree back, brackets
 * included where the tree nests the same operation (`(a + b) + c` stays two `add`s).
 */
export const formatFormula = (expression: TExpression, references: TFormulaReference[]): string => {
  const tokens = new Map(references.map((reference) => [leafKey(reference.leaf), reference.token]));

  const format = (node: TExpression): string => {
    switch (node.type) {
      case "static":
        return typeof node.value === "number" ? String(node.value) : quoteText(node.value);
      case "call":
        return formatCall(node);
      default:
        return formatReferenceToken(tokens.get(leafKey(node)) ?? node.value);
    }
  };

  const wrap = (node: TExpression, needsBrackets: boolean) =>
    needsBrackets ? `(${format(node)})` : format(node);

  const formatCall = (node: TExpressionCall): string => {
    const infix = getInfix(node);
    if (infix) {
      const parts = node.args.map((arg, idx) => {
        const argPrecedence = precedenceOf(arg);
        if (infix.flat) {
          const sameOperation = arg.type === "call" && arg.fn === node.fn;
          return wrap(
            arg,
            argPrecedence < infix.precedence ||
              (argPrecedence === infix.precedence && (idx > 0 || sameOperation))
          );
        }
        return wrap(arg, idx === 0 ? argPrecedence < infix.precedence : argPrecedence <= infix.precedence);
      });
      return parts.join(` ${infix.symbol} `);
    }
    return `${node.fn}(${node.args.map((arg) => format(arg)).join(", ")})`;
  };

  return format(expression);
};

// ---- Parsing ------------------------------------------------------------------------------------

export type TFormulaErrorCode =
  | "empty"
  | "too_long"
  | "unexpected_character"
  | "unexpected_token"
  | "unexpected_end"
  | "unclosed_text"
  | "unknown_function"
  | "unknown_reference"
  | "incomplete_reference"
  | "text_too_long";

export interface TFormulaError {
  code: TFormulaErrorCode;
  /** Character offset the problem starts at. */
  position: number;
  /** The function name, reference or token the problem is about. */
  detail?: string;
}

export type TFormulaParseResult = { ok: true; expression: TExpression } | { ok: false; error: TFormulaError };

type TToken =
  | { kind: "number"; value: number; position: number }
  | { kind: "text"; value: string; position: number }
  | { kind: "reference"; value: string; position: number }
  | { kind: "name"; value: string; position: number }
  | { kind: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" | ","; position: number };

class FormulaError extends Error {
  constructor(readonly error: TFormulaError) {
    super(error.code);
  }
}

const OPERATOR_ALIASES: Record<string, "+" | "-" | "*" | "/" | "(" | ")" | ","> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  "/": "/",
  "÷": "/",
  "(": "(",
  ")": ")",
  ",": ",",
};

const QUOTES: Record<string, string> = { '"': '"', "'": "'", "“": "”" };

const tokenize = (text: string): TToken[] => {
  const tokens: TToken[] = [];
  let idx = 0;

  while (idx < text.length) {
    const char = text[idx];
    if (/\s/.test(char)) {
      idx += 1;
      continue;
    }

    const operator = OPERATOR_ALIASES[char];
    if (operator) {
      tokens.push({ kind: "operator", value: operator, position: idx });
      idx += 1;
      continue;
    }

    const number = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(idx));
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]), position: idx });
      idx += number[0].length;
      continue;
    }

    const closingQuote = QUOTES[char];
    if (closingQuote) {
      let value = "";
      let end = idx + 1;
      while (end < text.length && text[end] !== closingQuote) {
        if (text[end] === "\\" && end + 1 < text.length) end += 1;
        value += text[end];
        end += 1;
      }
      if (end >= text.length) throw new FormulaError({ code: "unclosed_text", position: idx });
      if (value.length > EXPRESSION_MAX_STATIC_TEXT_LENGTH) {
        throw new FormulaError({ code: "text_too_long", position: idx });
      }
      tokens.push({ kind: "text", value, position: idx });
      idx = end + 1;
      continue;
    }

    if (char === "@") {
      if (text[idx + 1] === "{") {
        const end = text.indexOf("}", idx + 2);
        if (end === -1) throw new FormulaError({ code: "unexpected_end", position: idx });
        tokens.push({ kind: "reference", value: text.slice(idx + 2, end).trim(), position: idx });
        idx = end + 1;
        continue;
      }
      const reference = /^[A-Za-z0-9_]+/.exec(text.slice(idx + 1));
      // An `@` with no name after it: one being picked from the menu, or left behind.
      if (!reference) throw new FormulaError({ code: "incomplete_reference", position: idx });
      tokens.push({ kind: "reference", value: reference[0], position: idx });
      idx += 1 + reference[0].length;
      continue;
    }

    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(idx));
    if (name) {
      tokens.push({ kind: "name", value: name[0], position: idx });
      idx += name[0].length;
      continue;
    }

    throw new FormulaError({ code: "unexpected_character", position: idx, detail: char });
  }

  return tokens;
};

const FUNCTION_BY_LOWERCASE = new Map(EXPRESSION_FUNCTIONS.map((fn) => [fn.toLowerCase(), fn]));

/**
 * Parses the formula box's text into an expression tree. Arity and types are not judged here: the
 * shared validator does that for the editor, v3 and MCP alike, with paths into the tree.
 */
export const parseFormula = (text: string, references: TFormulaReference[]): TFormulaParseResult => {
  if (text.trim() === "") return { ok: false, error: { code: "empty", position: 0 } };
  if (text.length > FORMULA_MAX_LENGTH) {
    return { ok: false, error: { code: "too_long", position: FORMULA_MAX_LENGTH } };
  }

  const leaves = new Map(references.map((reference) => [reference.token, reference.leaf]));

  try {
    const tokens = tokenize(text);
    let cursor = 0;
    const peek = (): TToken | undefined => tokens[cursor];
    const fail = (token: TToken | undefined): never => {
      throw new FormulaError(
        token
          ? { code: "unexpected_token", position: token.position, detail: String(token.value) }
          : { code: "unexpected_end", position: text.length }
      );
    };
    const isOperator = (token: TToken | undefined, value: string): boolean =>
      token?.kind === "operator" && token.value === value;
    const expectOperator = (value: string) => {
      const token = peek();
      if (!isOperator(token, value)) fail(token);
      cursor += 1;
    };

    // Nodes an operator chain built itself, so `a + b + c` grows one `add` while `(a + b) + c` nests.
    const chainNodes = new WeakSet<TExpressionCall>();
    const combine = (fn: TExpressionFunction, left: TExpression, right: TExpression): TExpression => {
      if (
        (fn === "add" || fn === "multiply") &&
        left.type === "call" &&
        left.fn === fn &&
        chainNodes.has(left)
      ) {
        left.args.push(right);
        return left;
      }
      const node: TExpressionCall = { type: "call", fn, args: [left, right] };
      chainNodes.add(node);
      return node;
    };

    const parseExpression = (): TExpression => {
      let left = parseTerm();
      while (isOperator(peek(), "+") || isOperator(peek(), "-")) {
        const fn = isOperator(peek(), "+") ? "add" : "subtract";
        cursor += 1;
        left = combine(fn, left, parseTerm());
      }
      return left;
    };

    const parseTerm = (): TExpression => {
      let left = parseUnary();
      while (isOperator(peek(), "*") || isOperator(peek(), "/")) {
        const fn = isOperator(peek(), "*") ? "multiply" : "divide";
        cursor += 1;
        left = combine(fn, left, parseUnary());
      }
      return left;
    };

    const parseUnary = (): TExpression => {
      if (!isOperator(peek(), "-")) return parsePrimary();
      cursor += 1;
      const operand = parseUnary();
      if (operand.type === "static" && typeof operand.value === "number") {
        return { type: "static", value: -operand.value };
      }
      return { type: "call", fn: "multiply", args: [{ type: "static", value: -1 }, operand] };
    };

    const parsePrimary = (): TExpression => {
      const token = peek();
      if (!token) return fail(token);
      cursor += 1;

      switch (token.kind) {
        case "number":
          return { type: "static", value: token.value };
        case "text":
          return { type: "static", value: token.value };
        case "reference": {
          const leaf = leaves.get(token.value);
          if (!leaf) {
            throw new FormulaError({
              code: "unknown_reference",
              position: token.position,
              detail: token.value,
            });
          }
          return { ...leaf };
        }
        case "name": {
          const fn = FUNCTION_BY_LOWERCASE.get(token.value.toLowerCase());
          if (!fn) {
            throw new FormulaError({
              code: "unknown_function",
              position: token.position,
              detail: token.value,
            });
          }
          expectOperator("(");
          const args: TExpression[] = [];
          if (!isOperator(peek(), ")")) {
            args.push(parseExpression());
            while (isOperator(peek(), ",")) {
              cursor += 1;
              args.push(parseExpression());
            }
          }
          expectOperator(")");
          return { type: "call", fn, args };
        }
        case "operator": {
          if (token.value !== "(") return fail(token);
          const inner = parseExpression();
          expectOperator(")");
          // Brackets close a chain: `(a + b) + c` keeps the inner `add` as its own node.
          if (inner.type === "call") chainNodes.delete(inner);
          return inner;
        }
      }
    };

    const expression = parseExpression();
    if (cursor < tokens.length) fail(peek());
    return { ok: true, expression };
  } catch (error) {
    if (error instanceof FormulaError) return { ok: false, error: error.error };
    throw error;
  }
};

/**
 * The parse error the formula box shows while it is typed in, or none. Nothing is shown while the
 * reference menu is open, nor for an `@` that ends the text: both are a reference being picked.
 */
export const getShownFormulaError = (
  error: TFormulaError,
  context: { text: string; isReferenceMenuOpen: boolean; isTyping?: boolean }
): TFormulaError | null => {
  // Mid-typing, a half-written formula is not a mistake yet: shown after a pause or on blur.
  if (context.isTyping || context.isReferenceMenuOpen || error.code === "empty") return null;
  if (error.code === "incomplete_reference" && context.text.slice(error.position + 1).trim() === "") {
    return null;
  }
  return error;
};
