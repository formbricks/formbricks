import type { Element, Node } from "@xmldom/xmldom";

/**
 * The numbers and bullets Word's lists give paragraphs (ENG-6853), from `numbering.xml`: what a reader
 * sees in front of the text — "1.", "Q5", "2.a)", "•" — which the file itself does not hold. Routing
 * in a questionnaire names questions by them ("If No, skip to Q5"), so the reader puts each paragraph's
 * label in its text.
 *
 * Counted the way Word counts: one counter per level of an abstract numbering, shared by the lists that
 * use it, so a list continues across the paragraphs between its items; a list instance with a start
 * override starts again; numbering a level restarts the levels below it. The formats a questionnaire
 * uses are spelled out (decimal, letters, roman numerals, ordinals, bullets); any other is written as a
 * decimal.
 */

const ELEMENT_NODE = 1;
const MAX_LEVELS = 9;

interface TLevel {
  start: number;
  format: string;
  text: string;
  /** "Legal" numbering writes every level's number as a decimal. */
  isLegal: boolean;
}

interface TListInstance {
  abstractId: string;
  /** Per level: a start override, and a level definition replacing the abstract one. */
  overrides: Map<number, { start: number | null; level: TLevel | null }>;
}

function* elements(node: Node): Generator<Element> {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === ELEMENT_NODE) yield child as Element;
  }
}

const child = (node: Element, localName: string): Element | null => {
  for (const candidate of elements(node)) if (candidate.localName === localName) return candidate;
  return null;
};

const attr = (node: Element | null, localName: string): string | null => {
  const namespace = node?.namespaceURI;
  return node && namespace && node.hasAttributeNS(namespace, localName)
    ? node.getAttributeNS(namespace, localName)
    : null;
};

const integer = (value: string | null): number | null => {
  const number = value === null ? Number.NaN : Number(value);
  return Number.isSafeInteger(number) ? number : null;
};

const readLevel = (level: Element): TLevel => {
  const isLegal = child(level, "isLgl");
  return {
    start: integer(attr(child(level, "start"), "val")) ?? 0,
    format: attr(child(level, "numFmt"), "val") ?? "decimal",
    text: attr(child(level, "lvlText"), "val") ?? "",
    isLegal: isLegal !== null && !["0", "false", "off"].includes(attr(isLegal, "val") ?? "true"),
  };
};

const readLevels = (node: Element): Map<number, TLevel> => {
  const levels = new Map<number, TLevel>();
  for (const level of elements(node)) {
    const ilvl = integer(attr(level, "ilvl"));
    if (level.localName === "lvl" && ilvl !== null && ilvl >= 0 && ilvl < MAX_LEVELS) {
      levels.set(ilvl, readLevel(level));
    }
  }
  return levels;
};

const ROMAN: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

const roman = (value: number): string => {
  let rest = value;
  let text = "";
  for (const [step, numeral] of ROMAN) {
    while (rest >= step) {
      text += numeral;
      rest -= step;
    }
  }
  return text;
};

/** Word's letters: a … z, then aa … zz, then aaa. */
const letters = (value: number): string => {
  const index = (value - 1) % 26;
  return String.fromCodePoint(97 + index).repeat(Math.floor((value - 1) / 26) + 1);
};

const ordinal = (value: number): string => {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
};

const formatNumber = (value: number, format: string): string => {
  // Letters and numerals have no zero or negatives; Word writes those as decimals too.
  if (value < 1) return String(value);
  switch (format) {
    case "decimalZero":
      return String(value).padStart(2, "0");
    case "lowerRoman":
      return roman(value);
    case "upperRoman":
      return roman(value).toUpperCase();
    case "lowerLetter":
      return letters(value);
    case "upperLetter":
      return letters(value).toUpperCase();
    case "ordinal":
      return ordinal(value);
    case "none":
      return "";
    default:
      return String(value);
  }
};

export class WordNumbering {
  private readonly abstracts = new Map<string, Map<number, TLevel>>();
  private readonly instances = new Map<string, TListInstance>();
  /** Per abstract numbering, the current number at each level (`undefined` before its first item). */
  private readonly counters = new Map<string, (number | undefined)[]>();
  /** The list instances whose start overrides have been applied. */
  private readonly started = new Set<string>();

  constructor(root: Element | null) {
    if (!root) return;
    for (const node of elements(root)) {
      if (node.localName === "abstractNum") {
        const id = attr(node, "abstractNumId");
        if (id !== null) this.abstracts.set(id, readLevels(node));
      } else if (node.localName === "num") {
        const id = attr(node, "numId");
        const abstractId = attr(child(node, "abstractNumId"), "val");
        if (id === null || abstractId === null) continue;
        const overrides: TListInstance["overrides"] = new Map();
        for (const override of elements(node)) {
          const ilvl = integer(attr(override, "ilvl"));
          if (override.localName !== "lvlOverride" || ilvl === null || ilvl < 0 || ilvl >= MAX_LEVELS)
            continue;
          const level = child(override, "lvl");
          overrides.set(ilvl, {
            start: integer(attr(child(override, "startOverride"), "val")),
            level: level ? readLevel(level) : null,
          });
        }
        this.instances.set(id, { abstractId, overrides });
      }
    }
  }

  /**
   * The label of the next item of list `numId` at level `ilvl`, counting it: `1.`, `Q5`, `•`, or `""`
   * for a list that does not exist (`numId` 0 turns numbering off) or shows no label.
   */
  label(numId: string, ilvl: number): string {
    const instance = this.instances.get(numId);
    const abstract = instance ? this.abstracts.get(instance.abstractId) : undefined;
    if (!instance || !abstract || ilvl < 0 || ilvl >= MAX_LEVELS) return "";
    const levelAt = (index: number): TLevel | undefined =>
      instance.overrides.get(index)?.level ?? abstract.get(index);
    const level = levelAt(ilvl);
    if (!level) return "";

    const counters = this.counters.get(instance.abstractId) ?? new Array<number | undefined>(MAX_LEVELS);
    this.counters.set(instance.abstractId, counters);
    if (!this.started.has(numId)) {
      this.started.add(numId);
      for (const [index, override] of instance.overrides) {
        if (override.start !== null) counters[index] = override.start - 1;
      }
    }
    counters[ilvl] = (counters[ilvl] ?? level.start - 1) + 1;
    for (let deeper = ilvl + 1; deeper < MAX_LEVELS; deeper += 1) counters[deeper] = undefined;

    if (level.format === "bullet") return "•";
    return level.text.replaceAll(/%([1-9])/g, (_match, digit: string) => {
      const index = Number(digit) - 1;
      const shown = levelAt(index);
      if (!shown) return "";
      return formatNumber(counters[index] ?? shown.start, level.isLegal ? "decimal" : shown.format);
    });
  }
}
