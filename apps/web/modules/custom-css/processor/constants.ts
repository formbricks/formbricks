import { Features, type Targets } from "lightningcss";
import type { TCustomCssAppearance, TCustomCssScope } from "@formbricks/types/custom-css";
import { CUSTOM_CSS_LAYER_ORDER } from "@formbricks/types/custom-css";

/**
 * Block every resource-loading value (`url()`, `image-set()`, `src()`, …) in customer CSS — relative,
 * `data:` and same-origin URLs included. One server-side constant shared by validation and saving; there
 * is deliberately no env var or setting. Turning it off disables only that filter: parsing, selector
 * isolation, the dangerous-scheme check, at-rule removal (`@import` and `@font-face` stay unsupported)
 * and every limit still apply. The policy is part of the processor version, so flipping it reprocesses
 * every stored stylesheet before it is served again.
 */
export const BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES = true as const;

/**
 * Bump on ANY change to what the processor accepts or emits — policy tables, limits, selector rewriting,
 * output format — and on every `lightningcss` upgrade (its printer and minifier shape the output).
 * Stored output compiled under another version is reprocessed from source before delivery.
 */
const CUSTOM_CSS_PROCESSOR_REVISION = 1;

/** The lightningcss version the revision above was produced with; a unit test pins the installed one. */
export const CUSTOM_CSS_LIGHTNINGCSS_VERSION = "1.32.0";

/** The effective version stored next to compiled output: the revision plus the URL policy it ran under. */
export const getCustomCssProcessorVersion = (blockExternalResources: boolean): number =>
  CUSTOM_CSS_PROCESSOR_REVISION * 10 + (blockExternalResources ? 0 : 1);

export const CUSTOM_CSS_PROCESSOR_VERSION = getCustomCssProcessorVersion(BLOCK_EXTERNAL_CUSTOM_CSS_RESOURCES);

/*
 * Limits (ENG-2950, M2.08). Size budgets live in `CUSTOM_CSS_MAX_SOURCE_BYTES`; these bound the shape of
 * the CSS. Every one is checked before the expensive work (a tokenizer pre-scan before parsing, the AST
 * before nesting is flattened) and the rule count again after flattening. Exceeding one rejects the
 * whole operation with `limit_exceeded`. The values sit far above real stylesheets — the CMS file this
 * feature was designed around has 17 rules, one level of nesting and short selectors — and well below
 * what the native parser can be pushed to: around 10,000 nested blocks it overflows the stack and takes
 * the Node process down, which is why depth is bounded by a pre-scan that runs before it ever sees the
 * source. Documented for customers (M4.5); keep the docs in step when changing them.
 */

/** Rule and at-rule blocks nested inside each other: `@media { .a { &:hover { } } }` is 3. */
export const CUSTOM_CSS_MAX_NESTING_DEPTH = 8;

/** Parentheses, brackets and functions nested inside each other in one value, selector or prelude. */
export const CUSTOM_CSS_MAX_FUNCTION_DEPTH = 16;

/** Rules per scope (light + dark together), counting at-rule blocks and keyframe blocks. */
export const CUSTOM_CSS_MAX_RULES = 2_000;

/** Selectors in one selector list, including the lists inside `:is()`, `:where()`, `:not()` and `:has()`. */
export const CUSTOM_CSS_MAX_SELECTOR_LIST_LENGTH = 64;

/** Compound selectors in one selector once nesting is resolved, including those inside `:is()` etc. */
export const CUSTOM_CSS_MAX_SELECTOR_COMPOUNDS = 20;

/**
 * Compound selectors with no type, class, id or attribute (`*`, `:hover`, `:not(.x)`) in one selector once
 * nesting is resolved. `.question *` stays valid; `* * *` chains, which made typing in a survey several
 * times slower in M2.08's measurements, are rejected.
 */
export const CUSTOM_CSS_MAX_UNIVERSAL_COMPOUNDS = 2;

/** Warnings reported per operation; the rest of the removals still happen, they are just not listed. */
export const CUSTOM_CSS_MAX_WARNINGS = 100;

/** M2.01 browser targets — the same ones Tailwind compiles the built-in survey styles for. */
const version = (major: number, minor = 0): number => (major << 16) | (minor << 8);

export const CUSTOM_CSS_TARGETS: Targets = {
  chrome: version(111),
  firefox: version(128),
  safari: version(16, 4),
  ios_saf: version(16, 4),
};

export const CUSTOM_CSS_INCLUDE_FEATURES = Features.Nesting | Features.MediaQueries;
export const CUSTOM_CSS_EXCLUDE_FEATURES =
  Features.LogicalProperties | Features.DirSelector | Features.LightDark;

/** The survey root every customer selector is scoped to. */
export const SURVEY_ROOT_ID = "fbjs";
export const APPEARANCE_ATTRIBUTE = "data-appearance";

type TCustomCssLayer = (typeof CUSTOM_CSS_LAYER_ORDER)[number];

export const getCustomCssLayerName = (
  scope: TCustomCssScope,
  appearance: TCustomCssAppearance
): TCustomCssLayer => (appearance === "dark" ? `fb-${scope}-dark` : `fb-${scope}`);

/*
 * Policy tables. Anything not explicitly allowed is removed with a warning, and every table is covered by
 * processor.test.ts. The allowed at-rules — `@media`, `@supports`, `@container` (their rules scoped like
 * top-level ones) and `@keyframes` (namespaced) — are the explicit cases in process.ts; every other at-rule
 * is removed.
 */

/** Display names for removed at-rules. Unknown at-rules are never named, so a reason never echoes source. */
export const REMOVED_AT_RULE_NAMES: Record<string, string> = {
  "layer-block": "@layer",
  "layer-statement": "@layer",
  scope: "@scope",
  property: "@property",
  namespace: "@namespace",
  page: "@page",
  "counter-style": "@counter-style",
  "font-feature-values": "@font-feature-values",
  "font-palette-values": "@font-palette-values",
  "moz-document": "@-moz-document",
  viewport: "@viewport",
  "custom-media": "@custom-media",
  "starting-style": "@starting-style",
  "view-transition": "@view-transition",
  nesting: "@nest",
};

/** Properties removed wherever they appear. Names are compared ASCII-lowercased, after escape decoding. */
export const UNSAFE_PROPERTIES: Record<string, string> = {
  behavior: "behavior can run script in legacy browsers.",
  "-ms-behavior": "-ms-behavior can run script in legacy browsers.",
  "-moz-binding": "-moz-binding can run script in legacy browsers.",
  "view-transition-name": "view-transition-name registers a page-wide name and can break the host page.",
  "view-transition-class": "view-transition-class applies to page-wide view transitions.",
};

/** Value functions removed wherever they appear, whatever the URL policy. */
export const UNSAFE_FUNCTIONS: Record<string, string> = {
  expression: "expression() can run script in legacy browsers.",
  attr: "attr() can read attribute values into styles.",
  element: "element() can render other parts of the page.",
  "-moz-element": "-moz-element() can render other parts of the page.",
  "-webkit-canvas": "-webkit-canvas() can render page canvases.",
};

/** Functions whose arguments name resources to load. Blocked outright while the URL policy is on. */
export const RESOURCE_FUNCTIONS = new Set([
  "url",
  "src",
  "image",
  "image-set",
  "-webkit-image-set",
  "cross-fade",
  "-webkit-cross-fade",
]);

/**
 * `position` keywords that keep an element in the survey's layout. `fixed` would pin it to the viewport
 * over the host page; `inherit` could copy `fixed` from a host container; anything computed (`var()`)
 * cannot be checked, so it is removed too.
 */
export const ALLOWED_POSITION_VALUES = new Set(["static", "relative", "absolute", "sticky"]);
export const ALLOWED_POSITION_KEYWORDS = new Set(["initial", "unset", "revert", "revert-layer"]);

/** URL schemes allowed only when the URL policy is off. Relative URLs resolve against the page (https). */
export const ALLOWED_URL_PROTOCOLS = new Set(["https:", "http:"]);

/** Pseudo-classes removed with their selector: shadow DOM, CSS Modules and arguments we cannot analyse. */
export const UNSAFE_PSEUDO_CLASSES: Record<string, string> = {
  host: ":host",
  scope: ":scope",
  local: ":local()",
  global: ":global()",
  "custom-function": "unknown functional pseudo-classes",
};

/**
 * Pseudo-elements removed with their selector: ones that paint outside the survey (the top layer, page
 * transitions, pickers) or reach into shadow trees.
 */
export const UNSAFE_PSEUDO_ELEMENTS: Record<string, string> = {
  backdrop: "::backdrop",
  "view-transition": "::view-transition",
  "view-transition-group": "::view-transition-group()",
  "view-transition-image-pair": "::view-transition-image-pair()",
  "view-transition-old": "::view-transition-old()",
  "view-transition-new": "::view-transition-new()",
  "picker-function": "::picker()",
  slotted: "::slotted()",
  part: "::part()",
  "cue-function": "::cue()",
  "cue-region-function": "::cue-region()",
  "custom-function": "unknown functional pseudo-elements",
};

/** Combinators that keep a selector in the light DOM. */
export const ALLOWED_COMBINATORS = new Set(["descendant", "child", "next-sibling", "later-sibling"]);
