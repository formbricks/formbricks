import type { TBaseStyling, TStylingColor } from "./styling";

/**
 * Grammars for the free-text theme values that are written into generated CSS (ENG-2950): the survey
 * renderer's `#fbjs { --fb-…: <value> }` block, the email preview's styles and inline styles rendered on
 * the server. A value must be a valid value for its property and nothing more — no `;`, braces, quotes
 * outside a font name, comments, backslashes, `<`, `!important` or functions outside a small allowlist
 * (so no `url()`), which is what would let a value add declarations or rules.
 *
 * Applied on write by the styling schemas (styling.ts) and defensively at render time by
 * `sanitizeThemeStyling`, which drops an unsafe legacy value so the normal fallback applies.
 */

const MAX_VALUE_LENGTH = 300;

type TToken =
  | { kind: "number"; value: number; unit: string }
  | { kind: "ident"; value: string }
  | { kind: "hash"; value: string }
  | { kind: "string"; value: string }
  | { kind: "function"; name: string; args: TToken[] }
  | { kind: "delim"; value: "," | "/" | "+" | "-" | "*" }
  | { kind: "space" };

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;
const STARTS_NUMBER = /^[+-]?\.?\d/;
const IDENT = /^-{0,2}[a-z_\u00a0-\uffff][\w\u00a0-\uffff-]*/i;
const HASH = /^#[\da-f]+/i;
const UNIT = /^(?:%|[a-z]+)/i;
/** Inside quotes only letters, digits, spaces and a little punctuation: never a quote, `\`, `<` or `;`. */
const STRING_CONTENT = /^[\p{L}\p{N} .,_&+-]*$/u;
const MAX_FUNCTION_DEPTH = 8;

/** The tokens without leading and trailing spaces. */
const trimSpaces = (tokens: TToken[]): TToken[] => {
  let start = 0;
  let end = tokens.length;
  while (start < end && tokens[start].kind === "space") start++;
  while (end > start && tokens[end - 1].kind === "space") end--;
  return tokens.slice(start, end);
};

/**
 * Tokenizes a theme value into a tree (functions hold their argument tokens). Returns null for anything
 * outside this small token set — which is the point: a value that needs any other character cannot be a
 * plain size, weight, color, shadow or font list.
 */
const tokenize = (input: string): TToken[] | null => {
  if (input.length === 0 || input.length > MAX_VALUE_LENGTH) return null;
  let rest = input;

  const take = (length: number): string => {
    const taken = rest.slice(0, length);
    rest = rest.slice(length);
    return taken;
  };

  /** A quoted string; null when it is unclosed or holds anything outside `STRING_CONTENT`. */
  const readString = (quote: string): TToken | null => {
    const end = rest.indexOf(quote, 1);
    const value = end === -1 ? null : rest.slice(1, end);
    if (value === null || !STRING_CONTENT.test(value)) return null;
    take(end + 1);
    return { kind: "string", value };
  };

  const readNumber = (): TToken => {
    const value = Number(take(NUMBER.exec(rest)![0].length));
    const unit = take(UNIT.exec(rest)?.[0].length ?? 0).toLowerCase();
    return { kind: "number", value, unit };
  };

  const readHash = (): TToken | null => {
    const hash = HASH.exec(rest);
    return hash ? { kind: "hash", value: take(hash[0].length).slice(1) } : null;
  };

  /** An identifier, or a function with its parsed arguments when `(` follows the name. */
  const readIdentOrFunction = (name: string, depth: number): TToken | null => {
    if (!rest.startsWith("(")) return { kind: "ident", value: name };
    if (depth >= MAX_FUNCTION_DEPTH) return null;
    take(1);
    const args = parse(depth + 1);
    return args ? { kind: "function", name: name.toLowerCase(), args } : null;
  };

  /** The token at the start of `rest`, or null when nothing valid starts there. */
  const readToken = (depth: number): TToken | null => {
    const char = rest[0];
    if (char === " " || char === "\t") {
      rest = rest.trimStart();
      return { kind: "space" };
    }
    if (char === '"' || char === "'") return readString(char);
    if (STARTS_NUMBER.test(rest)) return readNumber();
    if (char === "#") return readHash();
    const ident = IDENT.exec(rest);
    if (ident) return readIdentOrFunction(take(ident[0].length), depth);
    if (char === "," || char === "/" || char === "*" || char === "+" || char === "-") {
      return { kind: "delim", value: take(1) as "," | "/" | "*" | "+" | "-" };
    }
    return null;
  };

  const parse = (depth: number): TToken[] | null => {
    const tokens: TToken[] = [];
    while (rest.length > 0) {
      if (rest.startsWith(")")) {
        if (depth === 0) return null;
        take(1);
        return tokens;
      }
      const token = readToken(depth);
      if (!token) return null;
      tokens.push(token);
    }
    // Running out of input inside a function means an unclosed parenthesis.
    return depth === 0 ? tokens : null;
  };

  const tokens = parse(0);
  return tokens ? trimSpaces(tokens) : null;
};

/** Splits on top-level commas; empty items (leading, trailing or doubled commas) make the list invalid. */
const splitList = (tokens: TToken[]): TToken[][] | null => {
  let current: TToken[] = [];
  const items: TToken[][] = [current];
  for (const token of tokens) {
    if (token.kind === "delim" && token.value === ",") {
      current = [];
      items.push(current);
    } else {
      current.push(token);
    }
  }
  const trimmed = items.map((item) =>
    item.filter((token, index, all) => !(token.kind === "space" && (index === 0 || index === all.length - 1)))
  );
  return trimmed.some((item) => item.length === 0) ? null : trimmed;
};

/** Space-separated components of one list item; adjacent tokens without a space are invalid. */
const components = (item: TToken[]): TToken[] | null => {
  const result: TToken[] = [];
  let expectSpace = false;
  for (const token of item) {
    if (token.kind === "space") {
      expectSpace = false;
      continue;
    }
    if (expectSpace) return null;
    result.push(token);
    expectSpace = true;
  }
  return result;
};

const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);
const LENGTH_UNITS = new Set([
  "px",
  "rem",
  "em",
  "%",
  "vh",
  "vw",
  "vmin",
  "vmax",
  "ch",
  "ex",
  "pt",
  "pc",
  "cm",
  "mm",
  "in",
  "q",
  "lh",
  "rlh",
  "svh",
  "lvh",
  "dvh",
  "svw",
  "lvw",
  "dvw",
  "vi",
  "vb",
  "cqw",
  "cqh",
  "cqi",
  "cqb",
  "cqmin",
  "cqmax",
]);
const DIMENSION_KEYWORDS = new Set(["auto", "none", "normal", "fit-content", "min-content", "max-content"]);
const MATH_FUNCTIONS = new Set(["calc", "min", "max", "clamp"]);
const COLOR_FUNCTIONS = new Set([
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
]);
const ANGLE_UNITS = new Set(["deg", "grad", "rad", "turn"]);
const FONT_WEIGHT_KEYWORDS = new Set(["normal", "bold", "bolder", "lighter"]);
/** CSS named colors (CSS Color 4), plus `transparent` and `currentcolor`. */
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown " +
    "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
    "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid " +
    "darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro " +
    "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow " +
    "lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine " +
    "mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise " +
    "mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab " +
    "orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru " +
    "pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan " +
    "teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor"
  ).split(" ")
);

const isCustomPropertyName = (token: TToken | undefined): boolean =>
  token?.kind === "ident" && token.value.startsWith("--") && token.value.length > 2;

/** `var(--name)` or `var(--name, <fallback>)`, the fallback checked by `isFallbackValid`. */
const isVarFunction = (token: TToken, isFallbackValid: (tokens: TToken[]) => boolean): boolean => {
  if (token.kind !== "function" || token.name !== "var") return false;
  const items = splitList(token.args);
  if (!items || items.length > 2) return false;
  const [name, ...fallback] = items.map((item) => item.filter((arg) => arg.kind !== "space"));
  if (name.length !== 1 || !isCustomPropertyName(name[0])) return false;
  return fallback.length === 0 || isFallbackValid(fallback[0]);
};

/** Arguments of a math function: numbers, lengths, operators, commas and nested math or `var()`. */
const isMathArgument = (tokens: TToken[]): boolean =>
  tokens.every(
    (token) =>
      token.kind === "space" ||
      token.kind === "delim" ||
      (token.kind === "number" && (token.unit === "" || LENGTH_UNITS.has(token.unit))) ||
      (token.kind === "function" && MATH_FUNCTIONS.has(token.name) && isMathArgument(token.args)) ||
      isVarFunction(token, isMathArgument)
  );

const isLengthComponent = (token: TToken): boolean => {
  if (token.kind === "number") return token.unit === "" || LENGTH_UNITS.has(token.unit);
  if (token.kind === "function" && MATH_FUNCTIONS.has(token.name)) return isMathArgument(token.args);
  return isVarFunction(token, (fallback) =>
    fallback.every((part) => part.kind === "space" || isLengthComponent(part))
  );
};

const isColorComponent = (token: TToken): boolean => {
  if (token.kind === "hash") return [3, 4, 6, 8].includes(token.value.length);
  if (token.kind === "ident") return NAMED_COLORS.has(token.value.toLowerCase());
  if (token.kind === "function" && COLOR_FUNCTIONS.has(token.name)) {
    return token.args.every(
      (arg) =>
        arg.kind === "space" ||
        arg.kind === "delim" ||
        (arg.kind === "number" && (arg.unit === "" || arg.unit === "%" || ANGLE_UNITS.has(arg.unit))) ||
        (arg.kind === "ident" && /^[a-z-]+$/i.test(arg.value)) ||
        isColorComponent(arg) ||
        (arg.kind === "function" && MATH_FUNCTIONS.has(arg.name) && isMathArgument(arg.args)) ||
        isVarFunction(arg, (fallback) =>
          fallback.every((part) => part.kind === "space" || isColorComponent(part))
        )
    );
  }
  return isVarFunction(token, (fallback) =>
    fallback.every((part) => part.kind === "space" || isColorComponent(part))
  );
};

const asTokens = (value: unknown): TToken[] | null =>
  typeof value === "string" ? tokenize(value.trim()) : null;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A size, padding, radius or height: a number (px), a numeric string, or 1–4 lengths / keywords. */
export const isSafeThemeDimension = (value: unknown): boolean => {
  if (isFiniteNumber(value)) return true;
  const tokens = asTokens(value);
  if (!tokens || tokens.length === 0) return false;
  const parts = components(tokens);
  if (!parts || parts.length > 4) return false;
  if (parts.length === 1 && parts[0].kind === "ident") {
    const keyword = parts[0].value.toLowerCase();
    return DIMENSION_KEYWORDS.has(keyword) || CSS_WIDE_KEYWORDS.has(keyword);
  }
  return parts.every(isLengthComponent);
};

/** A font weight: 1–1000 (number or numeric string) or a weight keyword. */
export const isSafeThemeFontWeight = (value: unknown): boolean => {
  if (isFiniteNumber(value)) return value >= 1 && value <= 1000;
  const tokens = asTokens(value);
  if (tokens?.length !== 1) return false;
  const [token] = tokens;
  if (token.kind === "number") return token.unit === "" && token.value >= 1 && token.value <= 1000;
  if (token.kind === "ident") {
    const keyword = token.value.toLowerCase();
    return FONT_WEIGHT_KEYWORDS.has(keyword) || CSS_WIDE_KEYWORDS.has(keyword);
  }
  return isVarFunction(token, (fallback) => fallback.length === 1 && fallback[0].kind === "number");
};

/** A color: hex, a named color, `transparent`/`currentcolor`, or a color function with plain arguments. */
export const isSafeThemeColor = (value: unknown): boolean => {
  const tokens = asTokens(value);
  return tokens?.length === 1 && isColorComponent(tokens[0]);
};

/** A box-shadow: `none`, or up to 8 comma-separated shadows of `inset`?, 2–4 lengths and a color?. */
export const isSafeThemeBoxShadow = (value: unknown): boolean => {
  const tokens = asTokens(value);
  if (!tokens || tokens.length === 0) return false;
  if (tokens.length === 1 && tokens[0].kind === "ident") {
    const keyword = tokens[0].value.toLowerCase();
    return keyword === "none" || CSS_WIDE_KEYWORDS.has(keyword);
  }
  const shadows = splitList(tokens);
  if (!shadows || shadows.length > 8) return false;
  return shadows.every((shadow) => {
    const parts = components(shadow);
    if (!parts) return false;
    let insets = 0;
    let lengths = 0;
    let colors = 0;
    let variables = 0;
    for (const part of parts) {
      if (part.kind === "ident" && part.value.toLowerCase() === "inset") insets++;
      else if (part.kind === "function" && part.name === "var" && isLengthComponent(part)) variables++;
      else if (isLengthComponent(part)) lengths++;
      else if (isColorComponent(part)) colors++;
      else return false;
    }
    // A var() can stand for a length or a color, so it only loosens the counts.
    return insets <= 1 && colors <= 1 && lengths <= 4 && lengths + variables >= 2;
  });
};

/** A font family list: up to 16 comma-separated quoted names, unquoted names or generic families. */
export const isSafeThemeFontFamily = (value: unknown): boolean => {
  const tokens = asTokens(value);
  if (!tokens || tokens.length === 0) return false;
  const families = splitList(tokens);
  if (!families || families.length > 16) return false;
  return families.every((family) => {
    const parts = components(family);
    if (!parts || parts.length === 0) return false;
    if (parts.length === 1 && parts[0].kind === "string") return parts[0].value.trim().length > 0;
    // Unquoted: one or more identifiers (`Open Sans`, `sans-serif`), never a custom property.
    return parts.every((part) => part.kind === "ident" && !part.value.startsWith("--"));
  });
};

/** Styling fields that hold a size, padding, radius or height. */
export const THEME_DIMENSION_FIELDS = [
  "roundness",
  "buttonBorderRadius",
  "buttonHeight",
  "buttonFontSize",
  "buttonPaddingX",
  "buttonPaddingY",
  "inputBorderRadius",
  "inputHeight",
  "inputFontSize",
  "inputPaddingX",
  "inputPaddingY",
  "optionBorderRadius",
  "optionPaddingX",
  "optionPaddingY",
  "optionFontSize",
  "elementHeadlineFontSize",
  "elementDescriptionFontSize",
  "elementUpperLabelFontSize",
  "progressTrackHeight",
] as const satisfies readonly (keyof TBaseStyling)[];

export const THEME_FONT_WEIGHT_FIELDS = [
  "buttonFontWeight",
  "elementHeadlineFontWeight",
  "elementDescriptionFontWeight",
  "elementUpperLabelFontWeight",
] as const satisfies readonly (keyof TBaseStyling)[];

export const THEME_COLOR_FIELDS = [
  "brandColor",
  "accentBgColor",
  "accentBgColorSelected",
  "footerLinkColor",
  "buttonBgColor",
  "buttonTextColor",
  "inputBgColor",
  "inputBorderColor",
  "inputTextColor",
  "optionBgColor",
  "optionLabelColor",
  "optionBorderColor",
  "elementHeadlineColor",
  "elementDescriptionColor",
  "elementUpperLabelColor",
  "progressTrackBgColor",
  "progressIndicatorBgColor",
  "cardBackgroundColor",
  "cardBorderColor",
  "highlightBorderColor",
] as const satisfies readonly (keyof TBaseStyling)[];

type TThemeStylingInput = Partial<Record<keyof TBaseStyling, unknown>>;

const sanitizeColor = (color: unknown): TStylingColor | null | undefined => {
  if (color === null || color === undefined) return color;
  const { light, dark } = color as Partial<TStylingColor>;
  if (!isSafeThemeColor(light)) return undefined;
  if (dark === null || dark === undefined || isSafeThemeColor(dark)) return color as TStylingColor;
  return { ...(color as TStylingColor), dark: null };
};

/**
 * A copy of a styling object without the values that are unsafe to write into CSS, for code that renders
 * stored (possibly legacy) styling. An unsafe value becomes `undefined`, so the renderer falls back to its
 * default exactly as if the field were unset; an unsafe dark color becomes `null` (derived). Valid values
 * are passed through untouched, so the CSS generated from valid styling does not change.
 */
export const sanitizeThemeStyling = <T extends TThemeStylingInput>(styling: T): T => {
  const result: Record<string, unknown> = { ...styling };
  const dropUnless = (field: string, isSafe: (value: unknown) => boolean) => {
    const value = result[field];
    if (value !== null && value !== undefined && !isSafe(value)) result[field] = undefined;
  };

  for (const field of THEME_DIMENSION_FIELDS) dropUnless(field, isSafeThemeDimension);
  for (const field of THEME_FONT_WEIGHT_FIELDS) dropUnless(field, isSafeThemeFontWeight);
  for (const field of THEME_COLOR_FIELDS) {
    if (field in result) result[field] = sanitizeColor(result[field]);
  }
  dropUnless("inputShadow", isSafeThemeBoxShadow);
  dropUnless("fontFamily", isSafeThemeFontFamily);
  dropUnless("inputPlaceholderOpacity", (value) => isFiniteNumber(value) && value >= 0 && value <= 1);

  const logo = result.logo as { bgColor?: unknown } | null | undefined;
  if (logo?.bgColor !== undefined && !isSafeThemeColor(logo.bgColor)) {
    result.logo = { ...logo, bgColor: undefined };
  }
  const background = result.background as { bg?: unknown; bgType?: unknown } | null | undefined;
  if (background && !isSafeThemeBackground(background)) {
    result.background = { ...background, bg: undefined };
  }
  return result as T;
};

/**
 * A solid background (`bgType: "color"`) is written into a style attribute, so it must be a color. Image,
 * upload and animation backgrounds are URLs used as media sources, never as CSS.
 */
export const isSafeThemeBackground = (background: { bg?: unknown; bgType?: unknown }): boolean => {
  const { bg, bgType } = background;
  if (bgType !== "color" || bg === null || bg === undefined || bg === "") return true;
  return isSafeThemeColor(bg);
};
