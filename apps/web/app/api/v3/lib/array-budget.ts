import type { InvalidParam } from "./response";

/**
 * Longest array a v3 request may carry, at any depth. The same ceiling as `V3_SURVEY_BLOCK_ORDER_MAX`
 * — a valid block order lists every block, so nothing legitimate is longer than the largest survey.
 */
export const V3_REQUEST_ARRAY_MAX_ITEMS = 1000;

/**
 * Array elements a whole request may carry, summed over every array in it. A per-array cap alone
 * still lets 1,000 arrays of 1,000 junk entries through — a million elements inside the 2 MB body
 * limit — and Zod would report each one. The largest real survey document is a few thousand.
 */
export const V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS = 50_000;

/**
 * Deepest nesting a v3 request may carry, counted in containers from the root. The walk holds a little
 * state for every open level, so depth is what bounds it: without a cap, a 15 MB body nested one level
 * per few bytes keeps millions of levels open at once (ENG-3653). The cap sits well clear of the deepest
 * structure the API bounds itself: a segment-filter tree at `MAX_SEGMENT_FILTER_DEPTH` in a survey's
 * `targeting.filters` nests about 105 levels, 109 inside an MCP batch. Keep it above that — the test
 * that walks such a tree fails first. Logic and workflow condition groups and free-form `metadata` have
 * no bound of their own, so this is theirs: a survey logic tree about 125 groups deep reaches it.
 */
export const V3_REQUEST_MAX_DEPTH = 256;

/**
 * How much of the offending array's path a violation reports. The path is caller-shaped too: a 120 KB
 * body of 60k nested arrays would otherwise put a 100 KB `name` into the 400, twice into the MCP error,
 * and once more into the warn log.
 */
const MAX_REPORTED_PATH_SEGMENTS = 10;
const MAX_REPORTED_SEGMENT_CHARS = 64;

export type TArrayBudgetViolation =
  | { kind: "array_too_long"; path: string; length: number }
  | { kind: "too_many_elements"; path: string; total: number }
  | { kind: "too_deep"; path: string };

/** One step of the walk's path, shared by reference so a deep body costs one node per level. */
type TPathNode = { segment: string; parent: TPathNode | null };

/**
 * A container being walked, with a cursor into its children. Objects keep their key list; arrays are
 * walked by index. Children are visited one at a time rather than expanded up front, so a frame exists
 * only for a container, and a primitive child — most of any body — costs nothing beyond the read.
 */
type TContainerFrame = {
  container: Record<string, unknown> | unknown[];
  keys: string[] | null;
  next: number;
  path: TPathNode | null;
  /** Containers from the root to this one, itself included. */
  depth: number;
};

const isContainer = (value: unknown): value is Record<string, unknown> | unknown[] =>
  typeof value === "object" && value !== null;

function checkArray(array: unknown[], path: TPathNode | null, total: number): TArrayBudgetViolation | null {
  if (array.length > V3_REQUEST_ARRAY_MAX_ITEMS) {
    return { kind: "array_too_long", path: renderPath(path), length: array.length };
  }
  if (total > V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS) {
    return { kind: "too_many_elements", path: renderPath(path), total };
  }
  return null;
}

// A frame's children, read the same way whether it walks an array (by index) or an object (by key).
const childCount = (frame: TContainerFrame): number =>
  frame.keys === null ? (frame.container as unknown[]).length : frame.keys.length;

const segmentAt = (frame: TContainerFrame, index: number): string =>
  frame.keys === null ? String(index) : frame.keys[index];

const childAt = (frame: TContainerFrame, index: number, segment: string): unknown =>
  frame.keys === null
    ? (frame.container as unknown[])[index]
    : (frame.container as Record<string, unknown>)[segment];

/**
 * Checks a parsed JSON value against the budgets above — every array's length, the elements across all
 * arrays, and the nesting depth — before any schema sees it.
 *
 * Zod parses every element of an array before an array-level `.max()` runs, so an oversized array
 * costs one issue per element — ~500 MB of transient heap and a multi-megabyte 400 for a 200k-entry
 * array, reachable by any authenticated caller ahead of workspace authorization (ENG-3384). Field-level
 * bounds (`lengthBoundedArray`) cover the arrays a schema declares; this walk covers the ones it does
 * not — nested payloads typed as `unknown` or `z.record`, and every route that never opted in.
 *
 * Iterative on purpose: the input is caller-shaped, and a recursive walk over a deeply nested body
 * would overflow the stack before the budget was ever checked. And lazy, for the same reason: expanding
 * every container's children into frames up front cost ~220 MB of heap and a second of event-loop time
 * on a 15 MB object with a million keys (ENG-3653, whose route takes bodies that large). The depth cap
 * bounds what stays open: at most `V3_REQUEST_MAX_DEPTH` frames and path nodes, whatever the shape.
 * Containers are checked in document order, when the walk first reaches them.
 *
 * Paths use the dotted form `invalid_params` already uses (`blocks.3.elements`), cut to the first
 * `MAX_REPORTED_PATH_SEGMENTS`; an empty path means the root value itself.
 */
export function findArrayBudgetViolation(value: unknown): TArrayBudgetViolation | null {
  if (!isContainer(value)) {
    return null;
  }

  let total = 0;

  /** A frame for `container`, checking it first when it is an array. */
  const enter = (
    container: Record<string, unknown> | unknown[],
    path: TPathNode | null,
    depth: number
  ): { frame: TContainerFrame; violation: TArrayBudgetViolation | null } => {
    if (depth > V3_REQUEST_MAX_DEPTH) {
      return {
        frame: { container, keys: [], next: 0, path, depth },
        violation: { kind: "too_deep", path: renderPath(path) },
      };
    }

    if (!Array.isArray(container)) {
      return { frame: { container, keys: Object.keys(container), next: 0, path, depth }, violation: null };
    }

    total += container.length;
    return {
      frame: { container, keys: null, next: 0, path, depth },
      violation: checkArray(container, path, total),
    };
  };

  const root = enter(value, null, 1);
  if (root.violation) {
    return root.violation;
  }

  const stack: TContainerFrame[] = [root.frame];

  for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
    if (frame.next >= childCount(frame)) {
      stack.pop();
      continue;
    }

    const index = frame.next;
    frame.next += 1;
    const segment = segmentAt(frame, index);
    const child = childAt(frame, index, segment);
    // Done with this container once its last child is taken, so nesting holds one frame per open
    // sibling list rather than one per level: a 15 MB `{"a":{"a":…}}` is millions of levels deep.
    if (frame.next >= childCount(frame)) {
      stack.pop();
    }

    if (isContainer(child)) {
      const entered = enter(child, { segment, parent: frame.path }, frame.depth + 1);
      if (entered.violation) {
        return entered.violation;
      }
      stack.push(entered.frame);
    }
  }

  return null;
}

/** The path root-first, at most `MAX_REPORTED_PATH_SEGMENTS` of them and each segment clipped. */
function renderPath(node: TPathNode | null): string {
  const segments: string[] = [];
  for (let cursor = node; cursor !== null; cursor = cursor.parent) {
    segments.push(cursor.segment);
  }
  segments.reverse();

  return renderSegments(segments);
}

function renderSegments(segments: string[]): string {
  const shown = segments
    .slice(0, MAX_REPORTED_PATH_SEGMENTS)
    .map((segment) =>
      segment.length > MAX_REPORTED_SEGMENT_CHARS
        ? `${segment.slice(0, MAX_REPORTED_SEGMENT_CHARS)}…`
        : segment
    );
  if (segments.length > shown.length) {
    shown.push("…");
  }

  return shown.join(".");
}

const QUOTE = 34;
const BACKSLASH = 92;
const COMMA = 44;
const COLON = 58;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;
const OPEN_BRACE = 123;
const CLOSE_BRACE = 125;

const isWhitespace = (code: number): boolean => code === 32 || code === 10 || code === 13 || code === 9;

const endsToken = (code: number): boolean =>
  code === COMMA || code === CLOSE_BRACKET || code === CLOSE_BRACE || isWhitespace(code);

/** An open container while scanning text: arrays count their elements, objects remember their key. */
type TRawFrame = {
  isArray: boolean;
  /** Elements counted so far, so an array's current element is `count - 1`. */
  count: number;
  /** The current key of an object, as offsets of the text between its quotes. */
  keyStart: number;
  keyEnd: number;
  /** After `[`, `{` or `,`: the next token is an element (array) or a key (object). */
  expectingEntry: boolean;
};

/** The quote that closes the string opening at `start`, or -1: one not preceded by an odd run of `\`. */
function closingQuote(text: string, start: number): number {
  for (let end = text.indexOf('"', start + 1); end !== -1; end = text.indexOf('"', end + 1)) {
    let backslashes = 0;
    for (let cursor = end - 1; text.charCodeAt(cursor) === BACKSLASH; cursor -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) {
      return end;
    }
  }
  return -1;
}

/** A key as `JSON.parse` would read it; only decoded when a violation names it. */
function decodeKey(text: string, frame: TRawFrame): string {
  const raw = text.slice(frame.keyStart, frame.keyEnd);
  if (!raw.includes("\\")) {
    return raw;
  }
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

/** The path to the current child of the last frame in `frames`, rendered like the walk's. */
const rawPath = (text: string, frames: TRawFrame[]): string =>
  renderSegments(frames.map((frame) => (frame.isArray ? String(frame.count - 1) : decodeKey(text, frame))));

/**
 * The same budgets as `findArrayBudgetViolation`, read off the raw body before `JSON.parse` builds it.
 * Parsing is what a hostile body costs: 15.5 MiB of `[[[…]]]` is ~470 MB of arrays once parsed, and an
 * array of `{}` ~320 MB, so a check after the parse comes too late for a route that takes bodies that
 * large (ENG-3653). One forward pass that skips strings and decodes a key only when a violation names
 * it, so a body within budget costs the scan and nothing else.
 *
 * Text that is not valid JSON gets `null` and is left to `JSON.parse`, unless a limit is crossed before
 * the text breaks. A key that repeats counts every time, though `JSON.parse` keeps only the last. Where
 * a body breaks several limits, this names the first one reached reading left to right, which can be a
 * different one from the walk's; either is true of the body.
 */
export function findRawArrayBudgetViolation(text: string): TArrayBudgetViolation | null {
  const scan: TRawScan = { text, frames: [], total: 0 };

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (isWhitespace(code) || code === COLON) {
      continue;
    }

    if (code === COMMA || code === CLOSE_BRACKET || code === CLOSE_BRACE) {
      if (!applyPunctuation(scan, code)) {
        return null;
      }
      continue;
    }

    const step = expectsKey(scan, code) ? readKey(scan, index) : readValue(scan, index, code);
    if (step.violation) {
      return step.violation;
    }
    if (step.end === -1) {
      return null;
    }
    index = step.end;
  }

  return null;
}

type TRawScan = { text: string; frames: TRawFrame[]; total: number };

/** Where a token ended (-1: the text broke there), or the limit it crossed. */
type TRawStep = { end: number; violation?: TArrayBudgetViolation };

/** A comma opens the next entry; a closing bracket or brace closes a frame. False for one too many. */
function applyPunctuation(scan: TRawScan, code: number): boolean {
  if (code === COMMA) {
    const top = scan.frames.at(-1);
    if (top) {
      top.expectingEntry = true;
    }
    return true;
  }
  return scan.frames.pop() !== undefined;
}

const expectsKey = (scan: TRawScan, code: number): boolean => {
  const top = scan.frames.at(-1);
  return code === QUOTE && top !== undefined && !top.isArray && top.expectingEntry;
};

/** Remembers where an object's key is, to decode it only if a violation names it. */
function readKey(scan: TRawScan, index: number): TRawStep {
  const top = scan.frames.at(-1) as TRawFrame;
  const end = closingQuote(scan.text, index);
  top.keyStart = index + 1;
  top.keyEnd = end;
  top.expectingEntry = false;
  return { end };
}

/** Counts the value as its array's next element, then opens a container or skips a string or literal. */
function readValue(scan: TRawScan, index: number, code: number): TRawStep {
  const counted = countElement(scan);
  if (counted) {
    return { end: index, violation: counted };
  }

  if (code === OPEN_BRACKET || code === OPEN_BRACE) {
    if (scan.frames.length >= V3_REQUEST_MAX_DEPTH) {
      return { end: index, violation: { kind: "too_deep", path: rawPath(scan.text, scan.frames) } };
    }
    scan.frames.push({
      isArray: code === OPEN_BRACKET,
      count: 0,
      keyStart: 0,
      keyEnd: 0,
      expectingEntry: true,
    });
    return { end: index };
  }

  if (code === QUOTE) {
    return { end: closingQuote(scan.text, index) };
  }

  let end = index;
  while (end + 1 < scan.text.length && !endsToken(scan.text.charCodeAt(end + 1))) {
    end += 1;
  }
  return { end };
}

/** In an array, a value is its next element: the per-array and whole-body counts both grow. */
function countElement(scan: TRawScan): TArrayBudgetViolation | null {
  const top = scan.frames.at(-1);
  if (!top?.isArray || !top.expectingEntry) {
    return null;
  }

  top.count += 1;
  top.expectingEntry = false;
  scan.total += 1;
  if (top.count > V3_REQUEST_ARRAY_MAX_ITEMS) {
    return { kind: "array_too_long", path: rawPath(scan.text, scan.frames.slice(0, -1)), length: top.count };
  }
  if (scan.total > V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS) {
    return {
      kind: "too_many_elements",
      path: rawPath(scan.text, scan.frames.slice(0, -1)),
      total: scan.total,
    };
  }
  return null;
}

/**
 * The violation as the one `invalid_params` entry a 400 carries. The per-array message is Zod's own
 * `too_big` wording, so a caller sees the same sentence whether the schema or this walk refused the
 * array.
 */
export function arrayBudgetInvalidParam(
  violation: TArrayBudgetViolation,
  fallbackName: string
): InvalidParam {
  const name = violation.path || fallbackName;

  if (violation.kind === "array_too_long") {
    return { name, reason: `Too big: expected array to have <=${V3_REQUEST_ARRAY_MAX_ITEMS} items` };
  }

  if (violation.kind === "too_deep") {
    return { name, reason: `Too deep: expected the request to nest <=${V3_REQUEST_MAX_DEPTH} levels` };
  }

  return {
    name,
    reason: `Too big: expected the request to carry <=${V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS} array elements in total`,
  };
}
