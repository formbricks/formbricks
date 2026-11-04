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
 * union or pipe is split into its children. The walk checks each node about once (a union may try a few
 * branches, a non-transform pipe parses its input side again), a small subtree builds a bounded number
 * of issues, and the walk stops once it holds the cap, so the work stays proportional to the input plus a
 * capped number of issues, however it is shaped. A valid input then gets the schema's own parse as well.
 *
 * What the walk leaves to the schema's own parse is a big container's own checks: an array's length, an
 * object's unknown keys, a refinement across children. They run once the walk finds nothing, and report
 * at most about one issue per entry, the ceiling the array budget already sets.
 *
 * The issues are Zod's own, with paths from the root, so they read as a full parse's do. Two differences,
 * both on input that is invalid anyway: a big container whose children fail does not report its own
 * checks, and a big `z.union` reports the branch the value plausibly belongs to rather than one
 * `invalid_union`.
 *
 * Above the threshold the walk is stricter than Zod in one known case: a record inside an intersection,
 * whose keys its own key schema refuses but the other side accepts (Zod reconciles the two). And a
 * codec's output side, behind its decode, is parsed whole once its input side passes, so it is not
 * bounded. None of the v3 request schemas has either. Two costs are not bounded for every schema
 * either: a non-transform pipe parses its input side again, so pipes nested in a recursive schema cost
 * depth × size; and the walk recurses a few frames per level of nesting, so it overflows the stack
 * sooner than Zod. The v3 routes cap nesting at 256 levels before parsing (`array-budget.ts`), and no
 * v3 request schema nests pipes.
 *
 * A key named `__proto__` is skipped wherever Zod skips it (records, catchalls, declared shape keys), so
 * the walk never reports a problem Zod would not. The one exception is a record whose key schema
 * transforms some other key into `__proto__`, which Zod also skips; no v3 request schema has one.
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
 * State kept for one parse. `trials`: union branches and intersection sides already walked over a value,
 * without which a chain of values matching two branches would be walked once per path down it (2^depth).
 * `sizes`: subtree sizes, see `subtreeSize`. `active`: the big values being split right now, so a value
 * that contains itself is not split forever.
 */
type TWalk = {
  trials: WeakMap<object, Map<z.ZodType, IssueSink>>;
  sizes: WeakMap<object, number>;
  active: WeakMap<object, Set<z.ZodType>>;
};

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

  for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
    if (frame.next < frame.children.length && frame.total <= SMALL_SUBTREE_NODES) {
      const child = frame.children[frame.next];
      frame.next += 1;
      if (typeof child !== "object" || child === null) {
        frame.total += 1;
        continue;
      }
      const childSize = sizes.get(child);
      if (childSize !== undefined) {
        frame.total += childSize;
      } else if (stack.length > SMALL_SUBTREE_NODES) {
        // Each open frame is a node of its own, so this subtree is big already; stopping here also ends
        // a value that contains itself.
        frame.total += SMALL_SUBTREE_NODES + 1;
      } else {
        stack.push(open(child));
      }
      continue;
    }

    // Past the cap the rest of the children cannot change the answer, so they are not visited; a
    // child that is asked about later is counted then, once.
    finished = Math.min(frame.total, SMALL_SUBTREE_NODES + 1);
    sizes.set(frame.node, finished);
    stack.pop();
    const parent = stack.at(-1);
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
    schema instanceof z.ZodExactOptional ||
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

/** Keys an object needs on input: those it may not leave out. */
function requiredKeys(schema: z.ZodObject): string[] {
  let keys = requiredKeysCache.get(schema);
  if (!keys) {
    const shape = schema.shape as Record<string, z.ZodType>;
    keys = Object.keys(shape).filter((key) => !absenceAllowed(shape, key));
    requiredKeysCache.set(schema, keys);
  }
  return keys;
}

/**
 * How well `value` fits a union branch: `null` only when a literal field (a discriminator,
 * `objective: "calculate"`) rules it out, else the share of the branch's required keys present. A value
 * valid for an object branch scores 1 there, so best-first order reaches it no later than any branch
 * that scores less; a branch this cannot judge (a record, a pipe) scores 0, so it is never dropped.
 */
function branchScore(branch: z.ZodType, value: Record<string, unknown>): number | null {
  const schema = unwrap(branch);

  if (schema instanceof z.ZodObject) {
    for (const [key, field] of Object.entries(schema.shape)) {
      // Only literal fields decide: anything else here would validate a whole (possibly big) subtree.
      if (key === "__proto__" || !(unwrap(field as z.ZodType) instanceof z.ZodLiteral)) {
        continue;
      }
      // The field as declared, and a missing key judged by its absence (not as `undefined`, which an
      // exactOptional literal refuses), so a branch the value fits is never ruled out.
      const fits = Object.hasOwn(value, key)
        ? (field as z.ZodType).validate(value[key])
        : absenceAllowed(schema.shape as Record<string, z.ZodType>, key);
      if (!fits) {
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

const isMergeConflict = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith("Unmergable intersection");

/**
 * `schema.safeParse(value)` for a part of the input. Checked on its own, a part can reach an intersection
 * merge that the whole parse never reaches (it stopped at a sibling's failure), and Zod throws on an
 * unmergeable result. That one throw comes back as the part's problem, so the reply stays a 400; any
 * other error is a bug and is rethrown. Every parse the walk makes goes through here or `checkWhole`.
 */
function parsePart(schema: z.ZodType, value: unknown): z.ZodSafeParseResult<unknown> {
  try {
    return schema.safeParse(value);
  } catch (error) {
    if (!isMergeConflict(error)) {
      throw error;
    }
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "custom",
          message: "Invalid input: the intersection's sides conflict",
          path: [],
          input: value,
        },
      ]),
    };
  }
}

/** A subtree checked whole: `validate` first, and its issues only when that fails. */
function checkWhole(schema: z.ZodType, value: unknown, path: PropertyKey[], sink: IssueSink): void {
  let valid: boolean;
  try {
    valid = schema.validate(value);
  } catch (error) {
    if (!isMergeConflict(error)) {
      throw error;
    }
    valid = false;
  }
  if (valid) {
    return;
  }
  const result = parsePart(schema, value);
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

  // A big value is always an object. Met again inside itself under the same schema, it is left to the
  // schema's own parse, which handles cycles; JSON bodies have none, but the guard is a general one.
  const big = value as object;
  let schemas = ctx.active.get(big);
  if (schemas?.has(schema)) {
    return;
  }
  if (!schemas) {
    schemas = new Set();
    ctx.active.set(big, schemas);
  }
  schemas.add(schema);
  split(schema, value, path, sink, ctx);
  schemas.delete(schema);
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
  // A codec is a pipe with its own transform between the sides. Its input side is walked like any
  // other; only an input that passes is parsed whole, decode and output side included.
  if (schema instanceof z.ZodCodec) {
    const before = sink.issues.length;
    walk(schema.def.in as z.ZodType, value, path, sink, ctx);
    if (sink.issues.length !== before || sink.full) {
      sink.partial = true;
      return;
    }
    checkWhole(schema, value, path, sink);
    return;
  }

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
    splitObject(schema, value, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    const element = schema.def.element as z.ZodType;
    walkEach(value.entries(), () => element, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodRecord && isPlainObject(value)) {
    splitRecord(schema, value, path, sink, ctx);
    return;
  }

  if (schema instanceof z.ZodIntersection && typeof value === "object" && value !== null) {
    // Each side through the trial cache: a recursive intersection would otherwise walk the value once
    // per side at every level, 2^depth.
    for (const side of [schema.def.left, schema.def.right] as z.ZodType[]) {
      sink.absorb(trial(side, value, sink.max, ctx), path);
    }
    return;
  }

  if (schema instanceof z.ZodUnion && isPlainObject(value)) {
    splitUnion(schema, value, path, sink, ctx);
    return;
  }

  // A big value against a schema the walk cannot split: a tuple, a set, a custom check, a union over a
  // big array (a segment filter's `resource`, a static operand's list). It is parsed whole; in the v3
  // survey schemas each such union costs about one branch or sits under its own caps (the segment
  // tree's node and depth limits, the show-condition list limit), so the parse stays small.
  checkWhole(schema, value, path, sink);
}

// Keyed by field and key: Zod reads an absent key through `in`, so a key named like a prototype property
// (`constructor`) gets a different answer from the same field elsewhere.
const absenceCache = new WeakMap<z.ZodType, Map<string, boolean>>();

/** Whether an object with this field may leave its key out, asked of Zod with a one-key object. */
function absenceAllowed(shape: Record<string, z.ZodType>, key: string): boolean {
  const field = shape[key];
  let byKey = absenceCache.get(field);
  if (!byKey) {
    byKey = new Map();
    absenceCache.set(field, byKey);
  }
  let allowed = byKey.get(key);
  if (allowed === undefined) {
    allowed = z.object({ [key]: field }).validate({});
    byKey.set(key, allowed);
  }
  return allowed;
}

function splitObject(
  schema: z.ZodObject,
  value: Record<string, unknown>,
  path: PropertyKey[],
  sink: IssueSink,
  ctx: TWalk
): void {
  const shape = schema.shape as Record<string, z.ZodType>;
  const catchall = schema.def.catchall as z.ZodType | undefined;
  // A key the value lacks is judged as Zod does, by its absence, not by `undefined`: they differ for
  // `exactOptional`.
  const entries = Object.keys(shape)
    .filter((key) => key !== "__proto__" && (Object.hasOwn(value, key) || !absenceAllowed(shape, key)))
    .map((key): [PropertyKey, unknown] => [key, value[key]]);
  // Keys a catchall accepts are entries like any other. A strict object's refusal of extra keys is its
  // own check, left to the schema's parse (one issue).
  if (catchall && !(catchall instanceof z.ZodNever)) {
    for (const key of Object.keys(value)) {
      if (key !== "__proto__" && !Object.hasOwn(shape, key)) {
        entries.push([key, value[key]]);
      }
    }
  }
  // Own keys only: `shape.constructor` would otherwise be `Object`, not the catchall.
  walkEach(
    entries,
    (key) => (Object.hasOwn(shape, key as string) ? shape[key as string] : (catchall as z.ZodType)),
    path,
    sink,
    ctx
  );
}

const entryJudges = new WeakMap<z.ZodRecord, { entry: z.ZodType; key: z.ZodType }>();

/**
 * The record without its own refinements, as it judges one entry (`entry`) or one key with any value
 * (`key`). A refinement over the whole record would misjudge a one-entry object; it runs in the schema's
 * own parse instead.
 */
function recordJudges(schema: z.ZodRecord): { entry: z.ZodType; key: z.ZodType } {
  let judges = entryJudges.get(schema);
  if (!judges) {
    judges = {
      entry: schema.clone({ ...schema.def, checks: [] }),
      key: schema.clone({ ...schema.def, valueType: z.unknown(), checks: [] }),
    };
    entryJudges.set(schema, judges);
  }
  return judges;
}

/** The keys an enum, a literal or a union of them allows, or `null` when the set is not finite. */
function finiteKeys(keyType: z.ZodType): string[] | null {
  if (keyType instanceof z.ZodEnum) {
    return keyType.options.map(String);
  }
  if (keyType instanceof z.ZodLiteral) {
    return [...keyType.values].map(String);
  }
  if (keyType instanceof z.ZodUnion) {
    const keys: string[] = [];
    for (const option of keyType.def.options as z.ZodType[]) {
      const optionKeys = finiteKeys(option);
      if (!optionKeys) {
        return null;
      }
      keys.push(...optionKeys);
    }
    return keys;
  }
  return null;
}

function splitRecord(
  schema: z.ZodRecord,
  value: Record<string, unknown>,
  path: PropertyKey[],
  sink: IssueSink,
  ctx: TWalk
): void {
  const keyType = schema.def.keyType as z.ZodType;
  const valueType = schema.def.valueType as z.ZodType;

  // A record over a finite key set (unless partial) is one Zod reads like an object: every declared key's
  // value, and the extra keys only as the record's own check (passed through when loose, one
  // `unrecognized_keys` otherwise), which the schema's parse makes.
  const declared = (schema.def as { partial?: boolean }).partial === true ? null : finiteKeys(keyType);
  if (declared) {
    walkEach(
      declared.filter((key) => key !== "__proto__").map((key): [PropertyKey, unknown] => [key, value[key]]),
      () => valueType,
      path,
      sink,
      ctx
    );
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "__proto__") {
      continue;
    }
    if (sink.full) {
      sink.truncated = true;
      return;
    }
    if (keyType.validate(key)) {
      walk(valueType, entry, [...path, key], sink, ctx);
    } else if (subtreeSize(entry, ctx.sizes) <= SMALL_SUBTREE_NODES) {
      // Zod may still take it (a numeric key it reads as a number, a loose record), so the record judges
      // the one entry.
      checkWhole(recordJudges(schema).entry, { [key]: entry }, path, sink);
    } else {
      // A big entry: Zod's verdict on the key alone, then the value walked like any other.
      const keyVerdict = parsePart(recordJudges(schema).key, { [key]: null });
      if (!keyVerdict.success) {
        sink.add(keyVerdict.error.issues, path);
      } else if (schema.def.mode !== "loose") {
        walk(valueType, entry, [...path, key], sink, ctx);
      }
    }
  }
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
  const transformed = input instanceof z.ZodTransform ? parsePart(input, value) : null;
  if (transformed && !transformed.success) {
    sink.add(transformed.error.issues, path);
  } else if (!transformed) {
    walk(input, value, path, sink, ctx);
  }
  if (sink.issues.length !== before || sink.full) {
    // The output side never ran, so whatever it would report is missing from the list. Zod's own pipe
    // goes on past an input side that reported only unknown keys (an enclosing intersection may accept
    // them); this stops there, which can refuse such a value. No v3 request schema has that shape.
    sink.partial = true;
    return;
  }
  // The walk leaves a big container's own checks (unknown keys, a length, a refinement) to the schema's
  // parse, but a pipe only runs its output side once its input side passed. Its children did, so this
  // parse can only add those own checks: a few issues, never one per entry.
  const output = transformed ?? parsePart(input, value);
  if (!output.success) {
    sink.add(output.error.issues, path);
    sink.partial = true;
    return;
  }
  walk(schema.def.out as z.ZodType, output.data, path, sink, ctx);
}

function trial(option: z.ZodType, value: object, cap: number, ctx: TWalk): IssueSink {
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
    const matching = options.filter((option) => {
      const branchSchema = unwrap(option);
      if (!(branchSchema instanceof z.ZodObject)) {
        return false;
      }
      const shape = branchSchema.shape as Record<string, z.ZodType>;
      if (!Object.hasOwn(shape, discriminator)) {
        return false;
      }
      // An absent discriminator is judged by its absence, as Zod does, not as `undefined`.
      return Object.hasOwn(value, discriminator)
        ? shape[discriminator].validate(value[discriminator])
        : absenceAllowed(shape, discriminator);
    });
    if (matching.length === 1) {
      walk(matching[0], value, path, sink, ctx);
      return;
    }
    // No branch claims it: Zod's own refusal costs nothing, as it stops at the discriminator, unless the
    // union falls back to trying every branch. Several claimants are tried like a plain union's.
    const fallsBack = (schema.def as { unionFallback?: boolean }).unionFallback === true;
    if (matching.length === 0 && !fallsBack) {
      checkWhole(schema, value, path, sink);
      return;
    }
    splitAmong(matching.length > 0 ? matching : options, value, path, sink, ctx);
    return;
  }

  splitAmong(options, value, path, sink, ctx);
}

/** The union's branches, best-fitting first, walked until one comes back clean; else the best one's issues. */
function splitAmong(
  options: z.ZodType[],
  value: Record<string, unknown>,
  path: PropertyKey[],
  sink: IssueSink,
  ctx: TWalk
): void {
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
      walk(schema, value, [], sink, { trials: new WeakMap(), sizes: new WeakMap(), active: new WeakMap() });

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
