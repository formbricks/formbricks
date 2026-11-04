import { z } from "zod";
import { V3_INVALID_PARAMS_MAX } from "./invalid-params";

/**
 * Validation whose cost stays bounded when the input is hostile (ENG-4100).
 *
 * Zod builds an issue for every problem before it returns, and the request budgets (`array-budget.ts`)
 * cap entries, not issues per entry: an incomplete or wrong entry is several issues, an entry in a plain
 * `z.union` several per branch, and a 2 MB body of them built over a million issues and hundreds of MB
 * of heap only for the reply to list fifty. Past ~120k issues in one subtree Zod's own issue merge
 * overflows the stack, and the request fails with a 500.
 *
 * Zod cannot stop a parse early: even `validate`, its fail-fast check, still builds every issue a
 * refinement or a string check reports. So the guard never lets Zod run over much at once. It walks the
 * input alongside the schema: a subtree of at most `SMALL_SUBTREE_NODES` nodes is checked whole, with one
 * `validate` (and a parse for its issues only if that fails), while a bigger object, array, record,
 * union or pipe is split into its children. Each node is checked about once (a union may try a few
 * branches), a small subtree builds a bounded number of issues, and the walk stops once it holds the
 * cap, so the work stays proportional to the input plus a capped number of issues, however it is shaped.
 *
 * What the walk leaves to the schema's own parse is a big container's own checks: an array's length, an
 * object's unknown keys, a refinement across children. They run once the walk finds nothing, and report
 * at most about one issue per entry, the ceiling the array budget already sets.
 *
 * The issues are Zod's own, with paths from the root, so they read as a full parse's do. Two differences,
 * both on input that is invalid anyway: a big container whose children fail does not report its own
 * checks, and a big `z.union` reports the branch the value plausibly belongs to rather than one
 * `invalid_union`.
 */

/** Nodes (objects, arrays and values) a subtree may hold to be checked whole. */
const SMALL_SUBTREE_NODES = 256;

class IssueSink {
  readonly issues: z.core.$ZodIssue[] = [];
  truncated = false;
  /** Set when the walk skipped part of the input, so the list is not all there is to report. */
  partial = false;

  constructor(readonly max: number) {}

  get full(): boolean {
    return this.issues.length >= this.max;
  }

  add(issues: readonly z.core.$ZodIssue[], prefix: readonly PropertyKey[]): void {
    for (const issue of issues) {
      if (this.full) {
        this.truncated = true;
        return;
      }
      this.issues.push({ ...issue, path: [...prefix, ...issue.path] });
    }
  }

  /** Takes over what a trial walk of a union branch found, under this sink's cap. */
  absorb(trial: IssueSink, prefix: readonly PropertyKey[]): void {
    this.add(trial.issues, prefix);
    this.truncated ||= trial.truncated;
    this.partial ||= trial.partial;
  }
}

/**
 * Union branches already walked over a value, for the length of one parse. Without it, a chain of values
 * that each plausibly match two branches would be walked once per path down the chain: 2^depth.
 */
type TWalk = { trials: WeakMap<object, Map<z.ZodType, IssueSink>>; sizes: WeakMap<object, number> };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Nodes (objects, arrays and values) under `value`, itself included, counted up to one past
 * `SMALL_SUBTREE_NODES`. Every container's count is kept for the parse, so however often the walk asks
 * (each ancestor, each union branch), a node's children are enumerated once: an object with 180k keys
 * used to be enumerated again by every level above it, over a minute of CPU for one request.
 */
function subtreeSize(value: unknown, sizes: WeakMap<object, number>): number {
  if (typeof value !== "object" || value === null) {
    return 1;
  }
  const known = sizes.get(value);
  if (known !== undefined) {
    return known;
  }

  // Post-order without recursion: a frame sums its children once each has a count.
  type TFrame = { node: object; children: unknown[]; next: number; total: number };
  const open = (node: object): TFrame => ({
    node,
    children: Array.isArray(node) ? node : Object.values(node),
    next: 0,
    total: 1,
  });
  const stack: TFrame[] = [open(value)];
  let finished = 0;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next < frame.children.length && frame.total <= SMALL_SUBTREE_NODES) {
      const child = frame.children[frame.next];
      frame.next += 1;
      if (typeof child !== "object" || child === null) {
        frame.total += 1;
        continue;
      }
      const childSize = sizes.get(child);
      if (childSize === undefined) {
        stack.push(open(child));
      } else {
        frame.total += childSize;
      }
      continue;
    }

    // Past the cap the rest of the children cannot change the answer, so they are not visited; a
    // child that is asked about later is counted then, once.
    finished = Math.min(frame.total, SMALL_SUBTREE_NODES + 1);
    sizes.set(frame.node, finished);
    stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.total += finished;
    }
  }

  return finished;
}

// A lazy schema's getter may build its schema afresh on every call; resolving each one once keeps the
// union trials below, which are keyed by schema, from missing their cache.
const lazyTargets = new WeakMap<z.ZodLazy, z.ZodType>();

/** The schema a wrapper (optional, default, lazy, …) delegates to, or the schema itself. */
function unwrap(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodLazy) {
    let target = lazyTargets.get(schema);
    if (!target) {
      target = schema.def.getter() as z.ZodType;
      lazyTargets.set(schema, target);
    }
    return unwrap(target);
  }
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodPrefault ||
    schema instanceof z.ZodReadonly ||
    schema instanceof z.ZodNonOptional
  ) {
    return unwrap(schema.def.innerType as z.ZodType);
  }
  return schema;
}

const requiredKeysCache = new WeakMap<z.ZodObject, string[]>();

/** Keys an object needs on input: those whose schema refuses `undefined`. */
function requiredKeys(schema: z.ZodObject): string[] {
  let keys = requiredKeysCache.get(schema);
  if (!keys) {
    keys = Object.entries(schema.shape)
      .filter(([, field]) => !(field as z.ZodType).validate(undefined))
      .map(([key]) => key);
    requiredKeysCache.set(schema, keys);
  }
  return keys;
}

/**
 * How well `value` fits a union branch: `null` only when a literal field (a discriminator,
 * `objective: "calculate"`) rules it out, else the share of the branch's required keys present. A
 * value valid for an object branch scores 1 there, so walking branches best-first reaches it before any
 * other; a branch this cannot judge (a record, a pipe) scores 0, so it is tried last but never dropped.
 */
function branchScore(branch: z.ZodType, value: Record<string, unknown>): number | null {
  const schema = unwrap(branch);

  if (schema instanceof z.ZodObject) {
    for (const [key, field] of Object.entries(schema.shape)) {
      // The field as declared, so an optional literal still accepts a missing key.
      if (unwrap(field as z.ZodType) instanceof z.ZodLiteral && !(field as z.ZodType).validate(value[key])) {
        return null;
      }
    }
    const keys = requiredKeys(schema);
    return keys.length === 0 ? 1 : keys.filter((key) => value[key] !== undefined).length / keys.length;
  }
  if (schema instanceof z.ZodIntersection) {
    const left = branchScore(schema.def.left as z.ZodType, value);
    const right = branchScore(schema.def.right as z.ZodType, value);
    return left === null || right === null ? null : Math.min(left, right);
  }
  if (schema instanceof z.ZodUnion) {
    const scores = (schema.def.options as z.ZodType[])
      .map((option) => branchScore(option, value))
      .filter((score): score is number => score !== null);
    return scores.length === 0 ? null : Math.max(...scores);
  }
  return 0;
}

/** A subtree checked whole: `validate` first, and its issues only when that fails. */
function checkWhole(schema: z.ZodType, value: unknown, path: PropertyKey[], sink: IssueSink): void {
  if (schema.validate(value)) {
    return;
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    sink.add(result.error.issues, path);
  }
}

function walk(schema: z.ZodType, value: unknown, path: PropertyKey[], sink: IssueSink, ctx: TWalk): void {
  if (sink.full) {
    sink.truncated = true;
    return;
  }
  if (subtreeSize(value, ctx.sizes) <= SMALL_SUBTREE_NODES) {
    checkWhole(schema, value, path, sink);
    return;
  }
  split(schema, value, path, sink, ctx);
}

function walkEach(
  entries: Iterable<[PropertyKey, unknown]>,
  schemaFor: (key: PropertyKey) => z.ZodType,
  path: PropertyKey[],
  sink: IssueSink,
  ctx: TWalk
): void {
  for (const [key, entry] of entries) {
    if (sink.full) {
      sink.truncated = true;
      return;
    }
    walk(schemaFor(key), entry, [...path, key], sink, ctx);
  }
}

/** A big value: walk its children against the matching part of the schema. */
function split(schema: z.ZodType, value: unknown, path: PropertyKey[], sink: IssueSink, ctx: TWalk): void {
  if (schema instanceof z.ZodPipe) {
    splitPipe(schema, value, path, sink, ctx);
    return;
  }

  const unwrapped = unwrap(schema);
  if (unwrapped !== schema) {
    walk(unwrapped, value, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodObject && isPlainObject(value)) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const catchall = schema.def.catchall as z.ZodType | undefined;
    const entries = Object.keys(shape).map((key): [PropertyKey, unknown] => [key, value[key]]);
    // Keys a catchall accepts are entries like any other. A strict object's refusal of extra keys is
    // its own check, left to the schema's parse (one issue).
    if (catchall && !(catchall instanceof z.ZodNever)) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(shape, key)) {
          entries.push([key, value[key]]);
        }
      }
    }
    walkEach(entries, (key) => shape[key as string] ?? catchall, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    const element = schema.def.element as z.ZodType;
    walkEach(value.entries(), () => element, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodRecord && isPlainObject(value)) {
    const keyType = schema.def.keyType as z.ZodType;
    const valueType = schema.def.valueType as z.ZodType;
    for (const [key, entry] of Object.entries(value)) {
      if (sink.full) {
        sink.truncated = true;
        return;
      }
      if (keyType.validate(key)) {
        walk(valueType, entry, [...path, key], sink, ctx);
      } else {
        checkWhole(keyType, key, [...path, key], sink);
      }
    }
    return;
  }

  if (schema instanceof z.ZodIntersection) {
    walk(schema.def.left as z.ZodType, value, path, sink, ctx);
    walk(schema.def.right as z.ZodType, value, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodUnion && isPlainObject(value)) {
    splitUnion(schema, value, path, sink, ctx);
    return;
  }

  // A big value against a schema the walk cannot split: a tuple, a set, a custom check, a union over a
  // big array (a segment filter's `resource`, a static operand's list). It is parsed whole; in the v3
  // survey schemas each such union stops at its first branch or sits under its own caps (the segment
  // tree's node and depth limits, the show-condition list limit), so the parse stays small.
  checkWhole(schema, value, path, sink);
}

function splitPipe(
  schema: z.ZodPipe,
  value: unknown,
  path: PropertyKey[],
  sink: IssueSink,
  ctx: TWalk
): void {
  const input = schema.def.in as z.ZodType;
  const before = sink.issues.length;
  // A transform is one function call (a length check, a normalizer); its parse is how its output is had.
  const transformed = input instanceof z.ZodTransform ? input.safeParse(value) : null;
  if (transformed && !transformed.success) {
    sink.add(transformed.error.issues, path);
  } else if (!transformed) {
    walk(input, value, path, sink, ctx);
  }
  if (sink.issues.length !== before || sink.full) {
    // The output side never ran, so whatever it would report is missing from the list.
    sink.partial = true;
    return;
  }
  // The walk leaves a big container's own checks (unknown keys, a length, a refinement) to the schema's
  // parse, but a pipe only runs its output side once its input side passed. Its children did, so this
  // parse can only add those own checks: a few issues, never one per entry.
  const output = transformed ?? input.safeParse(value);
  if (!output.success) {
    sink.add(output.error.issues, path);
    sink.partial = true;
    return;
  }
  walk(schema.def.out as z.ZodType, output.data, path, sink, ctx);
}

function trial(option: z.ZodType, value: Record<string, unknown>, cap: number, ctx: TWalk): IssueSink {
  let byBranch = ctx.trials.get(value);
  if (!byBranch) {
    byBranch = new Map();
    ctx.trials.set(value, byBranch);
  }
  let result = byBranch.get(option);
  if (!result) {
    result = new IssueSink(cap);
    walk(option, value, [], result, ctx);
    byBranch.set(option, result);
  }
  return result;
}

/**
 * A discriminated union is split by its discriminator, as Zod itself does: the matching branch is
 * walked, and a value no branch claims gets Zod's own one-line refusal, which costs nothing because Zod
 * stops at the discriminator.
 *
 * A plain union is valid only if some branch is, so the branches are walked best-fitting first until one
 * comes back clean. When none does, only the best-fitting branch's issues are reported: the others are
 * mostly about keys the caller never meant to send.
 */
function splitUnion(
  schema: z.ZodUnion,
  value: Record<string, unknown>,
  path: PropertyKey[],
  sink: IssueSink,
  ctx: TWalk
): void {
  const options = schema.def.options as z.ZodType[];

  if (schema instanceof z.ZodDiscriminatedUnion) {
    const discriminator = schema.def.discriminator;
    const branch = options.find((option) => {
      const field = unwrap(option);
      return (
        field instanceof z.ZodObject &&
        (field.shape[discriminator] as z.ZodType | undefined)?.validate(value[discriminator]) === true
      );
    });
    if (branch) {
      walk(branch, value, path, sink, ctx);
    } else {
      checkWhole(schema, value, path, sink);
    }
    return;
  }

  const ranked = options
    .map((option) => ({ option, score: branchScore(option, value) }))
    .filter((entry): entry is { option: z.ZodType; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.option);
  const candidates = ranked.length > 0 ? ranked : options;
  if (candidates.length === 1) {
    walk(candidates[0], value, path, sink, ctx);
    return;
  }

  let best: IssueSink | null = null;
  for (const option of candidates) {
    const result = trial(option, value, sink.max, ctx);
    if (result.issues.length === 0) {
      sink.partial ||= result.partial;
      return;
    }
    best ??= result;
  }
  if (best) {
    sink.absorb(best, path);
  }
}

const TRUNCATED_REASON = "Further problems were not checked; fix the ones above and retry";

/**
 * `schema` behind the guard described above: drop it in where the schema was
 * (`.pipe(boundedSchema(base))`). Its output side is still `schema`, so the type and the generated JSON
 * Schema are unchanged, and a reply never lists more than `V3_INVALID_PARAMS_MAX` issues.
 *
 * A leading `z.preprocess` stays in front of the guard, so its function runs once per parse rather than
 * once in the guard and again in the schema.
 */
export function boundedSchema<TSchema extends z.ZodType>(schema: TSchema): z.ZodType<z.output<TSchema>> {
  if (schema instanceof z.ZodPipe && schema.def.in instanceof z.ZodTransform) {
    // The same pipe with the guard on its output side, so its output is still `TSchema`'s.
    return (schema.def.in as z.ZodType).pipe(boundedSchema(schema.def.out as z.ZodType)) as z.ZodType<
      z.output<TSchema>
    >;
  }

  return z
    .unknown()
    .transform((value, ctx) => {
      const sink = new IssueSink(V3_INVALID_PARAMS_MAX - 1);
      walk(schema, value, [], sink, { trials: new WeakMap(), sizes: new WeakMap() });

      // A pipe goes on past `unrecognized_keys` (zod: an enclosing intersection may still accept the
      // key), so a list of nothing else would hand `z.NEVER` to the schema as its input. When the walk saw
      // the whole input, such a list is all there is, under the cap, so the schema's own parse reports the
      // same keys at no more cost: let it. When it did not, the note below is what stops the pipe.
      const onlyUnknownKeys = sink.issues.every((issue) => issue.code === "unrecognized_keys");
      if (onlyUnknownKeys && !sink.truncated && !sink.partial) {
        return value;
      }

      for (const issue of sink.issues) {
        ctx.addIssue({ ...issue });
      }
      if (sink.truncated || onlyUnknownKeys) {
        ctx.addIssue({ code: "custom", message: TRUNCATED_REASON, path: [] });
      }
      return z.NEVER;
    })
    .pipe(schema);
}
