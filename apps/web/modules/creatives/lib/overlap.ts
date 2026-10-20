import type {
  BannerPlacementZodType,
  CreativeDisplayStatusZodType,
  FeedbackButtonPlacementZodType,
  ShowConditionGroupZodType,
  ShowConditionZodType,
} from "@formbricks/api-v3-schemas";
import {
  type TShowConditionsContext,
  evaluateShowConditions,
} from "@formbricks/types/show-conditions-evaluate";

/**
 * The list's overlap warning: which Active creatives could cover each other on the same page. It compares
 * their position fields and Show when, and renders nothing, so it is a cautious guess rather than a
 * measurement: it may warn about a pair that never meets, and should never miss one that does.
 */

export type TOverlapCreative = {
  id: string;
  displayStatus: CreativeDisplayStatusZodType;
  distribution: { conditions: ShowConditionGroupZodType | null };
} & (
  | {
      type: "feedbackButton";
      styling: {
        position: { desktop: FeedbackButtonPlacementZodType; phone: FeedbackButtonPlacementZodType | null };
      };
    }
  | {
      type: "banner";
      styling: { position: { desktop: BannerPlacementZodType; phone: BannerPlacementZodType | null } };
    }
);

/** How close, in percent of the page edge, two feedback buttons may sit before they could cover each other. */
export const BUTTON_OVERLAP_DISTANCE = 15;

// A button as its centre on the page's border, in percent: the left edge is x 0, the right edge x 100
// and the bottom edge y 100. The offset places the button's centre, side offsets from the top and bottom
// offsets from the left, so two buttons near the same corner end up close even when they sit on
// different edges.
const toBorderPoint = ({ edge, offset }: FeedbackButtonPlacementZodType): { x: number; y: number } => {
  if (edge === "bottom") return { x: offset, y: 100 };
  return { x: edge === "left" ? 0 : 100, y: offset };
};

const buttonsCollide = (a: FeedbackButtonPlacementZodType, b: FeedbackButtonPlacementZodType): boolean => {
  const pointA = toBorderPoint(a);
  const pointB = toBorderPoint(b);
  return (
    Math.abs(pointA.x - pointB.x) < BUTTON_OVERLAP_DISTANCE &&
    Math.abs(pointA.y - pointB.y) < BUTTON_OVERLAP_DISTANCE
  );
};

type TPlacement =
  | { type: "feedbackButton"; placement: FeedbackButtonPlacementZodType }
  | { type: "banner"; placement: BannerPlacementZodType };

// Phone values apply below 768 px whatever the device, so both creatives are compared at both widths.
const VIEWPORTS = ["desktop", "phone"] as const;

const getPlacement = (creative: TOverlapCreative, viewport: (typeof VIEWPORTS)[number]): TPlacement => {
  if (creative.type === "feedbackButton") {
    const { position } = creative.styling;
    return { type: "feedbackButton", placement: position[viewport] ?? position.desktop };
  }
  const { position } = creative.styling;
  return { type: "banner", placement: position[viewport] ?? position.desktop };
};

// Two In page banners stack in the page flow, so both stay visible; an Overlay covers whatever sits at
// its edge, another banner included. A button next to a banner is left out: the SDK keeps buttons
// clear of Overlay banners, and an In page banner scrolls away.
const placementsCollide = (a: TPlacement, b: TPlacement): boolean => {
  if (a.type === "feedbackButton" && b.type === "feedbackButton") {
    return buttonsCollide(a.placement, b.placement);
  }
  if (a.type === "banner" && b.type === "banner") {
    return (
      a.placement.placement === b.placement.placement &&
      (a.placement.layout === "overlay" || b.placement.layout === "overlay")
    );
  }
  return false;
};

// Show when, read cautiously: two creatives could meet on a page unless their conditions provably rule
// each other out. Only the device type and the page URL are reasoned about; any other condition (visit,
// referrer, browser, query parameter, window width) is assumed to hold.

type TCondition = ShowConditionZodType;
type TGroup = { connector: "and" | "or"; conditions: (TCondition | TGroup)[] };

/** Conditions that must all hold. A creative's Show when is one or more of these, any of which shows it. */
type TTerm = TCondition[];

// The conditions spelled out as alternatives. A set with more alternatives than this is treated as
// matching every page, which keeps the work bounded and only adds warnings.
const MAX_TERMS = 64;
const ANY_PAGE: TTerm[] = [[]];

const isGroup = (item: TCondition | TGroup): item is TGroup => "conditions" in item;

const toTerms = (group: TGroup): TTerm[] => {
  const children = group.conditions.map((item) => (isGroup(item) ? toTerms(item) : [[item]]));
  if (children.length === 0) return ANY_PAGE;

  if (group.connector === "or") {
    const terms = children.flat();
    return terms.length > MAX_TERMS ? ANY_PAGE : terms;
  }
  let product: TTerm[] = [[]];
  for (const child of children) {
    product = product.flatMap((left) => child.map((right) => [...left, ...right]));
    if (product.length > MAX_TERMS) return ANY_PAGE;
  }
  return product;
};

const DEVICE_TYPES = ["phone", "tablet", "desktop"];

const couldShareDeviceType = (term: TTerm): boolean => {
  let deviceTypes = DEVICE_TYPES;
  for (const condition of term) {
    if (condition.leftOperand.value !== "deviceType") continue;
    const value = String(condition.rightOperand?.value ?? "").toLowerCase();
    deviceTypes =
      condition.operator === "equals"
        ? deviceTypes.filter((type) => type === value)
        : deviceTypes.filter((type) => type !== value);
  }
  return deviceTypes.length > 0;
};

const NO_DEVICE: TShowConditionsContext["device"] = {
  deviceType: "desktop",
  browser: "other",
  screenWidth: 0,
};

/** The shared evaluator's answer for one page URL condition on a known URL. */
const urlPasses = (pageUrl: string, condition: TCondition): boolean =>
  evaluateShowConditions(
    { id: "url", connector: "and", conditions: [condition] },
    { url: pageUrl, pageReferrer: "", visit: null, device: NO_DEVICE }
  ).passed;

const getTexts = (condition: TCondition): string[] => {
  const value = condition.rightOperand?.value;
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.toLowerCase());
};

/** Text that every URL passing the condition holds, as alternatives: one of them is in it. */
const getRequiredTexts = (condition: TCondition): string[] => {
  const holdsText = ["startsWith", "endsWith", "contains", "containsAnyOf"].includes(condition.operator);
  return holdsText ? getTexts(condition) : [];
};

const getForbiddenTexts = (condition: TCondition): string[] =>
  condition.operator === "doesNotContain" || condition.operator === "containsNoneOf"
    ? getTexts(condition)
    : [];

// Whether `a`, read on its own terms, proves no URL passes both. `equals` pins the URL, so the shared
// evaluator answers for the other condition; two prefixes (or suffixes) exclude each other unless one
// extends the other; text a URL must hold excludes a condition that forbids part of it. Two `contains`
// never exclude each other: one URL can hold both fragments.
const rulesOut = (a: TCondition, b: TCondition): boolean => {
  const [textA] = getTexts(a);
  const [textB] = getTexts(b);
  if (a.operator === "equals" && textA !== undefined) return !urlPasses(textA, b);
  if (
    a.operator === "startsWith" &&
    b.operator === "startsWith" &&
    textA !== undefined &&
    textB !== undefined
  ) {
    return !textA.startsWith(textB) && !textB.startsWith(textA);
  }
  if (a.operator === "endsWith" && b.operator === "endsWith" && textA !== undefined && textB !== undefined) {
    return !textA.endsWith(textB) && !textB.endsWith(textA);
  }
  const required = getRequiredTexts(a);
  const forbidden = getForbiddenTexts(b);
  return (
    required.length > 0 &&
    forbidden.length > 0 &&
    required.every((text) => forbidden.some((fragment) => text.includes(fragment)))
  );
};

const couldShareUrl = (term: TTerm): boolean => {
  const urlConditions = term.filter((condition) => condition.leftOperand.value === "currentUrl");
  return !urlConditions.some((a, index) =>
    urlConditions.slice(index + 1).some((b) => rulesOut(a, b) || rulesOut(b, a))
  );
};

const couldHoldTogether = (term: TTerm): boolean => couldShareDeviceType(term) && couldShareUrl(term);

type TCandidate = { creative: TOverlapCreative; terms: TTerm[] };

const couldOverlap = (a: TCandidate, b: TCandidate): boolean =>
  VIEWPORTS.some((viewport) =>
    placementsCollide(getPlacement(a.creative, viewport), getPlacement(b.creative, viewport))
  ) && a.terms.some((termA) => b.terms.some((termB) => couldHoldTogether([...termA, ...termB])));

/**
 * For every Active creative that could overlap another, the ids of those others, in input order.
 * Creatives that overlap nothing are absent from the map.
 */
export const findCreativeOverlaps = (creatives: readonly TOverlapCreative[]): Map<string, string[]> => {
  const candidates: TCandidate[] = creatives
    .filter((creative) => creative.displayStatus === "active")
    .map((creative) => ({
      creative,
      terms: creative.distribution.conditions ? toTerms(creative.distribution.conditions) : ANY_PAGE,
    }));
  const overlaps = new Map<string, string[]>();
  const add = (id: string, otherId: string) => overlaps.set(id, [...(overlaps.get(id) ?? []), otherId]);

  candidates.forEach((candidate, index) => {
    candidates.slice(index + 1).forEach((other) => {
      if (!couldOverlap(candidate, other)) return;
      add(candidate.creative.id, other.creative.id);
      add(other.creative.id, candidate.creative.id);
    });
  });
  return overlaps;
};
