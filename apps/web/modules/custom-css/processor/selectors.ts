import type { Selector, SelectorComponent } from "lightningcss";
import {
  ALLOWED_COMBINATORS,
  APPEARANCE_ATTRIBUTE,
  SURVEY_ROOT_ID,
  UNSAFE_PSEUDO_CLASSES,
  UNSAFE_PSEUDO_ELEMENTS,
} from "./constants";

/**
 * Selector isolation (ENG-2950). Every selector must match only the survey root (`#fbjs`) or elements
 * inside it:
 *
 * - `:root`, `html`, `body` and `#fbjs` are root aliases. A selector that starts with one is anchored
 *   there (`body > *` → `#fbjs > *`, `html.x` → `#fbjs.x`); any other selector gets `#fbjs ` in front.
 * - Nothing may come before the anchor (`.x :root`, `.x #fbjs` read the host page) and a sibling
 *   combinator may not follow the root itself (`:root ~ div`, `html + x` would leave it). Once a step has
 *   gone below the root, siblings stay inside, so `#fbjs .a + .b` is fine.
 * - Dark rules anchor on `#fbjs[data-appearance="dark"]`, without doubling an attribute the creator
 *   already wrote.
 * - Nested selectors are judged against their parent the same way: they must start from `&`, and a
 *   sibling step straight off a parent that can be the root is removed. `:not(&)` and other selectors
 *   that only mention `&` inside an argument would flatten to an unscoped selector, so they are removed.
 * - Arguments of `:is()`, `:where()`, `:not()`, `:has()` and `:nth-*( of …)` only narrow what the
 *   subject matches — they never change which element is styled — but their contents still pass the
 *   same pseudo-class and pseudo-element checks, and root aliases in them are rewritten to `#fbjs`.
 * - A relative `:has()` argument that starts with a combinator (`:has(> .b)`, `:has(+ .x)`) is parsed with
 *   a leading `:scope` standing for the element `:has()` is on; that one `:scope` is allowed, every other
 *   `:scope` is not. A sibling step out of it (`:has(+ …)`, `:has(~ …)`) is removed when that element can
 *   be the survey root — `#fbjs:has(~ .host)` would read the host page's elements next to the survey.
 *
 * Selectors that fail are removed with `unsafe_selector_removed`; a rule loses only its failing
 * selectors and goes away only when none are left.
 */

/** Where the subject of a selector can be: the root itself, or strictly inside it. */
export type TSubjectPosition = "root" | "inside";

export type TSelectorOutcome =
  | { ok: true; selector: Selector; subject: TSubjectPosition }
  | { ok: false; reason: string };

export const SELECTOR_REASONS = {
  outsideRoot: "Selectors cannot depend on elements outside the survey root.",
  siblingOfRoot: "Sibling combinators cannot reach elements next to the survey root.",
  nestingRequired: "Nested selectors must start from their parent rule (&).",
  outsideParent: "Nested selectors cannot depend on elements outside their parent rule.",
  nestingAtTopLevel: "& is only allowed inside a nested rule.",
  combinator: "Shadow DOM and non-standard combinators are not supported.",
  namespace: "Namespace selectors are not supported.",
  malformed: "This selector cannot be scoped to the survey.",
} as const;

const ROOT_ID_COMPONENT: SelectorComponent = { type: "id", name: SURVEY_ROOT_ID };
const DARK_ATTRIBUTE_COMPONENT: SelectorComponent = {
  type: "attribute",
  namespace: null,
  name: APPEARANCE_ATTRIBUTE,
  operation: { operator: "equal", value: "dark", caseSensitivity: "case-sensitive" },
};

const SIBLING_COMBINATORS = new Set(["next-sibling", "later-sibling"]);
/**
 * Combinators lightningcss puts after the implicit `:scope` of a relative `:has()` argument. A descendant
 * argument (`:has(.b)`) gets no `:scope` at all, so `:has(:scope .b)` can only have been written out.
 */
const RELATIVE_COMBINATORS = new Set(["child", "next-sibling", "later-sibling"]);
/** Pseudo-classes whose arguments are matched against the element they are on. */
const SAME_ELEMENT_KINDS = new Set(["is", "where", "any", "not", "nth-child", "nth-last-child"]);
const ROOT_ALIAS_TYPES = new Set(["html", "body"]);
const QUALIFYING_TYPES = new Set(["type", "id", "class", "attribute", "nesting"]);
const MATCHES_ANY_KINDS = new Set(["is", "where", "any"]);

type TPseudoClass = Extract<SelectorComponent, { type: "pseudo-class" }>;

export const isRootAlias = (component: SelectorComponent): boolean =>
  (component.type === "id" && component.name === SURVEY_ROOT_ID) ||
  (component.type === "pseudo-class" && component.kind === "root") ||
  (component.type === "type" && ROOT_ALIAS_TYPES.has(component.name.toLowerCase()));

const isDarkAttribute = (component: SelectorComponent): boolean =>
  component.type === "attribute" &&
  !component.namespace &&
  component.name === APPEARANCE_ATTRIBUTE &&
  component.operation?.operator === "equal" &&
  component.operation.value === "dark";

/** The selector lists a pseudo-class takes as arguments (none for most). */
const getArgumentSelectors = (component: SelectorComponent): Selector[] => {
  if (component.type !== "pseudo-class") return [];
  const pseudo = component as TPseudoClass & { selectors?: unknown; of?: unknown };
  if (component.kind === "host") return Array.isArray(pseudo.selectors) ? [pseudo.selectors as Selector] : [];
  if (Array.isArray(pseudo.selectors)) return pseudo.selectors as Selector[];
  if (Array.isArray(pseudo.of)) return pseudo.of as Selector[];
  return [];
};

/**
 * Whether a `:has()` argument starts with the `:scope` lightningcss adds to a relative selector
 * (`:has(> .b)` parses as `:has(:scope > .b)`): `:scope` alone, followed by a child or sibling step.
 * lightningcss parses and prints `:has(:scope > .b)` exactly like `:has(> .b)`, so the two are one case.
 */
const hasImplicitScope = (argument: Selector): boolean => {
  const [first, second] = argument;
  return (
    first?.type === "pseudo-class" &&
    first.kind === "scope" &&
    second?.type === "combinator" &&
    RELATIVE_COMBINATORS.has(second.value)
  );
};

/** The argument selectors a pseudo-class is checked by, without the implicit `:scope` of `:has()`. */
const getCheckedArguments = (component: SelectorComponent): Selector[] => {
  const args = getArgumentSelectors(component);
  if (component.type !== "pseudo-class" || component.kind !== "has") return args;
  return args.map((argument) => (hasImplicitScope(argument) ? argument.slice(1) : argument));
};

/** A copy of a pseudo-class with its argument selectors replaced. */
const withArgumentSelectors = (component: SelectorComponent, args: Selector[]): SelectorComponent => {
  const pseudo = component as TPseudoClass & { selectors?: unknown; of?: unknown };
  if (Array.isArray(pseudo.selectors)) return { ...component, selectors: args } as SelectorComponent;
  if (Array.isArray(pseudo.of)) return { ...component, of: args } as SelectorComponent;
  return component;
};

/** Why the processor does not support this one component (its arguments aside), or null. */
const getUnsupportedReason = (
  component: SelectorComponent,
  options: { allowNesting: boolean }
): string | null => {
  switch (component.type) {
    case "combinator":
      return ALLOWED_COMBINATORS.has(component.value) ? null : SELECTOR_REASONS.combinator;
    case "namespace":
      return SELECTOR_REASONS.namespace;
    case "attribute":
      return component.namespace ? SELECTOR_REASONS.namespace : null;
    case "nesting":
      return options.allowNesting ? null : SELECTOR_REASONS.nestingAtTopLevel;
    case "pseudo-class":
      return Object.hasOwn(UNSAFE_PSEUDO_CLASSES, component.kind)
        ? `${UNSAFE_PSEUDO_CLASSES[component.kind]} is not supported.`
        : null;
    case "pseudo-element":
      return Object.hasOwn(UNSAFE_PSEUDO_ELEMENTS, component.kind)
        ? `${UNSAFE_PSEUDO_ELEMENTS[component.kind]} is not supported.`
        : null;
    default:
      return null;
  }
};

/** The first construct the processor does not support, as a reason, or null. Recurses into arguments. */
export const findUnsupportedComponent = (
  selector: Selector,
  options: { allowNesting: boolean }
): string | null => {
  for (const component of selector) {
    const reason = getUnsupportedReason(component, options);
    if (reason) return reason;
    for (const argument of getCheckedArguments(component)) {
      const argumentReason = findUnsupportedComponent(argument, options);
      if (argumentReason) return argumentReason;
    }
  }
  return null;
};

/** Splits a selector into compounds and the combinators between them (`compounds.length - 1` of them). */
export const splitCompounds = (
  selector: Selector
): { compounds: SelectorComponent[][]; combinators: string[] } => {
  let current: SelectorComponent[] = [];
  const compounds: SelectorComponent[][] = [current];
  const combinators: string[] = [];
  for (const component of selector) {
    if (component.type === "combinator") {
      combinators.push(component.value);
      current = [];
      compounds.push(current);
    } else {
      current.push(component);
    }
  }
  return { compounds, combinators };
};

/** The compound a selector's subject is in: its last one. */
const getSubjectCompound = (selector: Selector): SelectorComponent[] =>
  splitCompounds(selector).compounds.at(-1) ?? [];

/**
 * Whether a compound reads the siblings of the element it matches through `:has(+ …)` / `:has(~ …)`,
 * directly or through arguments matched against that same element (`:not(:has(~ .x))`).
 */
const readsSiblingsThroughHas = (compound: SelectorComponent[]): boolean =>
  compound.some((component) => {
    if (component.type !== "pseudo-class") return false;
    if (component.kind === "has") {
      return getArgumentSelectors(component).some(
        (argument) =>
          hasImplicitScope(argument) &&
          argument[1].type === "combinator" &&
          SIBLING_COMBINATORS.has(argument[1].value)
      );
    }
    if (!SAME_ELEMENT_KINDS.has(component.kind)) return false;
    return getArgumentSelectors(component).some((argument) =>
      readsSiblingsThroughHas(getSubjectCompound(argument))
    );
  });

const joinCompounds = (compounds: SelectorComponent[][], combinators: string[]): Selector => {
  const selector: Selector = [];
  compounds.forEach((compound, index) => {
    if (index > 0) selector.push({ type: "combinator", value: combinators[index - 1] } as SelectorComponent);
    selector.push(...compound);
  });
  return selector;
};

/** Rewrites root aliases to `#fbjs`, in this component and inside its arguments. */
const rewriteRootAliases = (component: SelectorComponent): SelectorComponent => {
  if (isRootAlias(component)) return { ...ROOT_ID_COMPONENT };
  const args = getArgumentSelectors(component);
  if (args.length === 0 || component.type !== "pseudo-class" || component.kind === "host") return component;
  return withArgumentSelectors(
    component,
    args.map((argument) => argument.map(rewriteRootAliases))
  );
};

/**
 * Walks the combinators after the anchor. The subject leaves the root on the first descendant or child
 * step; a sibling step is only allowed once it has.
 */
const walkFromAnchor = (start: TSubjectPosition, combinators: string[]): TSubjectPosition | null => {
  let subject = start;
  for (const combinator of combinators) {
    if (SIBLING_COMBINATORS.has(combinator) && subject === "root") return null;
    subject = "inside";
  }
  return subject;
};

const buildAnchorCompound = (extras: SelectorComponent[], dark: boolean): SelectorComponent[] => {
  // A type selector has to lead its compound (`div#fbjs`, never `#fbjsdiv`).
  const typeSelectors = extras.filter((component) => component.type === "type");
  const others = extras.filter((component) => component.type !== "type");
  const needsDark = dark && !others.some(isDarkAttribute);
  return [
    ...typeSelectors,
    { ...ROOT_ID_COMPONENT },
    ...(needsDark ? [{ ...DARK_ATTRIBUTE_COMPONENT }] : []),
    ...others,
  ];
};

/** Scopes a top-level selector (one not nested in a style rule) to the survey root. */
export const scopeTopLevelSelector = (selector: Selector, dark: boolean): TSelectorOutcome => {
  const unsupported = findUnsupportedComponent(selector, { allowNesting: false });
  if (unsupported) return { ok: false, reason: unsupported };

  const { compounds, combinators } = splitCompounds(selector);
  if (compounds.some((compound) => compound.length === 0)) {
    return { ok: false, reason: SELECTOR_REASONS.malformed };
  }

  const anchorIndex = compounds.findIndex((compound) => compound.some(isRootAlias));
  if (anchorIndex > 0) return { ok: false, reason: SELECTOR_REASONS.outsideRoot };

  const isAnchored = anchorIndex === 0;
  const anchorExtras = isAnchored
    ? compounds[0].filter((component) => !isRootAlias(component) && component.type !== "universal")
    : [];
  const rest = isAnchored ? compounds.slice(1) : compounds;
  const restCombinators = isAnchored ? combinators : ["descendant", ...combinators];

  const subject = walkFromAnchor("root", restCombinators);
  if (!subject) return { ok: false, reason: SELECTOR_REASONS.siblingOfRoot };
  if (isAnchored && readsSiblingsThroughHas(compounds[0])) {
    return { ok: false, reason: SELECTOR_REASONS.siblingOfRoot };
  }

  const scoped = joinCompounds(
    [
      buildAnchorCompound(anchorExtras.map(rewriteRootAliases), dark),
      ...rest.map((compound) => compound.map(rewriteRootAliases)),
    ],
    restCombinators
  );
  return { ok: true, selector: scoped, subject };
};

/** Checks a selector nested in a style rule whose subject can be at `parentSubject`. */
export const scopeNestedSelector = (
  selector: Selector,
  parentSubject: TSubjectPosition
): TSelectorOutcome => {
  const unsupported = findUnsupportedComponent(selector, { allowNesting: true });
  if (unsupported) return { ok: false, reason: unsupported };

  const { compounds, combinators } = splitCompounds(selector);
  if (compounds.some((compound) => compound.length === 0)) {
    return { ok: false, reason: SELECTOR_REASONS.malformed };
  }

  // lightningcss makes an implicit parent explicit (`.b` → `& .b`), so a selector with no top-level `&`
  // only mentions it inside an argument — `:not(&)` — and would flatten to an unscoped selector.
  const nestingIndex = compounds.findIndex((compound) =>
    compound.some((component) => component.type === "nesting")
  );
  if (nestingIndex === -1) return { ok: false, reason: SELECTOR_REASONS.nestingRequired };
  if (nestingIndex > 0) return { ok: false, reason: SELECTOR_REASONS.outsideParent };

  const subject = walkFromAnchor(parentSubject, combinators);
  if (!subject) return { ok: false, reason: SELECTOR_REASONS.siblingOfRoot };
  if (parentSubject === "root" && readsSiblingsThroughHas(compounds[0])) {
    return { ok: false, reason: SELECTOR_REASONS.siblingOfRoot };
  }

  return { ok: true, selector: selector.map(rewriteRootAliases), subject };
};

/** `#fbjs` itself, with the dark attribute when the CSS is dark. */
const isCompiledRootAnchor = (compound: SelectorComponent[], dark: boolean): boolean =>
  compound.some((component) => component.type === "id" && component.name === SURVEY_ROOT_ID) &&
  (!dark || compound.some(isDarkAttribute));

/** An `:is()` whose every argument verifies anchors where its arguments do; anything else is null. */
const getMatchesAnyAnchor = (component: SelectorComponent, dark: boolean): TSubjectPosition | null => {
  if (component.type !== "pseudo-class" || !MATCHES_ANY_KINDS.has(component.kind)) return null;
  const args = getArgumentSelectors(component);
  const positions = args.map((argument) => verifyCompiledSelector(argument, dark));
  if (args.length === 0 || !positions.every((position) => position !== null)) return null;
  return positions.includes("root") ? "root" : "inside";
};

/** Where a compiled selector's first compound anchors it, or null when it is not anchored. */
const findCompiledAnchor = (first: SelectorComponent[], dark: boolean): TSubjectPosition | null => {
  if (isCompiledRootAnchor(first, dark)) return "root";
  for (const component of first) {
    const anchor = getMatchesAnyAnchor(component, dark);
    if (anchor) return anchor;
  }
  return null;
};

/**
 * Verifies a selector in the final, flattened output: anchored on `#fbjs` (with the dark attribute for
 * dark CSS) or on an `:is()` whose every argument is, with no sibling step off the root. Returns where
 * its subject can be, or null when the selector is not safely scoped.
 */
export const verifyCompiledSelector = (selector: Selector, dark: boolean): TSubjectPosition | null => {
  if (findUnsupportedComponent(selector, { allowNesting: false })) return null;
  const { compounds, combinators } = splitCompounds(selector);
  if (compounds.some((compound) => compound.length === 0)) return null;

  const first = compounds[0];
  const anchor = findCompiledAnchor(first, dark);
  if (!anchor) return null;
  if (anchor === "root" && readsSiblingsThroughHas(first)) return null;
  return walkFromAnchor(anchor, combinators);
};

const isQualifiedCompound = (compound: SelectorComponent[]): boolean =>
  compound.some((component) => {
    if (QUALIFYING_TYPES.has(component.type)) return true;
    if (component.type !== "pseudo-class" || !MATCHES_ANY_KINDS.has(component.kind)) return false;
    const args = getArgumentSelectors(component);
    return args.length > 0 && args.every((argument) => isQualifiedCompound(getSubjectCompound(argument)));
  });

export interface TSelectorMetrics {
  /** Compound selectors, including those inside pseudo-class arguments. */
  compounds: number;
  /** Compounds with no type, class, id or attribute (`*`, `:hover`), including inside arguments. */
  universals: number;
  /** The longest argument list inside the selector (`:is(a, b, c)` is 3). */
  longestArgumentList: number;
  /** All components, as a lower bound on the printed size. */
  components: number;
  /** `&` occurrences: each one prints the parent selector again when nesting is flattened. */
  nestingSelectors: number;
}

export const measureSelector = (selector: Selector): TSelectorMetrics => {
  const metrics: TSelectorMetrics = {
    compounds: 0,
    universals: 0,
    longestArgumentList: 0,
    components: selector.length,
    nestingSelectors: 0,
  };
  for (const compound of splitCompounds(selector).compounds) {
    if (compound.length === 0) continue;
    metrics.compounds++;
    if (!isQualifiedCompound(compound)) metrics.universals++;
    for (const component of compound) {
      if (component.type === "nesting") metrics.nestingSelectors++;
      // The implicit `:scope` of `:has(> .b)` is the element itself, not one more compound.
      const args = getCheckedArguments(component);
      metrics.longestArgumentList = Math.max(metrics.longestArgumentList, args.length);
      for (const argument of args) {
        const inner = measureSelector(argument);
        metrics.compounds += inner.compounds;
        metrics.universals += inner.universals;
        metrics.components += inner.components;
        metrics.nestingSelectors += inner.nestingSelectors;
        metrics.longestArgumentList = Math.max(metrics.longestArgumentList, inner.longestArgumentList);
      }
    }
  }
  return metrics;
};
