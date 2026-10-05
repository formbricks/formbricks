import type { Declaration } from "lightningcss";
import type { TCustomCssWarningCode } from "@formbricks/types/custom-css";
import {
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
      for (let index = node.length - 1; index >= 0; index--) stack.push(node[index]);
      continue;
    }
    if (!isRecord(node)) continue;

    const functionName = getFunctionName(node);
    if (functionName !== null && Object.hasOwn(UNSAFE_FUNCTIONS, functionName)) {
      return { code: "unsafe_value_removed", reason: UNSAFE_FUNCTIONS[functionName], location: null };
    }
    if (node.type === "cdo" || node.type === "cdc") {
      return { code: "unsafe_value_removed", reason: DECLARATION_REASONS.htmlComment, location: null };
    }

    if (!resource) {
      const url = getUrlNode(node);
      const isResourceFunction = functionName !== null && RESOURCE_FUNCTIONS.has(functionName);
      if (policy.blockExternalResources) {
        if (url || isResourceFunction || node.type === "image-set") {
          resource = {
            code: "external_resource_removed",
            reason: DECLARATION_REASONS.externalResource,
            location: url ? fromOneBasedLocation(url.loc) : null,
          };
        }
      } else {
        const candidates: string[] = url ? [url.url] : [];
        if (isResourceFunction) collectStringArguments(node.value, candidates);
        if (candidates.some((candidate) => !isAllowedUrl(candidate))) {
          resource = {
            code: "unsafe_value_removed",
            reason: DECLARATION_REASONS.urlScheme,
            location: url ? fromOneBasedLocation(url.loc) : null,
          };
        }
      }
    }

    const children = Object.values(node);
    for (let index = children.length - 1; index >= 0; index--) stack.push(children[index]);
  }
  return resource;
};

/** Meaningful tokens of an unparsed value (whitespace dropped). */
const getSignificantTokens = (value: unknown): unknown[] =>
  Array.isArray(value)
    ? value.filter(
        (token) => !(isRecord(token) && isRecord(token.value) && token.value.type === "white-space")
      )
    : [];

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
  const tokens =
    declaration.property === "unparsed" || declaration.property === "custom"
      ? getSignificantTokens(declaration.value.value)
      : [];
  const only = tokens.length === 1 && isRecord(tokens[0]) ? tokens[0] : null;
  const keyword =
    only && only.type === "token" && isRecord(only.value) && only.value.type === "ident"
      ? String(only.value.value).toLowerCase()
      : null;
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
  if (property === "position") {
    const verdict = checkPosition(declaration);
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
      if (token.type === "token") renameNode(token.value);
      else if (token.type === "animation-name") renameNode(token.value);
    }
  }
};
