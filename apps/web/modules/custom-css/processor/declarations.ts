import type { Declaration } from "lightningcss";
import type { TCustomCssWarningCode } from "@formbricks/types/custom-css";
import {
  ALLOWED_ALL_KEYWORDS,
  ALLOWED_POSITION_KEYWORDS,
  ALLOWED_POSITION_VALUES,
  ALLOWED_URL_PROTOCOLS,
  RESOURCE_FUNCTIONS,
  UNSAFE_FUNCTIONS,
  UNSAFE_PROPERTIES,
} from "./constants";
import { type TIssueLocation, fromOneBasedLocation } from "./issues";

/**
 * Declaration policy (ENG-2950). Values are checked on the parsed AST, after the tokenizer has decoded
 * escapes — `u\72 l(…)` arrives here as a url — and every value is walked in full, so a URL inside a
 * custom property, a fallback, `image-set()` or a nested function is found the same way as a plain
 * `background: url(…)`. A declaration that fails is removed as a whole, with a warning.
 */

export type TDeclarationVerdict =
  | { ok: true }
  | {
      ok: false;
      code: Extract<
        TCustomCssWarningCode,
        | "external_resource_removed"
        | "unsafe_value_removed"
        | "unsafe_property_removed"
        | "fixed_position_removed"
      >;
      reason: string;
      location: TIssueLocation | null;
    };

export interface TDeclarationPolicy {
  blockExternalResources: boolean;
}

export const DECLARATION_REASONS = {
  externalResource:
    "External resources (url(), image-set() and similar) are not allowed; the declaration was removed.",
  urlScheme: "This URL scheme is not allowed; the declaration was removed.",
  fixedPosition: "position: fixed is not allowed; use absolute or sticky inside the survey instead.",
  positionValue: "position must be static, relative, absolute or sticky written out, not computed.",
  allValue:
    "all must be initial, unset, revert or revert-layer, so it cannot inherit position from the page.",
  htmlComment: "HTML comment markers are not allowed in values.",
} as const;

type TRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is TRecord => typeof value === "object" && value !== null;

/** The property a declaration sets, ASCII-lowercased (custom properties keep their case). */
export const getPropertyName = (declaration: Declaration): string => {
  if (declaration.property === "custom") {
    const name = declaration.value.name;
    return name.startsWith("--") ? name : name.toLowerCase();
  }
  if (declaration.property === "unparsed") return declaration.value.propertyId.property.toLowerCase();
  return declaration.property;
};

/** A `{ url, loc }` node: every typed and token form of `url()` in the lightningcss AST has this shape. */
const getUrlNode = (node: TRecord): { url: string; loc: unknown } | null =>
  typeof node.url === "string" && isRecord(node.loc) && typeof node.loc.line === "number"
    ? { url: node.url, loc: node.loc }
    : null;

/** A function token: `{ type: "function", value: { name, arguments } }` or a raw `{ type: "function", value: name }`. */
const getFunctionName = (node: TRecord): string | null => {
  if (node.type !== "function") return null;
  if (typeof node.value === "string") return node.value.toLowerCase();
  if (isRecord(node.value) && typeof node.value.name === "string") return node.value.name.toLowerCase();
  return null;
};

/**
 * With the URL policy off, only web and image-data URLs are allowed; `javascript:`, `vbscript:`, other
 * `data:` types, `file:`, `blob:` and every other scheme stay blocked. Parsed with the WHATWG URL parser,
 * so tabs, newlines and odd casing are normalized the way a browser normalizes them.
 */
export const isAllowedUrl = (raw: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(raw, "https://survey.invalid/");
  } catch {
    return false;
  }
  if (ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) return true;
  return parsed.protocol === "data:" && /^image\//i.test(parsed.pathname);
};

/** String arguments of a resource function (`image("a.png")`, `src("a.png")`), which name URLs too. */
const collectStringArguments = (node: unknown, into: string[]): void => {
  if (Array.isArray(node)) {
    for (const item of node) collectStringArguments(item, into);
    return;
  }
  if (!isRecord(node)) return;
  if (node.type === "string" && typeof node.value === "string") into.push(node.value);
  for (const value of Object.values(node)) collectStringArguments(value, into);
};

interface TValueFinding {
  code: "external_resource_removed" | "unsafe_value_removed";
  reason: string;
  location: TIssueLocation | null;
}

/** Script-capable functions and HTML comment markers: removed under every policy. */
const findUnsafeValue = (node: TRecord, functionName: string | null): TValueFinding | null => {
  if (functionName !== null && Object.hasOwn(UNSAFE_FUNCTIONS, functionName)) {
    return { code: "unsafe_value_removed", reason: UNSAFE_FUNCTIONS[functionName], location: null };
  }
  if (node.type === "cdo" || node.type === "cdc") {
    return { code: "unsafe_value_removed", reason: DECLARATION_REASONS.htmlComment, location: null };
  }
  return null;
};

/** A resource in this node: removed under the URL policy, scheme-checked without it. */
const findResource = (
  node: TRecord,
  functionName: string | null,
  policy: TDeclarationPolicy
): TValueFinding | null => {
  const url = getUrlNode(node);
  const location = url ? fromOneBasedLocation(url.loc) : null;
  const isResourceFunction = functionName !== null && RESOURCE_FUNCTIONS.has(functionName);
  if (policy.blockExternalResources) {
    const isResource = url !== null || isResourceFunction || node.type === "image-set";
    return isResource
      ? { code: "external_resource_removed", reason: DECLARATION_REASONS.externalResource, location }
      : null;
  }
  const candidates: string[] = url ? [url.url] : [];
  if (isResourceFunction) collectStringArguments(node.value, candidates);
  return candidates.some((candidate) => !isAllowedUrl(candidate))
    ? { code: "unsafe_value_removed", reason: DECLARATION_REASONS.urlScheme, location }
    : null;
};

/** Pushes `items` so that they pop off `stack` in their original order. */
const pushInOrder = (stack: unknown[], items: unknown[]): void => {
  for (let index = items.length - 1; index >= 0; index--) stack.push(items[index]);
};

/**
 * Walks a value and returns the first problem: script-capable functions and HTML comment markers first
 * (always removed), then resources (removed under the URL policy, scheme-checked without it).
 */
export const scanValue = (value: unknown, policy: TDeclarationPolicy): TValueFinding | null => {
  let resource: TValueFinding | null = null;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      pushInOrder(stack, node);
      continue;
    }
    if (!isRecord(node)) continue;

    const functionName = getFunctionName(node);
    const unsafe = findUnsafeValue(node, functionName);
    if (unsafe) return unsafe;
    resource ??= findResource(node, functionName, policy);
    pushInOrder(stack, Object.values(node));
  }
  return resource;
};

/** `url(`, `image-set(`, … as written in raw text; `-webkit-` forms contain the plain name. */
const RESOURCE_FUNCTION_PATTERN = new RegExp(String.raw`(?:${[...RESOURCE_FUNCTIONS].join("|")})\(`, "i");

/** CSS escapes (`\72 `, `\r`) decoded, so an escaped function name reads like the plain one. */
const decodeCssEscapes = (raw: string): string =>
  raw.replaceAll(
    /\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|([^\n]))/g,
    (_match, hex: string | undefined, char = "") => {
      if (!hex) return char;
      const codePoint = Number.parseInt(hex, 16);
      const isValid = codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
      return String.fromCodePoint(isValid ? codePoint : 0xfffd);
    }
  );

/**
 * Whether an `@supports` condition names a resource function. lightningcss keeps the declarations and
 * selectors of a feature query as raw text, so `scanValue` never sees a `url()` there; nothing is fetched,
 * but the rule would carry a URL into the output, so the whole rule is removed instead.
 */
export const hasResourceInSupportsCondition = (condition: unknown): boolean => {
  const stack: unknown[] = [condition];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node === "string") {
      if (RESOURCE_FUNCTION_PATTERN.test(decodeCssEscapes(node))) return true;
    } else if (Array.isArray(node)) {
      stack.push(...node);
    } else if (isRecord(node)) {
      stack.push(...Object.values(node));
    }
  }
  return false;
};

/** Meaningful tokens of an unparsed value (whitespace dropped). */
const getSignificantTokens = (value: unknown): unknown[] =>
  Array.isArray(value)
    ? value.filter(
        (token) => !(isRecord(token) && isRecord(token.value) && token.value.type === "white-space")
      )
    : [];

/** ASCII lowercasing only, so no non-ASCII letter can lowercase into an allowed keyword. */
const toAsciiLowerCase = (value: string): string =>
  value.replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase());

/** The one identifier an unparsed or custom value consists of, ASCII-lowercased; null for anything else. */
const getSoleKeyword = (declaration: Declaration): string | null => {
  const tokens =
    declaration.property === "unparsed" || declaration.property === "custom"
      ? getSignificantTokens(declaration.value.value)
      : [];
  const only = tokens.length === 1 && isRecord(tokens[0]) ? tokens[0] : null;
  return only?.type === "token" &&
    isRecord(only.value) &&
    only.value.type === "ident" &&
    typeof only.value.value === "string"
    ? toAsciiLowerCase(only.value.value)
    : null;
};

const checkPosition = (declaration: Declaration): TDeclarationVerdict => {
  if (declaration.property === "position") {
    if (declaration.value.type === "fixed") {
      return {
        ok: false,
        code: "fixed_position_removed",
        reason: DECLARATION_REASONS.fixedPosition,
        location: null,
      };
    }
    return ALLOWED_POSITION_VALUES.has(declaration.value.type)
      ? { ok: true }
      : {
          ok: false,
          code: "unsafe_value_removed",
          reason: DECLARATION_REASONS.positionValue,
          location: null,
        };
  }
  const keyword = getSoleKeyword(declaration);
  if (keyword === "fixed") {
    return {
      ok: false,
      code: "fixed_position_removed",
      reason: DECLARATION_REASONS.fixedPosition,
      location: null,
    };
  }
  if (keyword !== null && ALLOWED_POSITION_KEYWORDS.has(keyword)) return { ok: true };
  return {
    ok: false,
    code: "unsafe_value_removed",
    reason: DECLARATION_REASONS.positionValue,
    location: null,
  };
};

/**
 * `all` sets `position` too, so it gets the same keyword rule. lightningcss parses a keyword `all` into its
 * own declaration (escapes decoded, keyword lowercased) and rejects `var()` or `env()` there as a syntax
 * error; an unparsed `all` is still held to a single allowed keyword, so anything else is removed.
 */
const checkAll = (declaration: Declaration): TDeclarationVerdict => {
  const keyword =
    declaration.property === "all" && typeof declaration.value === "string"
      ? declaration.value
      : getSoleKeyword(declaration);
  if (keyword !== null && ALLOWED_ALL_KEYWORDS.has(keyword)) return { ok: true };
  return { ok: false, code: "unsafe_value_removed", reason: DECLARATION_REASONS.allValue, location: null };
};

/** Properties whose value must also pass an allowlist, beyond the value scan every declaration gets. */
const PROPERTY_CHECKS = new Map<string, (declaration: Declaration) => TDeclarationVerdict>([
  ["position", checkPosition],
  ["all", checkAll],
]);

/** Whether a declaration may stay, and if not, why. Used on the way in and again on the final output. */
export const checkDeclaration = (
  declaration: Declaration,
  policy: TDeclarationPolicy
): TDeclarationVerdict => {
  const property = getPropertyName(declaration);
  if (Object.hasOwn(UNSAFE_PROPERTIES, property)) {
    return {
      ok: false,
      code: "unsafe_property_removed",
      reason: UNSAFE_PROPERTIES[property],
      location: null,
    };
  }
  const checkProperty = PROPERTY_CHECKS.get(property);
  if (checkProperty) {
    const verdict = checkProperty(declaration);
    if (!verdict.ok) return verdict;
  }
  const finding = scanValue(declaration.value, policy);
  return finding ? { ok: false, ...finding } : { ok: true };
};

const ANIMATION_PROPERTIES = new Set(["animation", "animation-name"]);

/**
 * Points `animation` / `animation-name` at the namespaced keyframes. `rename` returns the namespaced name
 * for a keyframes rule this CSS defines, or null to leave a name alone (built-in or host keyframes can be
 * referenced, never redefined). Names hidden behind `var()` are not resolved.
 */
export const renameKeyframeReferences = (
  declaration: Declaration,
  rename: (name: string) => string | null
): void => {
  const renameNode = (node: unknown): void => {
    if (!isRecord(node) || (node.type !== "ident" && node.type !== "string")) return;
    if (typeof node.value !== "string") return;
    const renamed = rename(node.value);
    if (renamed) node.value = renamed;
  };

  if (declaration.property === "animation") {
    for (const animation of declaration.value) renameNode(animation.name);
  } else if (declaration.property === "animation-name") {
    for (const name of declaration.value) renameNode(name);
  } else if (
    declaration.property === "unparsed" &&
    ANIMATION_PROPERTIES.has(declaration.value.propertyId.property.toLowerCase())
  ) {
    for (const token of declaration.value.value) {
      if (token.type === "token" || token.type === "animation-name") renameNode(token.value);
    }
  }
};
