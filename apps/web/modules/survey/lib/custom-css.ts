import { createHash } from "node:crypto";
import postcss, { type ChildNode, type Container, type Declaration } from "postcss";
import selectorParser from "postcss-selector-parser";
import valueParser from "postcss-value-parser";
import {
  CUSTOM_CSS_LIMITS,
  CUSTOM_CSS_PROCESSOR_VERSION,
  type TCustomCss,
  type TCustomCssRemoval,
  type TCustomCssScope,
} from "@formbricks/types/custom-css";
import { ValidationError } from "@formbricks/types/errors";

// Unknown functions are refused rather than assuming that future CSS cannot initiate a request.
const ALLOWED_FUNCTIONS = new Set([
  "",
  "var",
  "calc",
  "min",
  "max",
  "clamp",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "light-dark",
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeating-conic-gradient",
  "translate",
  "translatex",
  "translatey",
  "translatez",
  "translate3d",
  "scale",
  "scalex",
  "scaley",
  "scalez",
  "scale3d",
  "rotate",
  "rotatex",
  "rotatey",
  "rotatez",
  "rotate3d",
  "skew",
  "skewx",
  "skewy",
  "matrix",
  "matrix3d",
  "perspective",
  "cubic-bezier",
  "steps",
  "linear",
  "blur",
  "brightness",
  "contrast",
  "drop-shadow",
  "grayscale",
  "hue-rotate",
  "invert",
  "opacity",
  "saturate",
  "sepia",
  "repeat",
  "minmax",
  "fit-content",
  "counter",
  "counters",
  "circle",
  "ellipse",
  "inset",
  "polygon",
  "round",
  "mod",
  "rem",
]);
const ALLOWED_AT_RULES = new Set(["media", "supports", "container", "keyframes"]);
const MAX_NODES = 5000;
const MAX_DEPTH = 12;
const MAX_SELECTORS = 2048;
const THEME_VARIABLES = new Set([
  "--fb-brand-color",
  "--fb-survey-brand-color",
  "--fb-focus-color",
  "--fb-brand-text-color",
  "--fb-heading-color",
  "--fb-element-headline-color",
  "--fb-element-description-color",
  "--fb-input-color",
  "--fb-label-color",
  "--fb-subheading-color",
  "--fb-placeholder-color",
  "--fb-input-placeholder-color",
  "--fb-border-color",
  "--fb-border-color-highlight",
  "--fb-input-border-color",
  "--fb-survey-background-color",
  "--fb-survey-border-color",
  "--fb-survey-highlight-border-color",
  "--fb-focus-ring-inner-color",
  "--fb-state-mix-color",
  "--fb-state-base-weight",
  "--fb-focus-ring-outer-color",
  "--fb-border-radius",
  "--fb-input-border-radius",
  "--fb-option-border-radius",
  "--fb-button-border-radius",
  "--fb-input-background-color",
  "--fb-input-bg-color",
  "--fb-option-bg-color",
  "--fb-signature-text-color",
  "--fb-branding-text-color",
  "--fb-input-background-color-selected",
  "--fb-accent-background-color",
  "--fb-accent-background-color-selected",
  "--fb-calendar-tile-color",
  "--fb-button-bg-color",
  "--fb-button-text-color",
  "--fb-back-button-color",
  "--fb-button-height",
  "--fb-button-font-size",
  "--fb-button-font-weight",
  "--fb-button-padding-x",
  "--fb-button-padding-y",
  "--fb-input-text-color",
  "--fb-input-height",
  "--fb-input-font-size",
  "--fb-input-padding-x",
  "--fb-input-padding-y",
  "--fb-input-placeholder-opacity",
  "--fb-input-shadow",
  "--fb-option-label-color",
  "--fb-option-border-color",
  "--fb-option-padding-x",
  "--fb-option-padding-y",
  "--fb-option-font-size",
  "--fb-element-headline-font-size",
  "--fb-element-headline-font-weight",
  "--fb-element-description-font-size",
  "--fb-element-description-font-weight",
  "--fb-element-upper-label-font-size",
  "--fb-element-upper-label-color",
  "--fb-element-upper-label-opacity",
  "--fb-element-upper-label-font-weight",
  "--fb-progress-track-height",
  "--fb-progress-track-border-radius",
  "--fb-progress-track-bg-color",
  "--fb-progress-indicator-bg-color",
]);
const ANIMATION_KEYWORDS = new Set([
  "none",
  "auto",
  "normal",
  "reverse",
  "alternate",
  "alternate-reverse",
  "forwards",
  "backwards",
  "both",
  "running",
  "paused",
  "infinite",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "linear",
  "step-start",
  "step-end",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

/** Decode CSS identifier escapes before checking names, including escaped function/property names. */
const decode = (value: string): string =>
  value.replace(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\r\f ])?|\\([^\n\r\f])/gi, (_, hex, char) => {
    if (!hex) return char;
    const point = Number.parseInt(hex, 16);
    return point === 0 || point > 0x10ffff ? "\uFFFD" : String.fromCodePoint(point);
  });

const safeValue = (value: string): boolean => {
  let safe = true;
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type === "function" && !ALLOWED_FUNCTIONS.has(decode(node.value).toLowerCase())) safe = false;
    if ("unclosed" in node && node.unclosed) safe = false;
    // CSS comments can splice escaped/token spellings differently across parsers. Refuse that ambiguity.
    if (node.type === "comment") safe = false;
  });
  return safe;
};

const getKeyframeName = (scope: TCustomCssScope, name: string, appearance?: "light" | "dark") =>
  `fb-css-${scope}${appearance ? `-${appearance}` : ""}-${createHash("sha256").update(decode(name)).digest("hex").slice(0, 16)}`;

// Keep renderer theme tokens addressable; customer variables get a shared namespace across both
// workspace/survey and light/dark so they cannot accidentally consume a host page's URL-valued var.
const customPropertyName = (name: string) =>
  THEME_VARIABLES.has(name)
    ? name
    : `--fb-css-${createHash("sha256").update(name).digest("hex").slice(0, 16)}`;

/**
 * Scope selector ASTs, never string-prefix a comma list. A root reference is accepted only at the
 * beginning, so root sibling escapes and functional selectors that reference the host are refused.
 */
const scopeSelectors = (input: string, root: string, parents?: string[]): string[] => {
  let parsed: ReturnType<ReturnType<typeof selectorParser>["astSync"]>;
  try {
    parsed = selectorParser().astSync(input);
  } catch {
    throw new ValidationError("CSS selector syntax error");
  }
  const results: string[] = [];
  if (parsed.nodes.length > MAX_SELECTORS) throw new ValidationError("CSS has too many selectors");
  for (const selector of parsed.nodes) {
    let invalid = false;
    let rootSeen = false;
    let descendantSeen = false;
    let universals = 0;
    let compounds = 0;
    let beforeRoot = false;
    let selectorNodes = 0;
    selector.walk((node) => {
      if (++selectorNodes > 256) throw new ValidationError("CSS selector is too complex");
      if (node.type === "comment") {
        invalid = true;
        return;
      }
      const value = decode(node.value ?? "").toLowerCase();
      if (
        node.type === "pseudo" &&
        [
          ":host",
          ":host-context",
          ":has",
          ":global",
          "::slotted",
          "::part",
          "::backdrop",
          "::view-transition",
          "::view-transition-group",
          "::view-transition-image-pair",
          "::view-transition-old",
          "::view-transition-new",
        ].includes(value)
      )
        invalid = true;
      if (node.type === "universal" && ++universals > 3) invalid = true;
      if (node.type === "combinator" && ++compounds > 20) invalid = true;
      const isRoot =
        (node.type === "id" && value === "fbjs") ||
        (node.type === "tag" && ["html", "body"].includes(value)) ||
        (node.type === "pseudo" && value === ":root");
      if (isRoot && node.parent !== selector) invalid = true;
    });
    // Only leading document roots are rebased. `html body` collapses to the same survey root.
    for (const node of [...selector.nodes]) {
      const value = decode(node.value ?? "").toLowerCase();
      const isRoot =
        (node.type === "id" && value === "fbjs") ||
        (node.type === "tag" && ["html", "body"].includes(value)) ||
        (node.type === "pseudo" && value === ":root");
      if (isRoot) {
        if (descendantSeen || parents || beforeRoot) {
          invalid = true;
          break;
        }
        if (rootSeen) {
          const prev = node.prev();
          if (prev?.type === "combinator" && prev.value.trim() === "") prev.remove();
          node.remove();
        } else {
          node.replaceWith(
            ...selectorParser()
              .astSync(root)
              .nodes[0].nodes.map((part) => part.clone({}))
          );
          rootSeen = true;
        }
      } else if (node.type === "combinator") {
        if (rootSeen && !descendantSeen && ["+", "~", "||"].includes(node.value.trim())) invalid = true;
        if (node.value.trim() !== "" && node === selector.first && !rootSeen && !parents) invalid = true;
      } else if (rootSeen && node.type !== "pseudo" && node.type !== "attribute") {
        descendantSeen = true;
      } else if (!rootSeen) {
        beforeRoot = true;
      }
    }
    if (invalid) throw new Error("Selector can reach outside the survey or exceeds the supported complexity");
    let hasNesting = false;
    selector.walkNesting(() => {
      hasNesting = true;
    });
    if (parents) {
      for (const parent of parents) {
        const nested = selectorParser().astSync(selector.toString()).nodes[0];
        if (hasNesting) {
          nested.walkNesting((node) => {
            node.replaceWith(
              ...selectorParser()
                .astSync(parent)
                .nodes[0].nodes.map((part) => part.clone({}))
            );
          });
          results.push(...scopeSelectors(nested.toString(), root));
        } else results.push(...scopeSelectors(`${parent} ${nested.toString()}`, root));
        if (results.length > MAX_SELECTORS) throw new ValidationError("CSS expands to too many selectors");
      }
    } else {
      if (hasNesting) throw new Error("A nesting selector needs a parent rule");
      results.push(rootSeen ? selector.toString() : `${root} ${selector.toString()}`);
    }
  }
  if (results.length > MAX_SELECTORS) throw new ValidationError("CSS expands to too many selectors");
  return results;
};

export const compileCustomCss = (
  sources: { light: string; dark: string },
  scope: TCustomCssScope
): { compiled: TCustomCss | null; removed: TCustomCssRemoval[] } => {
  if (
    Buffer.byteLength(sources.light, "utf8") + Buffer.byteLength(sources.dark, "utf8") >
    CUSTOM_CSS_LIMITS[scope]
  ) {
    throw new ValidationError(`Custom CSS exceeds the ${CUSTOM_CSS_LIMITS[scope] / 1024} KB ${scope} limit`);
  }
  const removed: TCustomCssRemoval[] = [];
  let nodes = 0;
  let selectors = 0;
  const lightKeyframes = new Map<string, string>();
  const compileMode = (appearance: "light" | "dark") => {
    const source = sources[appearance];
    if (!source.trim()) return null;
    const remove = (node: ChildNode, message: string) => {
      removed.push({
        appearance,
        message,
        line: node.source?.start?.line ?? 1,
        column: node.source?.start?.column ?? 1,
      });
    };
    try {
      const ast = postcss.parse(source);
      const rootSelector = appearance === "dark" ? '#fbjs[data-appearance="dark"]' : "#fbjs";
      const keyframes = new Map<string, string>();
      ast.walkAtRules((node) => {
        if (
          decode(node.name).toLowerCase() === "keyframes" &&
          /^[a-zA-Z_][\w-]*$/.test(decode(node.params))
        ) {
          const name = getKeyframeName(scope, node.params, appearance);
          keyframes.set(decode(node.params), name);
          if (appearance === "light") lightKeyframes.set(decode(node.params), name);
        }
      });
      const declaration = (node: Declaration, inKeyframes = false): string => {
        const decodedProperty = decode(node.prop);
        const property = decodedProperty.startsWith("--") ? decodedProperty : decodedProperty.toLowerCase();
        if (!/^--[\w-]+$/.test(property) && !/^-?[a-z][a-z-]*$/.test(property)) {
          remove(node, "Unsupported property name");
          return "";
        }
        if (
          ["behavior", "-moz-binding"].includes(property) ||
          !safeValue(node.value) ||
          (property === "position" &&
            decode(node.value).trim().toLowerCase() !== "static" &&
            !["relative", "absolute", "sticky"].includes(decode(node.value).trim().toLowerCase()))
        ) {
          remove(node, "Network resources, unsupported functions and fixed positioning are not allowed");
          return "";
        }
        if (
          ["all", "anchor-name", "anchor-scope", "view-transition-name", "view-transition-class"].includes(
            property
          )
        ) {
          remove(node, "Document-wide names are not supported");
          return "";
        }
        // No caller-controlled custom property can become fixed positioning through var().
        if (property.startsWith("--") && /\bfixed\b/i.test(decode(node.value))) {
          remove(node, "Fixed positioning through custom properties is not allowed");
          return "";
        }
        let value = node.value.trim();
        const parsedValue = valueParser(value);
        parsedValue.walk((part) => {
          if (part.type === "function" && decode(part.value).toLowerCase() === "var") {
            const variable = part.nodes.find((child) => child.type === "word");
            if (variable) variable.value = customPropertyName(decode(variable.value));
          }
          if (
            part.type === "function" &&
            ["counter", "counters"].includes(decode(part.value).toLowerCase())
          ) {
            const name = part.nodes.find((child) => child.type === "word");
            if (name) name.value = getKeyframeName(scope, name.value);
          }
        });
        value = parsedValue.toString();
        if (property === "animation" || property === "animation-name") {
          const parsed = valueParser(value);
          let dynamic = false;
          const animationName = (name: string) =>
            keyframes.get(decode(name)) ??
            lightKeyframes.get(decode(name)) ??
            getKeyframeName(scope, name, appearance);
          parsed.walk((part) => {
            if (part.type === "function") {
              if (decode(part.value).toLowerCase() === "var") dynamic = true;
              return false;
            }
            if (part.type === "string") part.value = animationName(part.value);
            if (part.type === "word" && decode(part.value).toLowerCase() === "inherit") dynamic = true;
            if (
              part.type === "word" &&
              !ANIMATION_KEYWORDS.has(decode(part.value).toLowerCase()) &&
              !/^[+-]?(?:\d*\.)?\d+(?:ms|s)?$/i.test(part.value)
            )
              part.value = animationName(part.value);
          });
          if (dynamic) {
            remove(node, "Animation names must be explicit");
            return "";
          }
          value = parsed.toString();
        }
        if (["counter-reset", "counter-increment", "counter-set"].includes(property)) {
          const parsed = valueParser(value);
          let dynamic = false;
          parsed.walk((part) => {
            if (
              part.type === "function" ||
              (part.type === "word" && decode(part.value).toLowerCase() === "inherit")
            )
              dynamic = true;
            if (
              part.type === "word" &&
              !["none", "initial", "unset", "revert", "revert-layer"].includes(part.value) &&
              !/^[+-]?\d+$/.test(part.value)
            )
              part.value = getKeyframeName(scope, part.value);
          });
          if (dynamic) {
            remove(node, "Counter names must be explicit");
            return "";
          }
          value = parsed.toString();
        }
        // Important declarations in the renderer's reserved first layers override its important
        // utility layer. Keyframes cannot contain important declarations (CSS ignores them).
        return `${property.startsWith("--") ? customPropertyName(property) : property}:${value}${inKeyframes ? "" : " !important"};`;
      };
      const visit = (
        container: Container,
        depth: number,
        parents?: string[],
        inKeyframes = false
      ): string => {
        if (depth > MAX_DEPTH) throw new ValidationError("CSS nesting is too deep");
        let output = "";
        for (const node of container.nodes ?? []) {
          if (++nodes > MAX_NODES) throw new ValidationError("CSS has too many rules or declarations");
          if (node.type === "comment") continue;
          if (node.type === "decl") {
            if (parents) output += `${parents.join(",")}{${declaration(node, inKeyframes)}}`;
            else remove(node, "Declarations require a selector");
          } else if (node.type === "rule") {
            let scoped: string[];
            if (inKeyframes) {
              if (!/^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(node.selector)) {
                remove(node, "Unsupported keyframe selector");
                continue;
              }
              scoped = [node.selector];
            } else {
              try {
                scoped = scopeSelectors(node.selector, rootSelector, parents);
              } catch (error) {
                if (error instanceof ValidationError) throw error;
                remove(node, "Selector is unsupported or can reach outside the survey");
                continue;
              }
            }
            selectors += scoped.length;
            if (selectors > MAX_SELECTORS) throw new ValidationError("CSS expands to too many selectors");
            const declarations = node.nodes.filter((child): child is Declaration => child.type === "decl");
            const css = declarations
              .map((child) => {
                if (++nodes > MAX_NODES) throw new ValidationError("CSS has too many declarations");
                return declaration(child, inKeyframes);
              })
              .join("");
            if (css) output += `${scoped.join(",")}{${css}}`;
            const nested = node.clone();
            nested.removeAll();
            for (const child of node.nodes) if (child.type !== "decl") nested.append(child.clone());
            output += visit(nested, depth + 1, scoped, inKeyframes);
          } else if (node.type === "atrule") {
            const name = decode(node.name).toLowerCase();
            if (!ALLOWED_AT_RULES.has(name) || !node.nodes || !safeValue(node.params) || inKeyframes) {
              remove(node, "Unsupported at-rule or resource request");
              continue;
            }
            if (name === "keyframes") {
              const key = keyframes.get(decode(node.params));
              if (!key) {
                remove(node, "Unsupported animation name");
                continue;
              }
              output += `@keyframes ${key}{${visit(node, depth + 1, undefined, true)}}`;
            } else {
              output += `@${name} ${node.params}{${visit(node, depth + 1, parents)}}`;
            }
          }
          if (output.length > 1024 * 1024) throw new ValidationError("Processed CSS is too large");
        }
        return output;
      };
      return { source, compiled: visit(ast, 0) };
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof postcss.CssSyntaxError)
        throw new ValidationError(`CSS syntax error at ${error.line}:${error.column}: ${error.reason}`);
      throw new ValidationError("CSS could not be parsed");
    }
  };
  const light = compileMode("light");
  const dark = compileMode("dark");
  return {
    compiled: light || dark ? { light, dark, processorVersion: CUSTOM_CSS_PROCESSOR_VERSION } : null,
    removed,
  };
};

export const recompileCustomCss = (input: TCustomCss | null | undefined, scope: TCustomCssScope) =>
  input === undefined
    ? undefined
    : compileCustomCss({ light: input?.light?.source ?? "", dark: input?.dark?.source ?? "" }, scope)
        .compiled;
